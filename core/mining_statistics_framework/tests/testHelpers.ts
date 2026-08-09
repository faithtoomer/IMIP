import type { MiningStatisticsFrameworkDependencies, StatisticsDataProvider, StatisticsRetentionProvider } from '../src/providers.js';
import type { StatisticsMetricInput, StatisticsRollup } from '../src/types.js';

export class FakeStatisticsDataProvider implements StatisticsDataProvider {
  readonly created: { domain: 'mining-statistics' | 'mining-statistics-rollup'; data: Record<string, unknown>; authority: string; options?: unknown }[] = [];
  create(domain: 'mining-statistics' | 'mining-statistics-rollup', data: Record<string, unknown>, authority: string, options?: unknown): unknown {
    this.created.push({ domain, data, authority, options });
    return { id: options && typeof options === 'object' && 'id' in options ? options.id : undefined, domain, data };
  }
  find(): unknown[] { return this.created.map((entry) => entry.data); }
}

export class FakeStatisticsRetentionProvider implements StatisticsRetentionProvider {
  readonly retained: { rollups: readonly StatisticsRollup[]; granularity: string }[] = [];
  readonly archived: { rollups: readonly StatisticsRollup[]; reason: string }[] = [];
  retainRollups(input: { rollups: readonly StatisticsRollup[]; granularity: 'minute' | 'hour' | 'day' | 'week' }): unknown { this.retained.push(input); return undefined; }
  archiveRollups(input: { rollups: readonly StatisticsRollup[]; reason: string }): unknown { this.archived.push(input); return undefined; }
}

export function dependencies(dataProvider = new FakeStatisticsDataProvider(), retentionProvider = new FakeStatisticsRetentionProvider()): MiningStatisticsFrameworkDependencies & { dataProvider: FakeStatisticsDataProvider; retentionProvider: FakeStatisticsRetentionProvider } {
  let id = 0;
  return {
    dataProvider,
    retentionProvider,
    clock: { now: () => '2026-08-09T14:00:00.000Z' },
    createUuid: () => `test-uuid-${++id}`,
  };
}

export function metric(overrides: Partial<StatisticsMetricInput> = {}): StatisticsMetricInput {
  return {
    timestamp: '2026-08-09T14:00:00.000Z',
    sourceIdentifier: 'source-1',
    workloadUuid: 'workload-1',
    adapterUuid: 'adapter-1',
    minerProcessUuid: 'process-1',
    hardwareIdentifier: 'hardware-1',
    resourceUuid: 'resource-1',
    pluginUuid: 'plugin-1',
    algorithmIdentifier: 'algorithm-1',
    poolIdentifier: 'pool-1',
    metricType: 'hashrate-hps',
    value: 100,
    unit: 'H/s',
    confidenceScore: 0.9,
    ...overrides,
  };
}
