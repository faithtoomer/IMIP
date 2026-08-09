import type { StatisticsMetric, StatisticsMetricQuery } from './types.js';
import { UnknownStatisticsMetricError } from './errors.js';

/** In-memory, session-scoped working index. Durable ownership remains injected. */
export class StatisticsRegistry {
  private readonly byUuid = new Map<string, StatisticsMetric>();
  private readonly byIngestionId = new Map<string, string>();

  add(metric: StatisticsMetric): StatisticsMetric {
    const existing = this.byUuid.get(metric.metricUuid);
    if (existing) return existing;
    if (metric.ingestionId) {
      const existingUuid = this.byIngestionId.get(metric.ingestionId);
      if (existingUuid) return this.byUuid.get(existingUuid)!;
      this.byIngestionId.set(metric.ingestionId, metric.metricUuid);
    }
    this.byUuid.set(metric.metricUuid, metric);
    return metric;
  }

  get(metricUuid: string): StatisticsMetric | undefined { return this.byUuid.get(metricUuid); }
  require(metricUuid: string): StatisticsMetric { const metric = this.get(metricUuid); if (!metric) throw new UnknownStatisticsMetricError(metricUuid); return metric; }
  byIngestion(ingestionId: string): StatisticsMetric | undefined { const uuid = this.byIngestionId.get(ingestionId); return uuid ? this.byUuid.get(uuid) : undefined; }

  query(query: StatisticsMetricQuery = {}): StatisticsMetric[] {
    const all = [...this.byUuid.values()].filter((metric) => {
      if (query.metricUuid && metric.metricUuid !== query.metricUuid) return false;
      if (query.sourceIdentifier && metric.sourceIdentifier !== query.sourceIdentifier) return false;
      if (query.workloadUuid && metric.workloadUuid !== query.workloadUuid) return false;
      if (query.adapterUuid && metric.adapterUuid !== query.adapterUuid) return false;
      if (query.minerProcessUuid && metric.minerProcessUuid !== query.minerProcessUuid) return false;
      if (query.hardwareIdentifier && metric.hardwareIdentifier !== query.hardwareIdentifier) return false;
      if (query.pluginUuid && metric.pluginUuid !== query.pluginUuid) return false;
      if (query.algorithmIdentifier && metric.algorithmIdentifier !== query.algorithmIdentifier) return false;
      if (query.poolIdentifier && metric.poolIdentifier !== query.poolIdentifier) return false;
      if (query.metricType && metric.metricType !== query.metricType) return false;
      if (query.collectionStatus && metric.collectionStatus !== query.collectionStatus) return false;
      if (query.since && metric.timestamp < query.since) return false;
      if (query.until && metric.timestamp >= query.until) return false;
      return true;
    });
    return all.sort(compareMetrics);
  }

  latestShareMetric(metric: StatisticsMetric): StatisticsMetric | undefined {
    return this.query({ sourceIdentifier: metric.sourceIdentifier, metricType: metric.metricType })
      .filter((candidate) => candidate.collectionStatus !== 'rejected' && candidate.timestamp <= metric.timestamp && candidate.metricUuid !== metric.metricUuid)
      .at(-1);
  }

  all(): StatisticsMetric[] { return this.query(); }
}

export function compareMetrics(a: StatisticsMetric, b: StatisticsMetric): number {
  return a.timestamp.localeCompare(b.timestamp) || a.metricUuid.localeCompare(b.metricUuid);
}
