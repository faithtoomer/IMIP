/** Canonical collection outcome; records are immutable snapshots after assignment. */
export type CollectionStatus = 'collected' | 'rejected' | 'quarantined';

export type AggregationLevel =
  | 'device'
  | 'workload'
  | 'miner-process'
  | 'plugin'
  | 'adapter-algorithm'
  | 'pool'
  | 'platform';

export type RollupGranularity = 'minute' | 'hour' | 'day' | 'week';

/**
 * The values are intentionally generic and extensible. IMSF receives already
 * normalized measurements; it does not translate miner-specific raw fields.
 */
export type StatisticMetricType =
  | 'hashrate-hps'
  | 'accepted-shares'
  | 'rejected-shares'
  | 'error-rate'
  | 'uptime-seconds'
  | 'pool-latency-ms'
  | 'temperature-celsius'
  | 'power-watts'
  | 'efficiency-hps-per-watt'
  | (string & {});

/** The institutional, immutable telemetry record. */
export interface StatisticsMetric {
  metricUuid: string;
  timestamp: string;
  sourceIdentifier: string;
  workloadUuid: string;
  adapterUuid: string;
  minerProcessUuid?: string;
  hardwareIdentifier: string;
  resourceUuid?: string;
  pluginUuid?: string;
  algorithmIdentifier: string;
  poolIdentifier?: string;
  metricType: StatisticMetricType;
  value: number;
  unit: string;
  confidenceScore: number;
  collectionStatus: CollectionStatus;
  /** Stable producer event key. Supplying it makes repeated delivery idempotent. */
  ingestionId?: string;
}

/** Input to canonical construction. UUID and final status are assigned by IMSF. */
export interface StatisticsMetricInput extends Omit<StatisticsMetric, 'metricUuid' | 'collectionStatus'> {
  metricUuid?: string;
  collectionStatus?: CollectionStatus;
}

export enum DataQualityRejectionReason {
  NegativeHashrate = 'negative-hashrate',
  NonFiniteValue = 'non-finite-value',
  ConfidenceOutOfRange = 'confidence-out-of-range',
  DecreasingShareCount = 'decreasing-share-count',
  NegativeValue = 'negative-value',
  InvalidTimestamp = 'invalid-timestamp',
  MissingRequiredField = 'missing-required-field',
}

export type AnomalyType =
  | 'hashrate-drop'
  | 'hashrate-spike'
  | 'share-rejection-rate-spike'
  | 'efficiency-anomaly';

export interface AnomalyRecord {
  anomalyUuid: string;
  metricUuid: string;
  type: AnomalyType;
  detectedAt: string;
  observedValue: number;
  baselineValue?: number;
  threshold: number;
  rationale: string;
  quarantined: true;
}

export interface StatisticsAggregate {
  aggregationLevel: AggregationLevel;
  aggregationKey: string;
  metricType: StatisticMetricType;
  unit: string;
  count: number;
  sum: number;
  average: number;
  minimum: number;
  maximum: number;
  latestValue: number;
  latestTimestamp: string;
  metricUuids: string[];
}

export interface StatisticsRollup extends StatisticsAggregate {
  rollupUuid: string;
  granularity: RollupGranularity;
  bucketStart: string;
  bucketEnd: string;
  computedAt: string;
}

export interface StatisticsMetricQuery {
  metricUuid?: string;
  sourceIdentifier?: string;
  workloadUuid?: string;
  adapterUuid?: string;
  minerProcessUuid?: string;
  hardwareIdentifier?: string;
  pluginUuid?: string;
  algorithmIdentifier?: string;
  poolIdentifier?: string;
  metricType?: StatisticMetricType;
  collectionStatus?: CollectionStatus;
  since?: string;
  until?: string;
}

export interface AnomalyDetectionConfiguration {
  rollingWindowSize: number;
  /** Candidate/baseline ratio at or below which a drop is flagged. */
  hashrateDropRatio: number;
  /** Candidate/baseline ratio at or above which a spike is flagged. */
  hashrateSpikeRatio: number;
  /** Rejected / (accepted + rejected) threshold. */
  shareRejectionRateThreshold: number;
  /** Absolute proportional difference from baseline that flags efficiency. */
  efficiencyDeviationRatio: number;
}

export interface MetricIngestionResult {
  metric: StatisticsMetric;
  accepted: boolean;
  rejectionReason?: DataQualityRejectionReason;
  anomalies: AnomalyRecord[];
}
