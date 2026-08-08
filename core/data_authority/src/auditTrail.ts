import { randomUUID } from 'node:crypto';
import type { StorageProvider } from './storageProvider.js';
import type { DataAuditRecord, DataDomain, QueryOptions } from './types.js';

const AUDIT_DOMAIN: DataDomain = 'audit-logs';

/**
 * §6/§13/Law 6 — IDA's own audit trail, self-hosted: every entry is itself a
 * record in the 'audit-logs' domain, persisted through the exact same
 * StorageProvider as everything else. Law 6 (immutable audit trail) is
 * enforced structurally — this class exposes no update or delete method for
 * any reason.
 */
export class DataAuditTrail {
  constructor(private readonly storage: StorageProvider) {}

  record(entry: Omit<DataAuditRecord, 'auditId' | 'timestamp'>): DataAuditRecord {
    const record: DataAuditRecord = { auditId: randomUUID(), timestamp: new Date().toISOString(), ...entry };
    this.storage.insert(AUDIT_DOMAIN, {
      id: record.auditId,
      domain: AUDIT_DOMAIN,
      data: record as unknown as Record<string, unknown>,
      version: 1,
      revision: 1,
      lifecycleStage: 'persisted',
      createdAt: record.timestamp,
      updatedAt: record.timestamp,
    });
    return record;
  }

  forEntity(domain: DataDomain, entityId: string): DataAuditRecord[] {
    return this.storage
      .find(AUDIT_DOMAIN, {
        filters: [
          { field: 'domain', op: 'eq', value: domain },
          { field: 'entityId', op: 'eq', value: entityId },
        ],
      })
      .map((record) => record.data as unknown as DataAuditRecord);
  }

  all(options: QueryOptions = {}): DataAuditRecord[] {
    return this.storage.find(AUDIT_DOMAIN, options).map((record) => record.data as unknown as DataAuditRecord);
  }
}

export { AUDIT_DOMAIN };
