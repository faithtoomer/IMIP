import type { PowerAuditRecord } from './types.js';

/**
 * §15 — every power-related decision must be explainable. This append-only,
 * immutable trail records profile creation, usage updates, budget events,
 * efficiency/cost calculations, recommendations, sensor failures, and
 * lifecycle transitions.
 */
export class PowerAuditTrail {
  private records: PowerAuditRecord[] = [];

  record(entry: PowerAuditRecord): PowerAuditRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly PowerAuditRecord[] {
    return this.records;
  }

  forDevice(deviceId: string): PowerAuditRecord[] {
    return this.records.filter((record) => record.deviceId === deviceId);
  }
}
