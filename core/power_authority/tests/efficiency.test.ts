import { describe, expect, it } from 'vitest';
import { computeEfficiency, computeEfficiencyTrend } from '../src/efficiency.js';

describe('efficiency engine', () => {
  it('computeEfficiency calculates hashes per watt', () => {
    const metrics = computeEfficiency(250, { hashesPerSecond: 2500 });
    expect(metrics.hashesPerWatt).toBe(10);
  });

  it('computeEfficiency calculates shares per kWh', () => {
    const metrics = computeEfficiency(1000, { acceptedShares: 5 });
    expect(metrics.sharesPerKwh).toBe(5);
  });

  it('computeEfficiency calculates revenue per kWh', () => {
    const metrics = computeEfficiency(500, { revenuePerHour: 0.5 });
    expect(metrics.revenuePerKwh).toBe(1);
  });

  it('computeEfficiency returns unknown trend with no previous data', () => {
    const metrics = computeEfficiency(250);
    expect(metrics.trend).toBe('unknown');
  });

  it('computeEfficiency preserves previous trend when provided', () => {
    const metrics = computeEfficiency(250, { hashesPerSecond: 2500 }, 'stable');
    expect(metrics.trend).toBe('stable');
  });

  it('computeEfficiency returns empty metrics for zero watts', () => {
    const metrics = computeEfficiency(0, { hashesPerSecond: 1000 });
    expect(metrics.hashesPerWatt).toBeUndefined();
  });

  it('computeEfficiencyTrend detects improving trend', () => {
    expect(computeEfficiencyTrend(12, 10)).toBe('improving');
  });

  it('computeEfficiencyTrend detects declining trend', () => {
    expect(computeEfficiencyTrend(8, 10)).toBe('declining');
  });

  it('computeEfficiencyTrend detects stable trend', () => {
    expect(computeEfficiencyTrend(10.2, 10)).toBe('stable');
  });

  it('computeEfficiencyTrend returns unknown with missing data', () => {
    expect(computeEfficiencyTrend(undefined, 10)).toBe('unknown');
    expect(computeEfficiencyTrend(10, undefined)).toBe('unknown');
  });
});
