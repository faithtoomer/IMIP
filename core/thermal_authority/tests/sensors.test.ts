import { describe, expect, it } from 'vitest';
import { InjectableThermalSensorProvider } from '../src/sensors.js';
import { ThermalAuthority } from '../src/ThermalAuthority.js';
import { makeSample } from './testHelpers.js';

describe('Thermal sensors & telemetry', () => {
  it('InjectableThermalSensorProvider returns configured samples', async () => {
    const provider = new InjectableThermalSensorProvider();
    provider.setSamples([makeSample({ celsius: 70 })]);
    const outcome = await provider.collect();
    expect(outcome.samples).toHaveLength(1);
    expect(outcome.samples[0].celsius).toBe(70);
  });

  it('reports unavailable device ids when sensorAvailable is false', async () => {
    const provider = new InjectableThermalSensorProvider();
    provider.setSamples([makeSample({ sensorAvailable: false })]);
    const outcome = await provider.collect();
    expect(outcome.unavailableDeviceIds).toEqual(['gpu-0']);
  });

  it('collectAndUpdate() processes samples into profiles', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    provider.setSamples([makeSample({ celsius: 72, fanRpm: 2000 })]);
    const updated = await authority.collectAndUpdate();
    expect(updated).toHaveLength(1);
    expect(updated[0].currentCelsius).toBe(72);
    expect(updated[0].fanRpm).toBe(2000);
  });

  it('tracks peak and min temperatures across readings', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([makeSample({ celsius: 60 })]);
    await authority.collectAndUpdate();

    provider.setSamples([makeSample({ celsius: 85 })]);
    await authority.collectAndUpdate();

    const profile = authority.getProfile('gpu-0');
    expect(profile.peakCelsius).toBe(85);
    expect(profile.minCelsius).toBe(60);
  });

  it('missing sensor is first-class with unknown state', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.registerDevice('gpu-0', 'gpu');

    provider.setSamples([makeSample({ sensorAvailable: false, celsius: 0 })]);
    await authority.collectAndUpdate();

    const profile = authority.getProfile('gpu-0');
    expect(profile.sensorAvailable).toBe(false);
    expect(profile.thermalState).toBe('unknown');
  });

  it('rejects impossible temperatures during collection', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    provider.setSamples([makeSample({ celsius: 200 })]);
    await expect(authority.collectAndUpdate()).rejects.toThrow(/Impossible temperature/);
  });
});
