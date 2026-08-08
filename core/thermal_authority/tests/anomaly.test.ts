import { describe, expect, it, beforeEach } from 'vitest';
import { detectAnomalies, resetAnomalyCounter } from '../src/anomaly.js';
import type { ThermalProfile } from '../src/types.js';
import { makeHistoryPoints } from './testHelpers.js';

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

describe('Thermal anomaly detection', () => {
  beforeEach(() => resetAnomalyCounter());

  it('detects sensor failure when sensor unavailable', () => {
    const anomalies = detectAnomalies({
      profile: makeProfile({ sensorAvailable: false }),
      history: [],
    });
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe('sensor-failure');
    expect(anomalies[0].severity).toBe('high');
  });

  it('detects temperature spike', () => {
    const previous = makeProfile({ currentCelsius: 60 });
    const current = makeProfile({ currentCelsius: 80 });
    const anomalies = detectAnomalies({ profile: current, history: [], previousProfile: previous });
    expect(anomalies.some((a) => a.kind === 'temperature-spike')).toBe(true);
  });

  it('detects unexpected idle temperature', () => {
    const anomalies = detectAnomalies({
      profile: makeProfile({ currentCelsius: 70, idleCelsius: 35, fanRpm: 500 }),
      history: [],
    });
    expect(anomalies.some((a) => a.kind === 'unexpected-idle-temp')).toBe(true);
  });

  it('detects oscillation in history', () => {
    const history = makeHistoryPoints('gpu-0', [70, 75, 70, 75, 70, 75]);
    const anomalies = detectAnomalies({
      profile: makeProfile(),
      history,
    });
    expect(anomalies.some((a) => a.kind === 'oscillation')).toBe(true);
  });

  it('detects fan anomaly when fan speed low at high temp', () => {
    const anomalies = detectAnomalies({
      profile: makeProfile({ currentCelsius: 80, fanRpm: 300, thermalState: 'warning' }),
      history: [],
    });
    expect(anomalies.some((a) => a.kind === 'fan-anomaly')).toBe(true);
  });

  it('detects abnormal heating during warning state', () => {
    const history = makeHistoryPoints('gpu-0', [78, 80, 82]);
    const anomalies = detectAnomalies({
      profile: makeProfile({ currentCelsius: 82, thermalState: 'warning' }),
      history,
    });
    expect(anomalies.some((a) => a.kind === 'abnormal-heating')).toBe(true);
  });

  it('detects cooling degradation from trend data', () => {
    const anomalies = detectAnomalies({
      profile: makeProfile({ thermalState: 'elevated' }),
      history: makeHistoryPoints('gpu-0', [70, 72, 74]),
      trend: {
        slopeCelsiusPerMinute: 0.5,
        heatAccumulationRate: 1.0,
        coolingRate: 0.1,
        cyclingFrequency: 0,
        window: '15m',
      },
    });
    expect(anomalies.some((a) => a.kind === 'cooling-degradation')).toBe(true);
  });

  it('returns empty array for normal operation', () => {
    const anomalies = detectAnomalies({
      profile: makeProfile({ currentCelsius: 65 }),
      history: makeHistoryPoints('gpu-0', [64, 65, 65]),
    });
    expect(anomalies).toHaveLength(0);
  });
});
