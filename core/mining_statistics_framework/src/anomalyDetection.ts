import type { AnomalyDetectionConfiguration, AnomalyRecord, StatisticsMetric } from './types.js';
import { compareMetrics } from './registry.js';

export const DEFAULT_ANOMALY_DETECTION_CONFIGURATION: AnomalyDetectionConfiguration = Object.freeze({
  rollingWindowSize: 5,
  hashrateDropRatio: 0.5,
  hashrateSpikeRatio: 1.5,
  shareRejectionRateThreshold: 0.1,
  efficiencyDeviationRatio: 0.25,
});

export function detectAnomalies(
  candidate: StatisticsMetric,
  context: readonly StatisticsMetric[],
  detectedAt: string,
  createUuid: () => string,
  configuration: AnomalyDetectionConfiguration = DEFAULT_ANOMALY_DETECTION_CONFIGURATION,
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  const baseline = rollingBaseline(candidate, context, configuration.rollingWindowSize);

  if (candidate.metricType === 'hashrate-hps' && baseline !== undefined && baseline > 0) {
    const ratio = candidate.value / baseline;
    if (ratio <= configuration.hashrateDropRatio) anomalies.push(anomaly('hashrate-drop', candidate, detectedAt, baseline, configuration.hashrateDropRatio, createUuid, `Hashrate ${candidate.value} H/s is ${(ratio * 100).toFixed(2)}% of rolling baseline ${baseline} H/s.`));
    if (ratio >= configuration.hashrateSpikeRatio) anomalies.push(anomaly('hashrate-spike', candidate, detectedAt, baseline, configuration.hashrateSpikeRatio, createUuid, `Hashrate ${candidate.value} H/s is ${(ratio * 100).toFixed(2)}% of rolling baseline ${baseline} H/s.`));
  }

  if (candidate.metricType === 'efficiency-hps-per-watt' && baseline !== undefined && baseline > 0) {
    const deviation = Math.abs(candidate.value - baseline) / baseline;
    if (deviation >= configuration.efficiencyDeviationRatio) anomalies.push(anomaly('efficiency-anomaly', candidate, detectedAt, baseline, configuration.efficiencyDeviationRatio, createUuid, `Efficiency differs from rolling baseline by ${(deviation * 100).toFixed(2)}%.`));
  }

  if (candidate.metricType === 'accepted-shares' || candidate.metricType === 'rejected-shares') {
    const rate = rejectionRate(candidate, context);
    if (rate !== undefined && rate >= configuration.shareRejectionRateThreshold) {
      anomalies.push(anomaly('share-rejection-rate-spike', candidate, detectedAt, undefined, configuration.shareRejectionRateThreshold, createUuid, `Share rejection rate ${(rate * 100).toFixed(2)}% meets or exceeds ${(configuration.shareRejectionRateThreshold * 100).toFixed(2)}%.`, rate));
    }
  }
  return anomalies;
}

function rollingBaseline(candidate: StatisticsMetric, context: readonly StatisticsMetric[], windowSize: number): number | undefined {
  const prior = context
    .filter((metric) => metric.metricUuid !== candidate.metricUuid && metric.collectionStatus !== 'rejected' && metric.sourceIdentifier === candidate.sourceIdentifier && metric.metricType === candidate.metricType && metric.timestamp <= candidate.timestamp)
    .sort(compareMetrics)
    .slice(-Math.max(1, windowSize));
  if (prior.length === 0) return undefined;
  return prior.reduce((sum, metric) => sum + metric.value, 0) / prior.length;
}

function rejectionRate(candidate: StatisticsMetric, context: readonly StatisticsMetric[]): number | undefined {
  const pair = context.filter((metric) => metric.collectionStatus !== 'rejected' && metric.sourceIdentifier === candidate.sourceIdentifier && metric.timestamp === candidate.timestamp && (metric.metricType === 'accepted-shares' || metric.metricType === 'rejected-shares'));
  const accepted = pair.find((metric) => metric.metricType === 'accepted-shares')?.value;
  const rejected = pair.find((metric) => metric.metricType === 'rejected-shares')?.value;
  if (accepted === undefined || rejected === undefined || accepted + rejected <= 0) return undefined;
  return rejected / (accepted + rejected);
}

function anomaly(type: AnomalyRecord['type'], metric: StatisticsMetric, detectedAt: string, baselineValue: number | undefined, threshold: number, createUuid: () => string, rationale: string, observedValue = metric.value): AnomalyRecord {
  return Object.freeze({ anomalyUuid: createUuid(), metricUuid: metric.metricUuid, type, detectedAt, observedValue, baselineValue, threshold, rationale, quarantined: true });
}
