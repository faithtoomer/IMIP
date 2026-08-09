import type { AnomalyRecord, DataQualityRejectionReason, StatisticsAggregate, StatisticsMetric } from './types.js';

export function explainMetric(metric: StatisticsMetric, rejectionReason?: DataQualityRejectionReason, anomalies: readonly AnomalyRecord[] = []) {
  const disposition = metric.collectionStatus === 'collected' ? 'accepted' : metric.collectionStatus;
  return Object.freeze({
    metricUuid: metric.metricUuid,
    disposition,
    collectionStatus: metric.collectionStatus,
    rationale: rejectionReason
      ? `Metric was rejected: ${rejectionReason}.`
      : anomalies.length > 0
        ? `Metric was quarantined because ${anomalies.map((anomaly) => anomaly.type).join(', ')} was detected.`
        : 'Metric was accepted after canonical data-quality validation.',
    rejectionReason,
    anomalies: [...anomalies],
  });
}

export function explainAggregate(aggregate: StatisticsAggregate) {
  return Object.freeze({
    aggregationLevel: aggregate.aggregationLevel,
    aggregationKey: aggregate.aggregationKey,
    metricType: aggregate.metricType,
    rationale: `Aggregate is the deterministic sum/average/minimum/maximum over ${aggregate.count} ordered canonical metrics.`,
    metricUuids: [...aggregate.metricUuids],
    sum: aggregate.sum,
    average: aggregate.average,
  });
}
