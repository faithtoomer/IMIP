import type { StatisticsClock } from './providers.js';
import type { StatisticsMetric, StatisticsMetricInput } from './types.js';

/** Canonical construction only: no miner-specific parsing or unit conversion occurs here. */
export class StatisticsSchema {
  private counter = 0;

  constructor(private readonly clock: StatisticsClock, private readonly createUuid?: () => string) {}

  construct(input: StatisticsMetricInput): StatisticsMetric {
    const metricUuid = input.metricUuid ?? this.createUuid?.() ?? `statistics-metric-${++this.counter}`;
    const metric: StatisticsMetric = {
      metricUuid,
      timestamp: input.timestamp || this.clock.now(),
      sourceIdentifier: input.sourceIdentifier,
      workloadUuid: input.workloadUuid,
      adapterUuid: input.adapterUuid,
      minerProcessUuid: input.minerProcessUuid,
      hardwareIdentifier: input.hardwareIdentifier,
      resourceUuid: input.resourceUuid,
      pluginUuid: input.pluginUuid,
      algorithmIdentifier: input.algorithmIdentifier,
      poolIdentifier: input.poolIdentifier,
      metricType: input.metricType,
      value: input.value,
      unit: input.unit,
      confidenceScore: input.confidenceScore,
      collectionStatus: input.collectionStatus ?? 'collected',
      ingestionId: input.ingestionId,
    };
    return Object.freeze(metric);
  }

  /** Replaces the immutable snapshot while retaining the assigned Metric UUID. */
  withStatus(metric: StatisticsMetric, status: StatisticsMetric['collectionStatus']): StatisticsMetric {
    return Object.freeze({ ...metric, collectionStatus: status });
  }
}
