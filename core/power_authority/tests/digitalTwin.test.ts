import { describe, expect, it } from 'vitest';
import {
  assembleEnergyDigitalTwin,
  estimateCostImpactOfPowerReduction,
  platformEnergySummary,
  rankByRevenuePerKwh,
  efficiencyTrendFromHistory,
} from '../src/digitalTwin.js';
import { PowerHistoryStore } from '../src/history.js';
import { createTestAuthority, makeProfile, registerGpu, registerCpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';
import { FLAT_PRICING } from './testHelpers.js';

describe('Energy Digital Twin (IEDT)', () => {
  it('assembleEnergyDigitalTwin combines profile, pricing, budgets, recommendations', () => {
    const profile = makeProfile();
    const twin = assembleEnergyDigitalTwin(profile, FLAT_PRICING, [], [], 'stable');
    expect(twin.deviceId).toBe('gpu-1');
    expect(twin.profile).toBe(profile);
    expect(twin.pricing).toBe(FLAT_PRICING);
    expect(twin.historyTrend).toBe('stable');
  });

  it('rankByRevenuePerKwh sorts descending', () => {
    const profiles = [
      makeProfile({ deviceId: 'a', efficiencyProfile: { trend: 'stable', revenuePerKwh: 0.3 } }),
      makeProfile({ deviceId: 'b', efficiencyProfile: { trend: 'stable', revenuePerKwh: 0.8 } }),
      makeProfile({ deviceId: 'c', efficiencyProfile: { trend: 'stable', revenuePerKwh: 0.5 } }),
    ];
    const ranked = rankByRevenuePerKwh(profiles);
    expect(ranked.map((p) => p.deviceId)).toEqual(['b', 'c', 'a']);
  });

  it('estimateCostImpactOfPowerReduction calculates savings', () => {
    const profile = makeProfile({ averageWatts: 300, costProfile: { ...makeProfile().costProfile, ratePerKwh: 0.12 } });
    const impact = estimateCostImpactOfPowerReduction(profile, 100, FLAT_PRICING);
    expect(impact.newAverageWatts).toBe(200);
    expect(impact.savedCostPerHour).toBeCloseTo(0.012);
    expect(impact.savedCostPerDay).toBeCloseTo(0.288);
  });

  it('platformEnergySummary aggregates all profiles', () => {
    const profiles = [
      makeProfile({ deviceId: 'gpu-1', currentWatts: 250, averageWatts: 240, peakWatts: 280 }),
      makeProfile({ deviceId: 'cpu-1', currentWatts: 65, averageWatts: 60, peakWatts: 80 }),
    ];
    const summary = platformEnergySummary(profiles);
    expect(summary.totalCurrentWatts).toBe(315);
    expect(summary.deviceCount).toBe(2);
    expect(summary.estimatedCostPerHour).toBeGreaterThan(0);
  });

  it('efficiencyTrendFromHistory returns unknown with insufficient data', () => {
    const store = new PowerHistoryStore();
    expect(efficiencyTrendFromHistory(store, 'gpu-1')).toBe('unknown');
  });

  it('efficiencyTrendFromHistory detects improving trend when power decreases', () => {
    const store = new PowerHistoryStore();
    for (let i = 0; i < 10; i++) {
      store.append({ deviceId: 'gpu-1', watts: 300 - i * 10, timestamp: `2026-08-08T${String(i).padStart(2, '0')}:00:00Z` });
    }
    expect(efficiencyTrendFromHistory(store, 'gpu-1', 3000)).toBe('improving');
  });
});

describe('PowerAuthority IEDT queries', () => {
  it('getDigitalTwin returns assembled twin', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 250)]);
    await authority.collectAndUpdate();
    const twin = authority.getDigitalTwin('gpu-1');
    expect(twin.deviceId).toBe('gpu-1');
    expect(twin.profile.currentWatts).toBe(250);
  });

  it('getPlatformEnergySummary returns platform totals', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    registerCpu(authority, 'cpu-1');
    telemetry.setSamples([
      synthesizeSample('gpu-1', 250),
      synthesizeSample('cpu-1', 65, { deviceId: 'cpu-1' }),
    ]);
    await authority.collectAndUpdate();
    const summary = authority.getPlatformEnergySummary();
    expect(summary.deviceCount).toBe(2);
    expect(summary.totalCurrentWatts).toBe(315);
  });

  it('rankByRevenuePerKwh delegates to digital twin helper', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority, 'gpu-1');
    registerGpu(authority, 'gpu-2');
    authority.setWorkloadTelemetry('gpu-1', { revenuePerHour: 1.0 });
    authority.setWorkloadTelemetry('gpu-2', { revenuePerHour: 0.3 });
    telemetry.setSamples([
      synthesizeSample('gpu-1', 500),
      synthesizeSample('gpu-2', 500, { deviceId: 'gpu-2' }),
    ]);
    await authority.collectAndUpdate();
    const ranked = authority.rankByRevenuePerKwh();
    expect(ranked[0].deviceId).toBe('gpu-1');
  });

  it('estimateCostImpactOfPowerReduction via authority API', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 300)]);
    await authority.collectAndUpdate();
    const impact = authority.estimateCostImpactOfPowerReduction('gpu-1', 100);
    expect(impact.savedCostPerHour).toBeGreaterThan(0);
  });
});
