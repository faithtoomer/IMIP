import { describe, expect, it } from 'vitest';
import { ThermalAuthority } from '../src/ThermalAuthority.js';
import { InjectableThermalSensorProvider } from '../src/sensors.js';
import { MapPowerSnapshotProvider } from '../src/powerBridge.js';
import { makeSample } from './testHelpers.js';

describe('ThermalAuthority orchestrator', () => {
  it('full pipeline: register → collect → assess → twin', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({
      sensorProvider: provider,
      powerProvider: new MapPowerSnapshotProvider({ 'gpu-0': 280 }),
    });

    authority.registerDevice('gpu-0', 'gpu', 35);
    provider.setSamples([makeSample({ celsius: 72, fanRpm: 1800 })]);
    await authority.collectAndUpdate();

    const profile = authority.getProfile('gpu-0');
    expect(profile.currentCelsius).toBe(72);
    expect(profile.lifecycleStage).not.toBe('discovered');

    const twin = authority.getDigitalTwin('gpu-0');
    expect(twin.powerSnapshot?.watts).toBe(280);
    expect(twin.assessment.recommendations.every((r) => r.advisory)).toBe(true);
  });

  it('getMetrics() reflects last collection cycle', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    provider.setSamples([
      makeSample({ deviceId: 'gpu-0', celsius: 65 }),
      makeSample({ deviceId: 'gpu-1', celsius: 85, deviceType: 'gpu' }),
    ]);
    authority.setBudgetForDevice('gpu-1', {
      id: 'tight',
      scope: 'gpu-1',
      operatingTargetCelsius: 50,
      warningThresholdCelsius: 60,
      criticalThresholdCelsius: 70,
    });
    await authority.collectAndUpdate();

    const metrics = authority.getMetrics();
    expect(metrics.devicesMonitored).toBe(2);
    expect(metrics.devicesCritical).toBeGreaterThanOrEqual(1);
  });

  it('getForecast() returns forecast after sufficient history', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    const baseTime = Date.now();

    for (let i = 0; i < 5; i++) {
      provider.setSamples([
        makeSample({
          celsius: 60 + i * 2,
          collectedAt: new Date(baseTime + i * 60_000).toISOString(),
        }),
      ]);
      await authority.collectAndUpdate();
    }

    const forecast = authority.getForecast('gpu-0');
    expect(forecast).not.toBeNull();
    expect(forecast!.expectedCelsius).toBeGreaterThan(60);
  });

  it('getRecommendations() returns advisory recommendations', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });
    authority.setBudgetForDevice('gpu-0', {
      id: 'tight',
      scope: 'gpu-0',
      operatingTargetCelsius: 50,
      warningThresholdCelsius: 55,
      criticalThresholdCelsius: 60,
    });

    provider.setSamples([makeSample({ celsius: 58 })]);
    await authority.collectAndUpdate();

    const recs = authority.getRecommendations('gpu-0');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.advisory === true)).toBe(true);
  });

  it('getHistory() returns collected history points', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    provider.setSamples([makeSample({ celsius: 60 })]);
    await authority.collectAndUpdate();
    provider.setSamples([makeSample({ celsius: 65 })]);
    await authority.collectAndUpdate();

    const history = authority.getHistory('gpu-0');
    expect(history).toHaveLength(2);
  });
});
