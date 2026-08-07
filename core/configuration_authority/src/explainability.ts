import { appendFileSync } from 'node:fs';
import type { AuditRecord } from './types.js';

/**
 * §12 — every configuration change generates an audit record. Records are
 * append-only and immutable once written. Callers must pass already-masked
 * previousValue/newValue for sensitive keys (see security.ts).
 *
 * Persistence: in-memory by default, plus an optional append-only JSONL file.
 * The Database Authority (reserved, not yet implemented) will own durable
 * storage of this trail in a later phase; the JSONL sink is an interim,
 * explicitly-opt-in bridge, not a substitute for that authority.
 */
export class AuditTrail {
  private records: AuditRecord[] = [];

  constructor(private readonly persistPath?: string) {}

  record(entry: AuditRecord): AuditRecord {
    const frozen = Object.freeze({ ...entry });
    this.records.push(frozen);
    if (this.persistPath) {
      appendFileSync(this.persistPath, `${JSON.stringify(frozen)}\n`, 'utf-8');
    }
    return frozen;
  }

  all(): readonly AuditRecord[] {
    return this.records;
  }

  forKey(id: string): AuditRecord[] {
    return this.records.filter((record) => record.id === id);
  }
}
