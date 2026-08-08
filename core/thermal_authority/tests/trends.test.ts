import { describe, expect, it } from 'vitest';
import { computeTrend, linearRegressionSlope } from '../src/trends.js';
import { makeHistoryPoints } from './testHelpers.js';

describe('Thermal trends', () => {
  it('linearRegressionSlope() returns positive slope for rising temps', () => {
    const points = makeHistoryPoints('gpu-0', [60, 62, 64, 66, 68]);
    const slope = linearRegressionSlope(points);
    expect(slope).toBeGreaterThan(0);
  });

  it('linearRegressionSlope() returns negative slope for falling temps', () => {
    const points = makeHistoryPoints('gpu-0', [80, 78, 76, 74, 72]);
    const slope = linearRegressionSlope(points);
    expect(slope).toBeLessThan(0);
  });

  it('linearRegressionSlope() returns 0 for flat temps', () => {
    const points = makeHistoryPoints('gpu-0', [70, 70, 70, 70]);
    expect(linearRegressionSlope(points)).toBe(0);
  });

  it('linearRegressionSlope() returns 0 for single point', () => {
    const points = makeHistoryPoints('gpu-0', [70]);
    expect(linearRegressionSlope(points)).toBe(0);
  });

  it('computeTrend() includes heat accumulation rate for rising series', () => {
    const points = makeHistoryPoints('gpu-0', [60, 65, 70, 75]);
    const trend = computeTrend(points);
    expect(trend.heatAccumulationRate).toBeGreaterThan(0);
    expect(trend.window).toBe('15m');
  });

  it('computeTrend() includes cooling rate for falling series', () => {
    const points = makeHistoryPoints('gpu-0', [80, 75, 70, 65]);
    const trend = computeTrend(points);
    expect(trend.coolingRate).toBeGreaterThan(0);
  });

  it('computeTrend() detects cycling frequency in oscillating data', () => {
    const points = makeHistoryPoints('gpu-0', [70, 75, 70, 75, 70, 75]);
    const trend = computeTrend(points);
    expect(trend.cyclingFrequency).toBeGreaterThan(0);
  });
});
