import type { RollupGranularity, StatisticsMetric, StatisticsRollup } from './types.js';

/** Injectable clock: IMSF never uses timers, sleeps, or wall-clock reads. */
export interface StatisticsClock {
  now(): string;
}

export interface StatisticsWriteOptions {
  correlationId?: string;
  reason?: string;
  id?: string;
}

export interface StatisticsDataQuery {
  filters?: { field: string; op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'; value: unknown }[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * A minimal, DataAuthority-shaped logical-data contract. A composition root
 * may adapt a real data authority to this structural shape; IMSF never imports
 * or creates a persistence authority or database implementation.
 */
export interface StatisticsDataProvider {
  create(
    domain: 'mining-statistics' | 'mining-statistics-rollup',
    data: Record<string, unknown>,
    initiatingAuthority: string,
    options?: StatisticsWriteOptions,
  ): unknown;
  find?(
    domain: 'mining-statistics' | 'mining-statistics-rollup',
    options?: StatisticsDataQuery,
  ): unknown[];
}

/**
 * StorageAuthority-shaped policy delegation. The provider decides retention,
 * archival, and storage lifecycle; IMSF supplies computed rollups only and
 * contains no expiry, deletion, archive, or lifecycle algorithm.
 */
export interface StatisticsRetentionProvider {
  retainRollups(input: { rollups: readonly StatisticsRollup[]; granularity: RollupGranularity }): unknown;
  archiveRollups(input: { rollups: readonly StatisticsRollup[]; reason: string }): unknown;
}

export interface MiningStatisticsFrameworkDependencies {
  dataProvider: StatisticsDataProvider;
  retentionProvider: StatisticsRetentionProvider;
  clock: StatisticsClock;
  createUuid?: () => string;
}

/** Reference-only convenience type for a composition root adapter. */
export interface PersistedStatisticsPayload {
  metrics?: readonly StatisticsMetric[];
  rollups?: readonly StatisticsRollup[];
}
