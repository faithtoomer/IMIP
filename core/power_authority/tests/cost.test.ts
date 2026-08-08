import { describe, expect, it } from 'vitest';
import { computeCostProfile, sessionCostFromWatts, wattsToKwh, wattHoursToKwh, costFromKwh } from '../src/cost.js';
import { PowerCostError } from '../src/errors.js';
import { FLAT_PRICING, TOU_PRICING } from './testHelpers.js';
import { resolveEffectiveRate } from '../src/pricing.js';

describe('cost engine', () => {
  it('wattHoursToKwh converts correctly', () => {
    expect(wattHoursToKwh(1000)).toBe(1);
    expect(wattHoursToKwh(500)).toBe(0.5);
  });

  it('wattsToKwh converts power over time', () => {
    expect(wattsToKwh(1000, 1)).toBe(1);
    expect(wattsToKwh(500, 2)).toBe(1);
  });

  it('costFromKwh multiplies rate by kWh', () => {
    expect(costFromKwh(10, 0.12)).toBeCloseTo(1.2);
  });

  it('costFromKwh rejects negative values', () => {
    expect(() => costFromKwh(-1, 0.12)).toThrow(PowerCostError);
  });

  it('computeCostProfile calculates hourly and daily cost', () => {
    const profile = computeCostProfile(1000, FLAT_PRICING);
    expect(profile.costPerHour).toBeCloseTo(0.12);
    expect(profile.costPerDay).toBeCloseTo(2.88);
    expect(profile.currency).toBe('USD');
    expect(profile.pricingWindow).toBe('flat');
  });

  it('computeCostProfile uses peak rate for time-of-use during peak hours', () => {
    const peakDate = new Date('2026-08-08T18:00:00');
    const profile = computeCostProfile(1000, TOU_PRICING, peakDate);
    expect(profile.ratePerKwh).toBe(0.25);
    expect(profile.pricingWindow).toBe('peak');
  });

  it('computeCostProfile uses off-peak rate during off-peak hours', () => {
    const offPeakDate = new Date('2026-08-08T03:00:00');
    const profile = computeCostProfile(1000, TOU_PRICING, offPeakDate);
    expect(profile.ratePerKwh).toBe(0.08);
    expect(profile.pricingWindow).toBe('off-peak');
  });

  it('sessionCostFromWatts calculates session cost', () => {
    const cost = sessionCostFromWatts(500, 4, FLAT_PRICING);
    expect(cost).toBeCloseTo(0.24);
  });

  it('resolveEffectiveRate returns flat rate for flat billing', () => {
    expect(resolveEffectiveRate(FLAT_PRICING)).toBe(0.12);
  });
});
