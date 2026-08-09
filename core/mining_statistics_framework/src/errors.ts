import type { DataQualityRejectionReason } from './types.js';

export class MiningStatisticsFrameworkError extends Error {
  constructor(message: string) { super(message); this.name = 'MiningStatisticsFrameworkError'; }
}

export class UnknownStatisticsMetricError extends MiningStatisticsFrameworkError {
  constructor(metricUuid: string) { super(`Statistics metric "${metricUuid}" was not found.`); this.name = 'UnknownStatisticsMetricError'; }
}

export class DataQualityError extends MiningStatisticsFrameworkError {
  constructor(readonly reason: DataQualityRejectionReason, message: string) { super(message); this.name = 'DataQualityError'; }
}
