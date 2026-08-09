import type { GpuPerformanceRecord, GpuProfile, NormalizedStatistics } from './types.js';
/** Append-only history with deterministic derived efficiency and stability calculations. */
export class GpuPerformanceHistory {
  private readonly records: GpuPerformanceRecord[] = [];
  record(sessionId: string, profile: GpuProfile, statistics: NormalizedStatistics, recordedAt: string): GpuPerformanceRecord {
    const previous = this.records.filter((record) => record.sessionId === sessionId).at(-1); const hashrate = statistics.hashrateHps; const power = statistics.powerWatts ?? profile.powerState.currentWatts;
    const stability = hashrate !== undefined && previous?.hashrateHps !== undefined && previous.hashrateHps > 0 ? Math.max(0, 1 - Math.abs(hashrate - previous.hashrateHps) / previous.hashrateHps) : undefined;
    const record: GpuPerformanceRecord = Object.freeze({ sessionId, gpuUuid: profile.gpuUuid, recordedAt, hashrateHps: hashrate, acceptedShares: statistics.acceptedShares, rejectedShares: statistics.rejectedShares, invalidShares: typeof statistics.extensions.invalidShares === 'number' ? statistics.extensions.invalidShares : undefined, hashrateStability: stability, powerConsumptionWatts: power, hashratePerWatt: hashrate !== undefined && power !== undefined && power > 0 ? hashrate / power : undefined, temperatureCelsius: statistics.temperatureCelsius ?? profile.thermalState.currentCelsius, hotspotCelsius: profile.thermalState.hotspotCelsius, memoryTemperatureCelsius: profile.thermalState.memoryCelsius, fanSpeedRpm: profile.thermalState.fanRpm, uptimeSeconds: statistics.uptimeSeconds, sourceStatistics: Object.freeze({ ...statistics, extensions: { ...statistics.extensions } }) }); this.records.push(record); return record;
  }
  forSession(sessionId: string): GpuPerformanceRecord[] { return this.records.filter((record) => record.sessionId === sessionId); }
  all(): GpuPerformanceRecord[] { return [...this.records]; }
}
