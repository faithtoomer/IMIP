import { AdapterCertificationError } from './errors.js';
import type { AdapterCertificationRecord, AdapterCertificationStatus } from './types.js';

const TRANSITIONS: Readonly<Record<AdapterCertificationStatus, readonly AdapterCertificationStatus[]>> = Object.freeze({
  uncertified: ['experimental', 'revoked'], experimental: ['development', 'revoked'], development: ['qualified', 'revoked'], qualified: ['production', 'revoked'], production: ['mission-critical', 'revoked'], 'mission-critical': ['revoked'], revoked: [],
});

/** Lightweight IMAF adapter-readiness status; it is unrelated to IHCA hardware certification. */
export class AdapterCertificationRegistry {
  private readonly records = new Map<string, AdapterCertificationRecord>();
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}
  initialize(adapterId: string, status: AdapterCertificationStatus, rationale = 'Declared by adapter manifest.'): AdapterCertificationRecord {
    const existing = this.records.get(adapterId);
    if (existing) return existing;
    const record = freeze({ adapterId, status, rationale, updatedAt: this.now() }); this.records.set(adapterId, record); return record;
  }
  get(adapterId: string): AdapterCertificationRecord | undefined { return this.records.get(adapterId); }
  require(adapterId: string): AdapterCertificationRecord { const record = this.get(adapterId); if (!record) throw new AdapterCertificationError(`No adapter certification record for ${adapterId}.`); return record; }
  transition(adapterId: string, status: AdapterCertificationStatus, rationale: string): AdapterCertificationRecord {
    const current = this.require(adapterId);
    if (!rationale.trim()) throw new AdapterCertificationError('Adapter certification rationale is required.');
    if (!TRANSITIONS[current.status].includes(status)) throw new AdapterCertificationError(`Invalid adapter certification transition from ${current.status} to ${status}.`);
    const record = freeze({ adapterId, status, rationale, updatedAt: this.now() }); this.records.set(adapterId, record); return record;
  }
  all(): AdapterCertificationRecord[] { return [...this.records.values()].sort((a, b) => a.adapterId.localeCompare(b.adapterId)); }
}
function freeze(record: AdapterCertificationRecord): AdapterCertificationRecord { return Object.freeze({ ...record }); }
