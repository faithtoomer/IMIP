import { CertificationNotFoundError } from './errors.js';
import type { CertificationRecord } from './types.js';

/** IHCA-owned decision registry; it is not a hardware inventory or source-evidence store. */
export class CertificationRegistry {
  private readonly records = new Map<string, CertificationRecord>();

  upsert(record: CertificationRecord): void {
    this.records.set(record.certificationId, freezeRecord(record));
  }

  get(certificationId: string): CertificationRecord | undefined {
    return this.records.get(certificationId);
  }

  require(certificationId: string): CertificationRecord {
    const record = this.get(certificationId);
    if (!record) throw new CertificationNotFoundError(`certification ${certificationId}`);
    return record;
  }

  remove(certificationId: string): boolean {
    return this.records.delete(certificationId);
  }

  all(): CertificationRecord[] {
    return [...this.records.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.certificationId.localeCompare(right.certificationId));
  }

  forHardware(hardwareUuid: string): CertificationRecord[] {
    return this.all().filter((record) => record.hardwareUuid === hardwareUuid);
  }
}

function freezeRecord(record: CertificationRecord): CertificationRecord {
  const decision = record.decision
    ? Object.freeze({
      ...record.decision,
      policyResults: Object.freeze(record.decision.policyResults.map((result) => Object.freeze({
        ...result,
        requirements: Object.freeze(result.requirements.map((requirement) => Object.freeze({
          ...requirement,
          evidenceTypes: Object.freeze([...requirement.evidenceTypes]),
        }))),
        rationale: Object.freeze([...result.rationale]),
      }))),
      evidenceRefs: Object.freeze([...record.decision.evidenceRefs]),
      testsPassed: Object.freeze([...record.decision.testsPassed]),
      requirementsFailed: Object.freeze([...record.decision.requirementsFailed]),
    })
    : undefined;
  return Object.freeze({
    ...record,
    evidenceRefs: Object.freeze([...record.evidenceRefs]),
    notes: Object.freeze([...record.notes]),
    policiesApplied: Object.freeze([...record.policiesApplied]),
    revocationHistory: Object.freeze(record.revocationHistory.map((entry) => Object.freeze({
      ...entry,
      evidenceRefs: Object.freeze([...entry.evidenceRefs]),
    }))),
    decision,
  }) as CertificationRecord;
}
