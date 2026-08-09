import type { CpuPerformanceRecord, NormalizedStatistics } from './types.js';
export class CpuPerformanceHistory {
  private readonly records: CpuPerformanceRecord[] = [];
  record(sessionId: string, statistics: NormalizedStatistics, input: { threadCount: number; utilizationPercent?: number; thermalImpactCelsius?: number; powerConsumptionWatts?: number; recordedAt: string }): CpuPerformanceRecord {
    const hashrate = statistics.hashrateHps; const power = statistics.powerWatts ?? input.powerConsumptionWatts;
    const record = Object.freeze({ sessionId, recordedAt: input.recordedAt, hashrateHps: hashrate, hashratePerThread: hashrate !== undefined && input.threadCount > 0 ? hashrate / input.threadCount : undefined, hashratePerWatt: hashrate !== undefined && power !== undefined && power > 0 ? hashrate / power : undefined, utilizationPercent: input.utilizationPercent, acceptedShares: statistics.acceptedShares, rejectedShares: statistics.rejectedShares, errorRate: statistics.errorRate, uptimeSeconds: statistics.uptimeSeconds, thermalImpactCelsius: statistics.temperatureCelsius ?? input.thermalImpactCelsius, powerConsumptionWatts: power, sourceStatistics: Object.freeze({ ...statistics, extensions: { ...statistics.extensions } }) }); this.records.push(record); return record;
  }
  forSession(sessionId: string): CpuPerformanceRecord[] { return this.records.filter((record) => record.sessionId === sessionId); }
  all(): CpuPerformanceRecord[] { return [...this.records]; }
}
