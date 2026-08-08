import { describe, expect, it } from 'vitest';
import { ThermalAuthority } from '../src/ThermalAuthority.js';
import { InjectableThermalSensorProvider } from '../src/sensors.js';
import { THERMAL_EVENTS } from '../src/events.js';
import { makeSample } from './testHelpers.js';

describe('ITIA events (§15)', () => {
  it('publishes ThermalProfileCreated on registerDevice()', () => {
    const authority = new ThermalAuthority();
    let payload: unknown;
    authority.subscribe(THERMAL_EVENTS.ThermalProfileCreated, (p) => {
      payload = p;
    });
    authority.registerDevice('gpu-0', 'gpu');
    expect(payload).toEqual({ deviceId: 'gpu-0', deviceType: 'gpu' });
  });

  it('publishes TemperatureUpdated on collectAndUpdate()', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    provider.setSamples([makeSample({ celsius: 72 })]);

    let payload: unknown;
    authority.subscribe(THERMAL_EVENTS.TemperatureUpdated, (p) => {
      payload = p;
    });
    await authority.collectAndUpdate();
    expect(payload).toMatchObject({ deviceId: 'gpu-0', celsius: 72 });
  });

  it('publishes ThermalWarning when exceeding warning threshold', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.setBudgetForDevice('gpu-0', {
      id: 'tight',
      scope: 'gpu-0',
      operatingTargetCelsius: 50,
      warningThresholdCelsius: 60,
      criticalThresholdCelsius: 70,
    });

    let warned = false;
    authority.subscribe(THERMAL_EVENTS.ThermalWarning, () => {
      warned = true;
    });

    provider.setSamples([makeSample({ celsius: 65 })]);
    await authority.collectAndUpdate();
    expect(warned).toBe(true);
  });

  it('publishes ThermalCritical when exceeding critical threshold', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.setBudgetForDevice('gpu-0', {
      id: 'tight',
      scope: 'gpu-0',
      operatingTargetCelsius: 50,
      warningThresholdCelsius: 60,
      criticalThresholdCelsius: 65,
    });

    let critical = false;
    authority.subscribe(THERMAL_EVENTS.ThermalCritical, () => {
      critical = true;
    });

    provider.setSamples([makeSample({ celsius: 68 })]);
    await authority.collectAndUpdate();
    expect(critical).toBe(true);
  });

  it('publishes ThermalRecovered when returning from warning to nominal', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.setBudgetForDevice('gpu-0', {
      id: 'tight',
      scope: 'gpu-0',
      operatingTargetCelsius: 50,
      warningThresholdCelsius: 60,
      criticalThresholdCelsius: 70,
    });

    provider.setSamples([makeSample({ celsius: 65 })]);
    await authority.collectAndUpdate();

    let recovered = false;
    authority.subscribe(THERMAL_EVENTS.ThermalRecovered, () => {
      recovered = true;
    });

    provider.setSamples([makeSample({ celsius: 55 })]);
    await authority.collectAndUpdate();
    expect(recovered).toBe(true);
  });

  it('publishes ThermalAnomalyDetected for sensor failures', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.registerDevice('gpu-0', 'gpu');

    let anomalyEvent = false;
    authority.subscribe(THERMAL_EVENTS.ThermalAnomalyDetected, () => {
      anomalyEvent = true;
    });

    provider.setSamples([makeSample({ sensorAvailable: false })]);
    await authority.collectAndUpdate();
    expect(anomalyEvent).toBe(true);
  });

  it('subscribe() returns a working unsubscribe function', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    let count = 0;
    const unsubscribe = authority.subscribe(THERMAL_EVENTS.TemperatureUpdated, () => {
      count += 1;
    });

    provider.setSamples([makeSample({ celsius: 60 })]);
    await authority.collectAndUpdate();
    const afterFirst = count;
    expect(afterFirst).toBeGreaterThan(0);

    unsubscribe();
    provider.setSamples([makeSample({ celsius: 65 })]);
    await authority.collectAndUpdate();
    expect(count).toBe(afterFirst);
  });
});
