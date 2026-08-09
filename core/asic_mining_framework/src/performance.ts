import type { AsicPerformanceRecord, AsicProfile, NormalizedStatistics } from './types.js';
/** Append-only, deterministic calculation of ASIC measurements from normalized adapter statistics and provider views. */
export class AsicPerformanceHistory {
  private readonly records: AsicPerformanceRecord[] = [];
  record(sessionId: string, profile: AsicProfile, statistics: NormalizedStatistics, recordedAt: string): AsicPerformanceRecord {
    const hashrateHps = statistics.hashrateHps; const powerWatts = statistics.powerWatts ?? profile.powerState.currentWatts; const extensions = statistics.extensions;
    const record: AsicPerformanceRecord = Object.freeze({ sessionId, asicUuid: profile.asicUuid, recordedAt, hashrateHps, acceptedShares: statistics.acceptedShares, rejectedShares: statistics.rejectedShares, invalidShares: numeric(extensions.invalidShares), hardwareErrors: numeric(extensions.hardwareErrors) ?? numeric(extensions.hwErrors), uptimeSeconds: statistics.uptimeSeconds, powerWatts, temperatureCelsius: statistics.temperatureCelsius ?? profile.thermalState.currentCelsius, efficiencyHpsPerWatt: statistics.efficiencyHpsPerWatt ?? (hashrateHps !== undefined && powerWatts !== undefined && powerWatts > 0 ? hashrateHps / powerWatts : undefined), poolLatencyMs: statistics.poolLatencyMs, sourceStatistics: Object.freeze({ ...statistics, extensions: { ...extensions } }) }); this.records.push(record); return record;
  }
  forSession(sessionId: string): AsicPerformanceRecord[] { return this.records.filter((record) => record.sessionId === sessionId); }
  all(): AsicPerformanceRecord[] { return [...this.records]; }
}
function numeric(value: unknown): number | undefined { return typeof value === 'number' ? value : undefined; }
