import type { ThermalAuditRecord } from './types.js';

/**
 * §16 — every thermal assessment must be explainable. This append-only, immutable
 * trail records device registration, profile updates, state changes, lifecycle
 * transitions, budget changes, anomalies, forecasts, and recommendations.
 */
export class ThermalAuditTrail {
  private records: ThermalAuditRecord[] = [];

  record(entry: ThermalAuditRecord): ThermalAuditRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly ThermalAuditRecord[] {
    return this.records;
  }

  forDevice(deviceId: string): ThermalAuditRecord[] {
    return this.records.filter((record) => record.deviceId === deviceId);
  }
}
