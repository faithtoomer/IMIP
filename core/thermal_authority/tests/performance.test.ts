import { describe, expect, it } from 'vitest';
import { ThermalAuthority } from '../src/ThermalAuthority.js';
import { InjectableThermalSensorProvider } from '../src/sensors.js';
import { makeSample, makeSampleSeries } from './testHelpers.js';

describe('ITIA performance', () => {
  it('processes 100 devices within acceptable time', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    const samples = Array.from({ length: 100 }, (_, i) =>
      makeSample({
        deviceId: `gpu-${i}`,
        celsius: 60 + (i % 20),
        collectedAt: new Date().toISOString(),
      }),
    );
    provider.setSamples(samples);

    const start = performance.now();
    await authority.collectAndUpdate();
    const elapsed = performance.now() - start;

    expect(authority.registry.all()).toHaveLength(100);
    expect(elapsed).toBeLessThan(5000);
  });

  it('handles rapid sequential collections without data corruption', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    for (let i = 0; i < 50; i++) {
      provider.setSamples([makeSample({ celsius: 60 + i * 0.1 })]);
      await authority.collectAndUpdate();
    }

    const profile = authority.getProfile('gpu-0');
    expect(profile.currentCelsius).toBeCloseTo(64.9, 0);
    expect(authority.getHistory('gpu-0').length).toBe(50);
  });

  it('trend computation scales with history size', async () => {
    const provider = new InjectableThermalSensorProvider();
    const authority = new ThermalAuthority({ sensorProvider: provider });

    const baseTime = Date.now();
    for (let i = 0; i < 20; i++) {
      provider.setSamples([
        makeSample({
          celsius: 60 + i,
          collectedAt: new Date(baseTime + i * 60_000).toISOString(),
        }),
      ]);
      await authority.collectAndUpdate();
    }

    const trend = authority.getTrend('gpu-0');
    expect(trend).not.toBeNull();
    expect(trend!.slopeCelsiusPerMinute).toBeGreaterThan(0);
  });
});
