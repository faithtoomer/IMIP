import type { AggregationLevel, StatisticsAggregate, StatisticsMetric } from './types.js';
import { compareMetrics } from './registry.js';

/** Pure aggregation over supplied records. Rejected/quarantined records are excluded unless requested. */
export function aggregateMetrics(metrics: readonly StatisticsMetric[], level: AggregationLevel, options: { includeQuarantined?: boolean } = {}): StatisticsAggregate[] {
  const eligible = metrics.filter((metric) => metric.collectionStatus === 'collected' || (options.includeQuarantined && metric.collectionStatus === 'quarantined')).sort(compareMetrics);
  const groups = new Map<string, StatisticsMetric[]>();
  for (const metric of eligible) {
    const aggregationKey = keyFor(metric, level);
    const key = `${aggregationKey}\u0000${metric.metricType}\u0000${metric.unit}`;
    const group = groups.get(key) ?? [];
    group.push(metric);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([, group]) => aggregateGroup(group, level))
    .sort((a, b) => a.aggregationKey.localeCompare(b.aggregationKey) || a.metricType.localeCompare(b.metricType) || a.unit.localeCompare(b.unit));
}

export function keyFor(metric: StatisticsMetric, level: AggregationLevel): string {
  switch (level) {
    case 'device': return metric.hardwareIdentifier;
    case 'workload': return metric.workloadUuid;
    case 'miner-process': return metric.minerProcessUuid ?? 'unassigned-miner-process';
    case 'plugin': return metric.pluginUuid ?? 'unassigned-plugin';
    case 'adapter-algorithm': return `${metric.adapterUuid}:${metric.algorithmIdentifier}`;
    case 'pool': return metric.poolIdentifier ?? 'unassigned-pool';
    case 'platform': return 'platform';
  }
}

function aggregateGroup(group: StatisticsMetric[], level: AggregationLevel): StatisticsAggregate {
  const ordered = [...group].sort(compareMetrics);
  const values = ordered.map((metric) => metric.value);
  const sum = values.reduce((total, value) => total + value, 0);
  const latest = ordered.at(-1)!;
  return Object.freeze({
    aggregationLevel: level,
    aggregationKey: keyFor(latest, level),
    metricType: latest.metricType,
    unit: latest.unit,
    count: ordered.length,
    sum,
    average: sum / ordered.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    latestValue: latest.value,
    latestTimestamp: latest.timestamp,
    metricUuids: ordered.map((metric) => metric.metricUuid),
  });
}
