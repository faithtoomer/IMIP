/** §6 — the 18 institutional data domains, plus additive Program II/III
 * extensions (documented at each addition site — see ADR-0013 for
 * 'runtime-logs', added for IOLA's optional database log sink, and
 * ADR-0009 for 'power-history', added for IPIA, and ADR-0019 for
 * workload-registry/workload-history, added for IWIA; and ADR-0020 for
 * health-registry/health-history, added for IHIA — deliberately distinct
 * from the existing, ambiguous 'telemetry' value, which no authority has
 * ever actually claimed). */
export type DataDomain =
  | 'configuration'
  | 'capability-registry'
  | 'plugin-registry'
  | 'hardware-inventory'
  | 'hardware-digital-twins'
  | 'runtime-state'
  | 'event-history'
  | 'decision-history'
  | 'profitability-history'
  | 'benchmark-results'
  | 'arbitration-registry'
  | 'arbitration-history'
  | 'certification-registry'
  | 'certification-history'
  | 'workload-registry'
  | 'workload-history'
  | 'health-registry'
  | 'health-history'
  | 'mining-adapter-registry'
  | 'mining-adapter-history'
  | 'mining-sessions'
  | 'wallet-metadata'
  | 'pool-metadata'
  | 'telemetry'
  | 'notifications'
  | 'ai-models'
  | 'explainability-records'
  | 'audit-logs'
  | 'runtime-logs'
  | 'power-history';

export type FieldType = 'string' | 'number' | 'boolean' | 'json' | 'timestamp';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  /** Redacted in audit records' previousValue/newValue — IDA is domain-agnostic
   * about what's sensitive, so schemas declare it explicitly per field. */
  sensitive?: boolean;
}

/** §9 — schema governance. */
export interface DomainSchema {
  domain: DataDomain;
  version: number;
  fields: FieldDefinition[];
  /** Cross-field / custom validation beyond type/required. Returns error messages. */
  validate?: (data: Record<string, unknown>) => string[];
}

export type LifecycleStage = 'created' | 'validated' | 'persisted' | 'updated' | 'archived' | 'retained' | 'purged';

/** The governance envelope every persisted record carries, regardless of domain. */
export interface DataRecord<T = Record<string, unknown>> {
  id: string;
  domain: DataDomain;
  data: T;
  /** The domain schema version `data` currently conforms to — used to apply
   * migrations transparently on read. NOT an optimistic-concurrency counter;
   * see `revision` for that (see DataAuthority.update). */
  version: number;
  /** Monotonic per-record revision counter, starting at 1 on create and
   * incremented on every update. This — not `updatedAt` — is what optimistic
   * concurrency control compares: wall-clock timestamps only have millisecond
   * resolution and two writes to the same record can legitimately land in the
   * same millisecond, which would make a timestamp-based check silently pass
   * a stale write through. */
  revision: number;
  lifecycleStage: LifecycleStage;
  createdAt: string;
  updatedAt: string;
}

export type QueryOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

export interface QueryFilter {
  field: string;
  op: QueryOperator;
  value: unknown;
}

/** §12 — backend-independent query interface. */
export interface QueryOptions {
  filters?: QueryFilter[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/** §13 — every write operation's audit record. */
export interface DataAuditRecord {
  auditId: string;
  timestamp: string;
  domain: DataDomain;
  entityId: string;
  operation: 'create' | 'update' | 'delete' | 'purge';
  initiatingAuthority: string;
  transactionId: string;
  previousValue?: unknown;
  newValue?: unknown;
  result: 'success' | 'failure';
  correlationId?: string;
  reason?: string;
}

/** §22 — Institutional Knowledge Model: a typed link between two entities,
 * possibly in different domains. */
export interface RelationshipRecord {
  relationshipId: string;
  fromDomain: DataDomain;
  fromId: string;
  relationshipType: string;
  toDomain: DataDomain;
  toId: string;
  createdAt: string;
}

export interface DataAuthorityMetrics {
  writeCount: number;
  readCount: number;
  transactionCount: number;
  averageQueryLatencyMs: number;
  averageTransactionDurationMs: number;
  storageBytes: number;
  migrationCount: number;
}

export interface BackupResult {
  path: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupValidationResult {
  valid: boolean;
  reasons: string[];
}

/** §10 — data migration for a domain's schema version bump. */
export interface DataMigrationDefinition {
  id: string;
  domain: DataDomain;
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}
