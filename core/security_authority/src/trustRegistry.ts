import { DuplicateTrustError, TrustNotFoundError } from './errors.js';
import type { TrustRecord, TrustRegistrationInput } from './types.js';

/** §6 — the authoritative Trust Registry. Law 2 "Zero Implicit Trust": a
 * componentId with no entry here is `untrusted` by definition, never
 * assumed trustworthy — see SecurityAuthority.authorize(). */
export class TrustRegistry {
  private records = new Map<string, TrustRecord>();

  register(input: TrustRegistrationInput): TrustRecord {
    if (this.records.has(input.componentId)) throw new DuplicateTrustError(input.componentId);
    const now = new Date().toISOString();
    const record: TrustRecord = { ...input, signatureStatus: input.signatureStatus ?? 'unsigned', lastValidation: now, createdAt: now };
    this.records.set(input.componentId, record);
    return record;
  }

  update(record: TrustRecord): void {
    this.require(record.componentId);
    this.records.set(record.componentId, record);
  }

  revoke(componentId: string): TrustRecord {
    const record = this.require(componentId);
    const updated: TrustRecord = { ...record, trustLevel: 'untrusted', certificationStatus: 'revoked', lastValidation: new Date().toISOString() };
    this.records.set(componentId, updated);
    return updated;
  }

  get(componentId: string): TrustRecord | undefined {
    return this.records.get(componentId);
  }

  require(componentId: string): TrustRecord {
    const record = this.records.get(componentId);
    if (!record) throw new TrustNotFoundError(componentId);
    return record;
  }

  all(): TrustRecord[] {
    return [...this.records.values()];
  }
}
