import type { HardwareAuditRecord } from './types.js';

/**
 * §13 — every hardware record must be explainable. This append-only, immutable
 * trail is the "why is it available / which authority owns it" record for
 * discovery events, state transitions, lifecycle transitions, benchmarks, and
 * faults.
 */
export class HardwareAuditTrail {
  private records: HardwareAuditRecord[] = [];

  record(entry: HardwareAuditRecord): HardwareAuditRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly HardwareAuditRecord[] {
    return this.records;
  }

  forDevice(deviceId: string): HardwareAuditRecord[] {
    return this.records.filter((record) => record.deviceId === deviceId);
  }
}
