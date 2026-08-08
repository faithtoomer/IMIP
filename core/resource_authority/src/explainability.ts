import type { ResourceAuditRecord } from './types.js';

/**
 * §5 Principle 5 — every allocation answers which/why/constraints/requestor/remaining
 * capacity. This append-only, immutable trail is the explainability record for
 * registrations, state transitions, reservations, allocations, and ownership changes.
 */
export class ResourceAuditTrail {
  private records: ResourceAuditRecord[] = [];

  record(entry: ResourceAuditRecord): ResourceAuditRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    return frozen;
  }

  all(): readonly ResourceAuditRecord[] {
    return this.records;
  }

  forResource(resourceId: string): ResourceAuditRecord[] {
    return this.records.filter((record) => record.resourceId === resourceId);
  }
}
