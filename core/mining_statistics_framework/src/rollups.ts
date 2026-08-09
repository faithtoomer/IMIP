import { aggregateMetrics } from './aggregation.js';
import type { StatisticsClock, StatisticsDataProvider, StatisticsRetentionProvider } from './providers.js';
import type { AggregationLevel, RollupGranularity, StatisticsMetric, StatisticsRollup } from './types.js';

/** UTC bucket start; week starts Monday at 00:00:00.000Z. */
export function bucketStart(timestamp: string, granularity: RollupGranularity): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid rollup timestamp: ${timestamp}`);
  if (granularity === 'minute') date.setUTCSeconds(0, 0);
  if (granularity === 'hour') date.setUTCMinutes(0, 0, 0);
  if (granularity === 'day') date.setUTCHours(0, 0, 0, 0);
  if (granularity === 'week') {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  }
  return date.toISOString();
}

export function bucketEnd(start: string, granularity: RollupGranularity): string {
  const date = new Date(start);
  if (granularity === 'minute') date.setUTCMinutes(date.getUTCMinutes() + 1);
  if (granularity === 'hour') date.setUTCHours(date.getUTCHours() + 1);
  if (granularity === 'day') date.setUTCDate(date.getUTCDate() + 1);
  if (granularity === 'week') date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString();
}

/** Pure computation; it does not persist, retain, archive, or expire anything. */
export function computeRollups(metrics: readonly StatisticsMetric[], granularity: RollupGranularity, level: AggregationLevel, clock: StatisticsClock, createUuid: () => string): StatisticsRollup[] {
  const buckets = new Map<string, StatisticsMetric[]>();
  for (const metric of metrics) {
    const start = bucketStart(metric.timestamp, granularity);
    const group = buckets.get(start) ?? [];
    group.push(metric);
    buckets.set(start, group);
  }
  const output: StatisticsRollup[] = [];
  for (const [start, members] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const aggregate of aggregateMetrics(members, level)) {
      output.push(Object.freeze({
        ...aggregate,
        rollupUuid: createUuid(),
        granularity,
        bucketStart: start,
        bucketEnd: bucketEnd(start, granularity),
        computedAt: clock.now(),
      }));
    }
  }
  return output.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart) || a.aggregationKey.localeCompare(b.aggregationKey) || a.metricType.localeCompare(b.metricType));
}

/** All durability and storage-governance side effects are explicit provider delegation. */
export function persistAndRetainRollups(rollups: readonly StatisticsRollup[], granularity: RollupGranularity, dataProvider: StatisticsDataProvider, retentionProvider: StatisticsRetentionProvider): void {
  for (const rollup of rollups) dataProvider.create('mining-statistics-rollup', { ...rollup }, 'Mining Statistics Framework', { id: rollup.rollupUuid, reason: 'Computed institutional statistics rollup.' });
  retentionProvider.retainRollups({ rollups, granularity });
}

/** IMSF only forwards an explicit archive request; provider policy owns the archive mechanics and lifecycle. */
export function delegateRollupArchive(rollups: readonly StatisticsRollup[], reason: string, retentionProvider: StatisticsRetentionProvider): void {
  retentionProvider.archiveRollups({ rollups, reason });
}
