import { describe, expect, it, beforeEach } from 'vitest';
import { generateRecommendations, resetRecommendationCounter } from '../src/recommendations.js';
import { makeProfile, TOU_PRICING } from './testHelpers.js';
import { createTestAuthority, registerGpu, registerCpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';

describe('recommendation engine', () => {
  beforeEach(() => {
    resetRecommendationCounter();
  });

  it('generates power limit recommendation when near maximum rated', () => {
    const profile = makeProfile({ currentWatts: 310, maximumRatedWatts: 320 });
    const recs = generateRecommendations([profile], [], { ratePerKwh: 0.12, currency: 'USD', billingModel: 'flat' });
    expect(recs.some((r) => r.action.includes('reducing power limit'))).toBe(true);
    expect(recs.every((r) => r.advisory === true)).toBe(true);
  });

  it('generates budget exceeded recommendation', () => {
    const recs = generateRecommendations(
      [],
      [{ id: 'cap', scope: 'platform', limitWatts: 500, currentWatts: 600, exceeded: true }],
      { ratePerKwh: 0.12, currency: 'USD', billingModel: 'flat' },
    );
    expect(recs.some((r) => r.action.includes('Reduce platform power'))).toBe(true);
  });

  it('generates off-peak delay recommendation during peak pricing', () => {
    const profile = makeProfile({ currentWatts: 250, idleWatts: 25 });
    const peakDate = new Date('2026-08-08T18:00:00');
    const recs = generateRecommendations([profile], [], TOU_PRICING, peakDate);
    expect(recs.some((r) => r.action.includes('off-peak'))).toBe(true);
  });

  it('generates efficiency shift recommendation between devices', () => {
    const efficient = makeProfile({
      deviceId: 'gpu-best',
      efficiencyProfile: { trend: 'stable', revenuePerKwh: 1.0 },
    });
    const inefficient = makeProfile({
      deviceId: 'gpu-worst',
      efficiencyProfile: { trend: 'stable', revenuePerKwh: 0.2 },
    });
    const recs = generateRecommendations([efficient, inefficient], [], {
      ratePerKwh: 0.12,
      currency: 'USD',
      billingModel: 'flat',
    });
    expect(recs.some((r) => r.action.includes('more efficient device'))).toBe(true);
  });

  it('generates declining efficiency investigation recommendation', () => {
    const profile = makeProfile({ efficiencyProfile: { trend: 'declining', hashesPerWatt: 8 } });
    const recs = generateRecommendations([profile], [], { ratePerKwh: 0.12, currency: 'USD', billingModel: 'flat' });
    expect(recs.some((r) => r.action.includes('declining efficiency'))).toBe(true);
  });

  it('PowerAuthority refreshRecommendations produces advisory recommendations', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority, 'gpu-1', 320);
    authority.setBudget('gpu-cap', 'gpu', 200);
    telemetry.setSamples([synthesizeSample('gpu-1', 310)]);
    await authority.collectAndUpdate();
    const recs = authority.getRecommendations();
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.advisory === true)).toBe(true);
  });

  it('recommendations never include hardware control execution methods', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    registerCpu(authority, 'cpu-1');
    telemetry.setSamples([
      synthesizeSample('gpu-1', 300),
      synthesizeSample('cpu-1', 100),
    ]);
    await authority.collectAndUpdate();
    const recs = authority.getRecommendations();
    for (const rec of recs) {
      expect(rec.action).not.toMatch(/execute|apply|set.*limit/i);
    }
  });
});
