import { describe, expect, it } from 'vitest';
import { HealthAuthority } from '../src/HealthAuthority.js';
import { HealthValidationError } from '../src/errors.js';
import { computeHealthScore, mergeHealthScoreWeights } from '../src/scoring.js';
import { makeObservation } from './testHelpers.js';

describe('IHIA health scoring', () => {
  it('calculates the default weighted composite and all four published sub-scores', () => {
    const score = computeHealthScore({ reliabilityScore: 100, stabilityScore: 80, performanceScore: 60, availabilityScore: 40 });
    expect(score).toMatchObject({ overallScore: 75, reliabilityScore: 100, stabilityScore: 80, performanceScore: 60, availabilityScore: 40, status: 'warning' });
  });

  it('uses a published overall score as a source-provided fallback for sub-scores', () => {
    const score = computeHealthScore({ overallScore: 84 });
    expect(score).toMatchObject({ overallScore: 84, reliabilityScore: 84, stabilityScore: 84, performanceScore: 84, availabilityScore: 84, status: 'healthy' });
  });

  it('accepts injectable/configurable weights rather than baking the formula into the authority', () => {
    const authority = new HealthAuthority({ weights: { reliability: 1, stability: 0, performance: 0, availability: 0 }, now: () => '2026-08-08T12:00:00.000Z' });
    const profile = authority.assess(makeObservation({ metrics: { reliabilityScore: 91, stabilityScore: 10, performanceScore: 10, availabilityScore: 10 } }));
    expect(profile.currentHealth.overallScore).toBe(91);
    expect(authority.setWeights({ reliability: 0, availability: 1 }).availability).toBe(1);
    expect(authority.getWeights()).toMatchObject({ reliability: 0, availability: 1 });
  });

  it('rejects absent score evidence and invalid weights', () => {
    expect(() => computeHealthScore({})).toThrow(HealthValidationError);
    expect(() => computeHealthScore({ overallScore: 101 })).toThrow(/0 through 100/);
    expect(() => mergeHealthScoreWeights({ reliability: 0, stability: 0, performance: 0, availability: 0 })).toThrow(/greater than zero/);
  });
});
