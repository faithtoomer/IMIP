import { describe, expect, it } from 'vitest';
import { ThermalAuthority } from '../src/ThermalAuthority.js';
import { InjectableThermalSensorProvider } from '../src/sensors.js';
import { THERMAL_EVENTS } from '../src/events.js';
import { ThermalNotFoundError } from '../src/errors.js';
import { makeSample } from './testHelpers.js';

describe('ITIA failure recovery', () => {
  it('preserves last known profile when sensor becomes unavailable', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([makeSample({ celsius: 72 })]);
    await authority.collectAndUpdate();

    provider.setSamples([makeSample({ celsius: 72, sensorAvailable: false })]);
    await authority.collectAndUpdate();

    const profile = authority.getProfile('gpu-0');
    expect(profile.sensorAvailable).toBe(false);
    expect(profile.thermalState).toBe('unknown');
  });

  it('recovers from sensor unavailability when sensor returns', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([makeSample({ sensorAvailable: false })]);
    await authority.collectAndUpdate();

    provider.setSamples([makeSample({ celsius: 65, sensorAvailable: true })]);
    await authority.collectAndUpdate();

    const profile = authority.getProfile('gpu-0');
    expect(profile.sensorAvailable).toBe(true);
    expect(profile.thermalState).toBe('nominal');
  });

  it('getProfile() throws for unregistered device after failed lookup', () => {
    const authority = new ThermalAuthority();
    expect(() => authority.getProfile('nonexistent')).toThrow(ThermalNotFoundError);
  });

  it('continues processing remaining devices when one has invalid data', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([
      makeSample({ deviceId: 'gpu-0', celsius: 65 }),
      makeSample({ deviceId: 'gpu-1', celsius: 200 }),
    ]);

    await expect(authority.collectAndUpdate()).rejects.toThrow();
    expect(authority.registry.get('gpu-0')?.currentCelsius).toBe(65);
  });

  it('publishes ThermalSensorUnavailable for registered devices with missing sensors', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.registerDevice('gpu-0', 'gpu');

    let unavailable = false;
    authority.subscribe(THERMAL_EVENTS.ThermalSensorUnavailable, () => {
      unavailable = true;
    });

    provider.setSamples([]);
    provider.setSamples([makeSample({ sensorAvailable: false })]);
    await authority.collectAndUpdate();
    expect(unavailable).toBe(true);
  });

  it('getDigitalTwin() works after partial analysis failure', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([makeSample({ celsius: 65 })]);
    await authority.collectAndUpdate();

    const twin = authority.getDigitalTwin('gpu-0');
    expect(twin.assessment).toBeDefined();
    expect(twin.profile.deviceId).toBe('gpu-0');
  });

  it('anomaly list clears when conditions normalize', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([makeSample({ sensorAvailable: false })]);
    await authority.collectAndUpdate();
    expect(authority.getAnomalies('gpu-0').length).toBeGreaterThan(0);

    provider.setSamples([makeSample({ celsius: 65, sensorAvailable: true })]);
    await authority.collectAndUpdate();
    expect(authority.getAnomalies('gpu-0')).toHaveLength(0);
  });
});
