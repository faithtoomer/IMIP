import type { StructuredLogRecord } from './types.js';

/** §10/Law 6 (by analogy with IDA's own audit trail) — every severity-`audit`
 * log record is additionally captured here, structurally immutable: this
 * class exposes no update or delete method for any reason, mirroring
 * DataAuditTrail's (Phase 08) enforcement approach exactly. */
export class AuditLogTrail {
  private records: StructuredLogRecord[] = [];

  record(entry: StructuredLogRecord): void {
    this.records.push(Object.freeze({ ...entry }));
  }

  all(): readonly StructuredLogRecord[] {
    return this.records;
  }

  forAuthority(authority: string): StructuredLogRecord[] {
    return this.records.filter((record) => record.authority === authority);
  }

  forCorrelation(correlationId: string): StructuredLogRecord[] {
    return this.records.filter((record) => record.correlationId === correlationId);
  }
}
