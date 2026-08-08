import { describe, expect, it } from 'vitest';
import { MetricsCollector } from '../src/metrics.js';
import type { ThermalProfile } from '../src/types.js';

function makeProfile(overrides: Partial<ThermalProfile> = {}): ThermalProfile {
  return {
    deviceId: 'gpu-0',
    deviceType: 'gpu',
    currentCelsius: 65,
    thermalState: 'nominal',
    lifecycleStage: 'monitored',
    lastUpdated: new Date().toISOString(),
    sensorAvailable: true,
    ...overrides,
  };
}

describe('Thermal metrics', () => {
  it('records profile state counts', () => {
    const collector = new MetricsCollector();
    collector.recordProfile(makeProfile({ thermalState: 'nominal' }));
    collector.recordProfile(makeProfile({ deviceId: 'gpu-1', thermalState: 'warning', currentCelsius: 85 }));
    const metrics = collector.snapshot();
    expect(metrics.devicesMonitored).toBe(2);
    expect(metrics.devicesNominal).toBe(1);
    expect(metrics.devicesWarning).toBe(1);
  });

  it('tracks peak and average temperature', () => {
    const collector = new MetricsCollector();
    collector.recordProfile(makeProfile({ currentCelsius: 60 }));
    collector.recordProfile(makeProfile({ deviceId: 'gpu-1', currentCelsius: 80 }));
    const metrics = collector.snapshot();
    expect(metrics.peakTemperatureCelsius).toBe(80);
    expect(metrics.averageTemperatureCelsius).toBe(70);
  });

  it('tracks sensor unavailability', () => {
    const collector = new MetricsCollector();
    collector.recordProfile(makeProfile({ sensorAvailable: false }));
    expect(collector.snapshot().sensorsUnavailable).toBe(1);
  });

  it('reset() clears accumulated metrics', () => {
    const collector = new MetricsCollector();
    collector.recordProfile(makeProfile());
    collector.reset();
    expect(collector.snapshot().devicesMonitored).toBe(0);
  });
});
