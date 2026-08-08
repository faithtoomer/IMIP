import type { SecurityAuditRecord } from './types.js';

/** §12 — immutable security audit history, mirroring the structural
 * immutability of DataAuditTrail (Phase 08) and AuditLogTrail (Phase 10):
 * no update or delete method is exposed, for any reason. */
export class SecurityAuditTrail {
  private records: SecurityAuditRecord[] = [];

  record(entry: SecurityAuditRecord): void {
    this.records.push(Object.freeze({ ...entry }));
  }

  all(): readonly SecurityAuditRecord[] {
    return this.records;
  }

  forComponent(componentId: string): SecurityAuditRecord[] {
    return this.records.filter((record) => record.componentId === componentId);
  }

  denialsFor(componentId: string): SecurityAuditRecord[] {
    return this.records.filter((record) => record.componentId === componentId && record.decision === 'denied');
  }
}
