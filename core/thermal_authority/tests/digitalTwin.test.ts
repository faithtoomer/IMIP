import { describe, expect, it } from 'vitest';
import {
  assembleDigitalTwin,
  devicesNearingWarning,
  estimateThermalImpactOfPowerReduction,
  degradationCandidates,
  platformThermalSummary,
} from '../src/digitalTwin.js';
import { NullPowerSnapshotProvider, MapPowerSnapshotProvider } from '../src/powerBridge.js';
import { createDefaultBudget } from '../src/budgets.js';
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

describe('Institutional Thermal Digital Twin (ITDT)', () => {
  it('assembleDigitalTwin() combines all subsystems', () => {
    const profile = makeProfile({ currentCelsius: 72 });
    const budget = createDefaultBudget('gpu');
    const history = makeHistoryPoints('gpu-0', [68, 70, 72]);
    const twin = assembleDigitalTwin({
      profile,
      trend: null,
      forecast: null,
      budget,
      anomalies: [],
      recommendations: [],
      history,
      powerProvider: new NullPowerSnapshotProvider(),
    });

    expect(twin.deviceId).toBe('gpu-0');
    expect(twin.profile).toBe(profile);
    expect(twin.historySummary.pointCount).toBe(3);
    expect(twin.assessment.evidence.length).toBeGreaterThan(0);
  });

  it('includes power snapshot when provider returns watts', () => {
    const twin = assembleDigitalTwin({
      profile: makeProfile(),
      trend: null,
      forecast: null,
      budget: createDefaultBudget('gpu'),
      anomalies: [],
      recommendations: [],
      history: [],
      powerProvider: new MapPowerSnapshotProvider({ 'gpu-0': 250 }),
    });
    expect(twin.powerSnapshot?.watts).toBe(250);
  });

  it('devicesNearingWarning() identifies devices within 5°C of warning', () => {
    const profiles = [
      makeProfile({ deviceId: 'a', currentCelsius: 79 }),
      makeProfile({ deviceId: 'b', currentCelsius: 50 }),
    ];
    const budgets = new Map([
      ['a', { ...createDefaultBudget('gpu'), warningThresholdCelsius: 83 }],
      ['b', { ...createDefaultBudget('gpu'), warningThresholdCelsius: 83 }],
    ]);
    const nearing = devicesNearingWarning(profiles, budgets);
    expect(nearing).toHaveLength(1);
    expect(nearing[0].deviceId).toBe('a');
  });

  it('estimateThermalImpactOfPowerReduction() reduces estimated temperature', () => {
    const estimated = estimateThermalImpactOfPowerReduction(80, 300, 200);
    expect(estimated).toBeLessThan(80);
    expect(estimated).toBeGreaterThan(0);
  });

  it('degradationCandidates() identifies warning devices and cooling anomalies', () => {
    const profiles = [makeProfile({ thermalState: 'warning' })];
    const anomalies = [
      {
        id: 'a1',
        kind: 'cooling-degradation' as const,
        deviceId: 'gpu-0',
        severity: 'medium' as const,
        evidence: {},
        detectedAt: new Date().toISOString(),
      },
    ];
    const candidates = degradationCandidates(profiles, anomalies);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('platformThermalSummary() aggregates platform state', () => {
    const profiles = [
      makeProfile({ currentCelsius: 60, thermalState: 'nominal' }),
      makeProfile({ deviceId: 'gpu-1', currentCelsius: 85, thermalState: 'warning' }),
      makeProfile({ deviceId: 'gpu-2', currentCelsius: 98, thermalState: 'critical', sensorAvailable: false }),
    ];
    const summary = platformThermalSummary(profiles);
    expect(summary.deviceCount).toBe(3);
    expect(summary.warningCount).toBe(1);
    expect(summary.criticalCount).toBe(1);
    expect(summary.sensorsUnavailable).toBe(1);
    expect(summary.peakCelsius).toBe(98);
  });
});
