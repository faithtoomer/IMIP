import { DataQualityRejectionReason, type StatisticsMetric } from './types.js';

export interface DataQualityResult {
  accepted: boolean;
  reason?: DataQualityRejectionReason;
  rationale: string;
}

const SHARE_TYPES = new Set(['accepted-shares', 'rejected-shares']);
const NON_NEGATIVE_TYPES = new Set([
  'hashrate-hps', 'accepted-shares', 'rejected-shares', 'uptime-seconds', 'pool-latency-ms', 'power-watts', 'efficiency-hps-per-watt',
]);

/** Deterministic plausibility checks over already-normalized canonical values. */
export function validateDataQuality(metric: StatisticsMetric, previousShareMetric?: StatisticsMetric): DataQualityResult {
  if (!metric.sourceIdentifier || !metric.workloadUuid || !metric.adapterUuid || !metric.hardwareIdentifier || !metric.algorithmIdentifier || !metric.metricType || !metric.unit) {
    return { accepted: false, reason: DataQualityRejectionReason.MissingRequiredField, rationale: 'Canonical metric identity and semantic fields are required.' };
  }
  if (!Number.isFinite(metric.value)) {
    return { accepted: false, reason: DataQualityRejectionReason.NonFiniteValue, rationale: 'Metric value must be a finite number; NaN and Infinity are rejected.' };
  }
  if (!Number.isFinite(metric.confidenceScore) || metric.confidenceScore < 0 || metric.confidenceScore > 1) {
    return { accepted: false, reason: DataQualityRejectionReason.ConfidenceOutOfRange, rationale: 'Confidence score must be a finite value in the inclusive range [0, 1].' };
  }
  if (Number.isNaN(Date.parse(metric.timestamp))) {
    return { accepted: false, reason: DataQualityRejectionReason.InvalidTimestamp, rationale: 'Metric timestamp must be a valid ISO-compatible instant.' };
  }
  if (metric.metricType === 'hashrate-hps' && metric.value < 0) {
    return { accepted: false, reason: DataQualityRejectionReason.NegativeHashrate, rationale: 'Hashrate cannot be negative.' };
  }
  if (NON_NEGATIVE_TYPES.has(metric.metricType) && metric.value < 0) {
    return { accepted: false, reason: DataQualityRejectionReason.NegativeValue, rationale: `${metric.metricType} cannot be negative.` };
  }
  if (SHARE_TYPES.has(metric.metricType) && previousShareMetric && metric.value < previousShareMetric.value) {
    return {
      accepted: false,
      reason: DataQualityRejectionReason.DecreasingShareCount,
      rationale: `Cumulative ${metric.metricType} decreased from ${previousShareMetric.value} to ${metric.value}.`,
    };
  }
  return { accepted: true, rationale: 'Metric satisfies deterministic canonical plausibility checks.' };
}

export function isShareMetric(metric: StatisticsMetric): boolean {
  return SHARE_TYPES.has(metric.metricType);
}
