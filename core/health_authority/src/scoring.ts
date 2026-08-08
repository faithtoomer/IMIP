import { HealthValidationError } from './errors.js';
import type { HealthScore, HealthScoreWeights, HealthSignalMetrics, InstitutionalHealthStatus } from './types.js';

export const DEFAULT_HEALTH_SCORE_WEIGHTS: Readonly<HealthScoreWeights> = Object.freeze({
  reliability: 0.35,
  stability: 0.25,
  performance: 0.20,
  availability: 0.20,
});

/** Applies independently supplied source scores; it does not derive device or resource health metrics. */
export function computeHealthScore(metrics: HealthSignalMetrics, weights: HealthScoreWeights = DEFAULT_HEALTH_SCORE_WEIGHTS): HealthScore {
  validateWeights(weights);
  const fallback = metric(metrics.overallScore, undefined);
  const reliabilityScore = metric(metrics.reliabilityScore, fallback);
  const stabilityScore = metric(metrics.stabilityScore, fallback);
  const performanceScore = metric(metrics.performanceScore, fallback);
  const availabilityScore = metric(metrics.availabilityScore, fallback);
  if ([reliabilityScore, stabilityScore, performanceScore, availabilityScore].every((score) => score === undefined)) {
    throw new HealthValidationError('At least one published health score is required for assessment.');
  }
  const values = {
    reliability: reliabilityScore ?? 0,
    stability: stabilityScore ?? 0,
    performance: performanceScore ?? 0,
    availability: availabilityScore ?? 0,
  };
  const totalWeight = weights.reliability + weights.stability + weights.performance + weights.availability;
  const overallScore = clamp((
    values.reliability * weights.reliability
    + values.stability * weights.stability
    + values.performance * weights.performance
    + values.availability * weights.availability
  ) / totalWeight);
  return {
    overallScore,
    reliabilityScore: values.reliability,
    stabilityScore: values.stability,
    performanceScore: values.performance,
    availabilityScore: values.availability,
    status: healthStatusFor(overallScore),
  };
}

export function mergeHealthScoreWeights(overrides: Partial<HealthScoreWeights> = {}): HealthScoreWeights {
  const weights = { ...DEFAULT_HEALTH_SCORE_WEIGHTS, ...overrides };
  validateWeights(weights);
  return weights;
}

export function healthStatusFor(score: number): InstitutionalHealthStatus {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';
  return 'critical';
}

function metric(value: number | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new HealthValidationError(`Health scores must be finite values from 0 through 100; received ${value}.`);
  }
  return value;
}

function validateWeights(weights: HealthScoreWeights): void {
  const entries = Object.entries(weights) as Array<[keyof HealthScoreWeights, number]>;
  if (entries.some(([, value]) => !Number.isFinite(value) || value < 0)) {
    throw new HealthValidationError('Health score weights must be finite, non-negative numbers.');
  }
  if (entries.reduce((total, [, value]) => total + value, 0) <= 0) {
    throw new HealthValidationError('At least one health score weight must be greater than zero.');
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
