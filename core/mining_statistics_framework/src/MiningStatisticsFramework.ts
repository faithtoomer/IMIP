import type { NormalizedStatistics } from '../../mining_adapter_framework/src/types.js';
import { aggregateMetrics } from './aggregation.js';
import { DEFAULT_ANOMALY_DETECTION_CONFIGURATION, detectAnomalies } from './anomalyDetection.js';
import { validateDataQuality } from './dataQuality.js';
import { MiningStatisticsEventBus, MINING_STATISTICS_EVENTS } from './events.js';
import { explainAggregate, explainMetric } from './explainability.js';
import type { MiningStatisticsFrameworkDependencies } from './providers.js';
import { StatisticsRegistry } from './registry.js';
import { computeRollups, delegateRollupArchive, persistAndRetainRollups } from './rollups.js';
import { StatisticsSchema } from './schema.js';
import { InstitutionalMiningTelemetryGraph } from './telemetryGraph.js';
import type { AggregationLevel, AnomalyDetectionConfiguration, MetricIngestionResult, RollupGranularity, StatisticsMetric, StatisticsMetricInput, StatisticsMetricQuery, StatisticsRollup } from './types.js';

export interface NormalizedStatisticsContext {
  timestamp?: string;
  sourceIdentifier: string;
  workloadUuid: string;
  adapterUuid: string;
  minerProcessUuid?: string;
  hardwareIdentifier: string;
  resourceUuid?: string;
  pluginUuid?: string;
  algorithmIdentifier: string;
  poolIdentifier?: string;
  confidenceScore?: number;
  ingestionIdPrefix?: string;
}

/**
 * IMSF is the platform's institutional statistics authority. It deliberately
 * accepts values already normalized by an adapter/process path and only adds
 * canonical schema, quality, anomaly, aggregate, rollup, persistence, and traceability concerns.
 */
export class MiningStatisticsFramework {
  readonly registry = new StatisticsRegistry();
  readonly events: MiningStatisticsEventBus;
  readonly graph = new InstitutionalMiningTelemetryGraph();
  private readonly schema: StatisticsSchema;
  private readonly anomaliesByMetric = new Map<string, readonly import('./types.js').AnomalyRecord[]>();
  private readonly qualityByMetric = new Map<string, import('./types.js').DataQualityRejectionReason | undefined>();
  private counter = 0;
  private readonly configuration: AnomalyDetectionConfiguration;

  constructor(private readonly dependencies: MiningStatisticsFrameworkDependencies, configuration: Partial<AnomalyDetectionConfiguration> = {}, eventBus?: import('../../event_bus/src/index.js').InstitutionalEventBus) {
    this.schema = new StatisticsSchema(dependencies.clock, () => this.nextUuid());
    this.events = new MiningStatisticsEventBus(eventBus);
    this.configuration = Object.freeze({ ...DEFAULT_ANOMALY_DETECTION_CONFIGURATION, ...configuration });
  }

  ingest(input: StatisticsMetricInput): MetricIngestionResult { return this.ingestBatch([input])[0]!; }

  /** Batch handling preserves cross-field observations (such as share rejection rate) before final statuses are assigned. */
  ingestBatch(inputs: readonly StatisticsMetricInput[]): MetricIngestionResult[] {
    const prepared: { metric: StatisticsMetric; previous?: StatisticsMetric; existing?: StatisticsMetric }[] = inputs.map((input) => {
      const existing = input.ingestionId ? this.registry.byIngestion(input.ingestionId) : input.metricUuid ? this.registry.get(input.metricUuid) : undefined;
      if (existing) return { metric: existing, existing };
      const metric = this.schema.construct(input);
      return { metric, previous: this.registry.latestShareMetric(metric) };
    });
    const provisional: StatisticsMetric[] = [];
    const quality = new Map<string, ReturnType<typeof validateDataQuality>>();
    for (const item of prepared) {
      if (item.existing) continue;
      const result = validateDataQuality(item.metric, item.previous);
      quality.set(item.metric.metricUuid, result);
      provisional.push(result.accepted ? item.metric : this.schema.withStatus(item.metric, 'rejected'));
    }
    const context = [...this.registry.all(), ...provisional];
    const output: MetricIngestionResult[] = [];
    for (const item of prepared) {
      if (item.existing) {
        output.push({ metric: item.existing, accepted: item.existing.collectionStatus === 'collected', rejectionReason: this.qualityByMetric.get(item.existing.metricUuid), anomalies: [...(this.anomaliesByMetric.get(item.existing.metricUuid) ?? [])] });
        continue;
      }
      const dataQuality = quality.get(item.metric.metricUuid)!;
      let finalMetric = provisional.find((metric) => metric.metricUuid === item.metric.metricUuid)!;
      const anomalies = dataQuality.accepted ? detectAnomalies(finalMetric, context, this.dependencies.clock.now(), () => this.nextUuid(), this.configuration) : [];
      if (anomalies.length > 0) finalMetric = this.schema.withStatus(finalMetric, 'quarantined');
      this.registry.add(finalMetric);
      this.graph.record(finalMetric);
      this.qualityByMetric.set(finalMetric.metricUuid, dataQuality.reason);
      this.anomaliesByMetric.set(finalMetric.metricUuid, Object.freeze([...anomalies]));
      this.dependencies.dataProvider.create('mining-statistics', { ...finalMetric }, 'Mining Statistics Framework', { id: finalMetric.metricUuid, reason: dataQuality.rationale });
      this.publish(finalMetric, dataQuality.reason, anomalies);
      output.push({ metric: finalMetric, accepted: finalMetric.collectionStatus === 'collected', rejectionReason: dataQuality.reason, anomalies });
    }
    return output;
  }

  /**
   * Converts an IMAF-shaped, already-normalized observation into individual
   * canonical metrics. It neither parses raw miner output nor changes units.
   */
  ingestNormalizedStatistics(context: NormalizedStatisticsContext, normalized: NormalizedStatistics): MetricIngestionResult[] {
    const timestamp = context.timestamp ?? this.dependencies.clock.now();
    const common = { ...context, timestamp, confidenceScore: context.confidenceScore ?? 1 };
    const map: [keyof NormalizedStatistics, string, string][] = [
      ['hashrateHps', 'hashrate-hps', 'H/s'], ['acceptedShares', 'accepted-shares', 'shares'], ['rejectedShares', 'rejected-shares', 'shares'], ['errorRate', 'error-rate', 'ratio'], ['uptimeSeconds', 'uptime-seconds', 'seconds'], ['poolLatencyMs', 'pool-latency-ms', 'milliseconds'], ['temperatureCelsius', 'temperature-celsius', 'celsius'], ['powerWatts', 'power-watts', 'watts'], ['efficiencyHpsPerWatt', 'efficiency-hps-per-watt', 'H/s/W'],
    ];
    const inputs: StatisticsMetricInput[] = map.flatMap(([key, metricType, unit]) => {
      const value = normalized[key];
      if (typeof value !== 'number') return [];
      return [{
        timestamp: common.timestamp,
        sourceIdentifier: common.sourceIdentifier,
        workloadUuid: common.workloadUuid,
        adapterUuid: common.adapterUuid,
        minerProcessUuid: common.minerProcessUuid,
        hardwareIdentifier: common.hardwareIdentifier,
        resourceUuid: common.resourceUuid,
        pluginUuid: common.pluginUuid,
        algorithmIdentifier: common.algorithmIdentifier,
        poolIdentifier: common.poolIdentifier,
        metricType,
        value,
        unit,
        confidenceScore: common.confidenceScore,
        ingestionId: common.ingestionIdPrefix ? `${common.ingestionIdPrefix}:${metricType}` : undefined,
      }];
    });
    return this.ingestBatch(inputs);
  }

  query(query: StatisticsMetricQuery = {}): StatisticsMetric[] { return this.registry.query(query); }
  aggregate(level: AggregationLevel, metrics: readonly StatisticsMetric[] = this.registry.all(), options: { includeQuarantined?: boolean } = {}) { return aggregateMetrics(metrics, level, options); }

  rollup(granularity: RollupGranularity, level: AggregationLevel = 'platform', metrics: readonly StatisticsMetric[] = this.registry.all()): StatisticsRollup[] {
    const rollups = computeRollups(metrics, granularity, level, this.dependencies.clock, () => this.nextUuid());
    persistAndRetainRollups(rollups, granularity, this.dependencies.dataProvider, this.dependencies.retentionProvider);
    return rollups;
  }

  /** Explicit archive delegation; provider policy, lifecycle, and mechanics stay outside IMSF. */
  archiveRollups(rollups: readonly StatisticsRollup[], reason = 'Historical statistics archival requested.'): void {
    delegateRollupArchive(rollups, reason, this.dependencies.retentionProvider);
  }

  explain(metricUuid: string) { const metric = this.registry.require(metricUuid); return explainMetric(metric, this.qualityByMetric.get(metricUuid), this.anomaliesByMetric.get(metricUuid)); }
  explainAggregate(level: AggregationLevel, aggregationKey: string, metricType?: string) { const aggregate = this.aggregate(level).find((entry) => entry.aggregationKey === aggregationKey && (!metricType || entry.metricType === metricType)); return aggregate ? explainAggregate(aggregate) : undefined; }

  private publish(metric: StatisticsMetric, rejectionReason: import('./types.js').DataQualityRejectionReason | undefined, anomalies: readonly import('./types.js').AnomalyRecord[]): void {
    this.events.publish(MINING_STATISTICS_EVENTS.StatisticsCollected, { metric });
    if (metric.collectionStatus === 'rejected') this.events.publish(MINING_STATISTICS_EVENTS.StatisticsRejected, { metric, rejectionReason });
    else this.events.publish(MINING_STATISTICS_EVENTS.StatisticsValidated, { metric });
    if (metric.metricType === 'hashrate-hps') this.events.publish(MINING_STATISTICS_EVENTS.HashrateUpdated, { metric });
    if (metric.metricType === 'accepted-shares' || metric.metricType === 'rejected-shares') this.events.publish(MINING_STATISTICS_EVENTS.ShareStatisticsUpdated, { metric });
    if (metric.metricType === 'efficiency-hps-per-watt') this.events.publish(MINING_STATISTICS_EVENTS.EfficiencyUpdated, { metric });
    for (const anomaly of anomalies) this.events.publish(MINING_STATISTICS_EVENTS.StatisticsAnomalyDetected, { metric, anomaly });
  }

  private nextUuid(): string { return this.dependencies.createUuid?.() ?? `mining-statistics-${++this.counter}`; }
}
