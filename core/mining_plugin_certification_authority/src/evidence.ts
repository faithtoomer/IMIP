import type { EvidenceRecord } from './types.js';

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, clone(item)]));
  return value;
}
function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

/** Append-only immutable evidence ledger; IMPCA never mutates or deletes observations. */
export class PluginCertificationEvidenceLedger {
  private readonly records = new Map<string, Readonly<EvidenceRecord>>();
  private readonly byCertification = new Map<string, string[]>();

  append(record: EvidenceRecord): Readonly<EvidenceRecord> {
    if (this.records.has(record.evidenceId)) throw new Error(`Evidence ${record.evidenceId} already exists and cannot be overwritten.`);
    const snapshot = freeze(clone(record)) as Readonly<EvidenceRecord>;
    this.records.set(snapshot.evidenceId, snapshot);
    const ids = this.byCertification.get(snapshot.certificationId) ?? [];
    ids.push(snapshot.evidenceId);
    this.byCertification.set(snapshot.certificationId, ids);
    return snapshot;
  }

  get(evidenceId: string): Readonly<EvidenceRecord> | undefined { return this.records.get(evidenceId); }
  evidenceFor(certificationId: string): ReadonlyArray<Readonly<EvidenceRecord>> { return (this.byCertification.get(certificationId) ?? []).map((id) => this.records.get(id)!).filter(Boolean); }
}
