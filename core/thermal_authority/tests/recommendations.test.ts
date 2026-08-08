import { describe, expect, it, beforeEach } from 'vitest';
import { generateRecommendations, resetRecommendationCounter } from '../src/recommendations.js';
import { createDefaultBudget } from '../src/budgets.js';
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

describe('Thermal recommendations (advisory only)', () => {
  beforeEach(() => resetRecommendationCounter());

  it('all recommendations have advisory: true', () => {
    const recs = generateRecommendations({
      profile: makeProfile({ thermalState: 'warning', currentCelsius: 85 }),
      budget: createDefaultBudget('gpu'),
      forecast: null,
      trend: null,
      anomalies: [],
      generatedAt: new Date().toISOString(),
    });
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec.advisory).toBe(true);
    }
  });

  it('recommends sensor investigation when unavailable', () => {
    const recs = generateRecommendations({
      profile: makeProfile({ sensorAvailable: false }),
      budget: createDefaultBudget('gpu'),
      forecast: null,
      trend: null,
      anomalies: [],
      generatedAt: new Date().toISOString(),
    });
    expect(recs[0].action).toMatch(/sensor/i);
  });

  it('recommends workload reduction at critical state', () => {
    const recs = generateRecommendations({
      profile: makeProfile({ thermalState: 'critical', currentCelsius: 98 }),
      budget: createDefaultBudget('gpu'),
      forecast: null,
      trend: null,
      anomalies: [],
      generatedAt: new Date().toISOString(),
    });
    expect(recs.some((r) => r.action.match(/reduce workload/i))).toBe(true);
  });

  it('recommends monitoring at warning state', () => {
    const recs = generateRecommendations({
      profile: makeProfile({ thermalState: 'warning', currentCelsius: 84 }),
      budget: createDefaultBudget('gpu'),
      forecast: null,
      trend: null,
      anomalies: [],
      generatedAt: new Date().toISOString(),
    });
    expect(recs.some((r) => r.action.match(/reducing workload|airflow/i))).toBe(true);
  });

  it('includes forecast-based cooling recommendation', () => {
    const recs = generateRecommendations({
      profile: makeProfile(),
      budget: createDefaultBudget('gpu'),
      forecast: {
        expectedCelsius: 80,
        coolingRequirementNote: 'Warning threshold may be reached soon.',
        generatedAt: new Date().toISOString(),
      },
      trend: null,
      anomalies: [],
      generatedAt: new Date().toISOString(),
    });
    expect(recs.some((r) => r.rationale.match(/Warning threshold/i))).toBe(true);
  });

  it('recommends fan inspection for fan anomalies', () => {
    const recs = generateRecommendations({
      profile: makeProfile({ currentCelsius: 80, fanRpm: 200 }),
      budget: createDefaultBudget('gpu'),
      forecast: null,
      trend: null,
      anomalies: [
        {
          id: 'a1',
          kind: 'fan-anomaly',
          deviceId: 'gpu-0',
          severity: 'high',
          evidence: { fanRpm: 200 },
          detectedAt: new Date().toISOString(),
        },
      ],
      generatedAt: new Date().toISOString(),
    });
    expect(recs.some((r) => r.action.match(/fan/i))).toBe(true);
  });
});
