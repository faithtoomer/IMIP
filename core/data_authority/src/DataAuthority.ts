import { randomUUID } from 'node:crypto';
import { SqliteStorageProvider } from './sqliteStorageProvider.js';
import { SchemaManager } from './schemaManager.js';
import { DataMigrationRunner } from './migrations.js';
import { TransactionManager } from './transactionManager.js';
import { DataAuditTrail, AUDIT_DOMAIN } from './auditTrail.js';
import { KnowledgeGraph } from './knowledgeGraph.js';
import { redactSensitiveFields } from './security.js';
import { DuplicateRecordError, OptimisticConcurrencyError, RecordNotFoundError, SchemaValidationError } from './errors.js';
import type { StorageProvider } from './storageProvider.js';
import type { StorageAuthority } from '../../storage_authority/src/index.js';
import type {
  BackupResult,
  BackupValidationResult,
  DataAuditRecord,
  DataAuthorityMetrics,
  DataDomain,
  DataMigrationDefinition,
  DataRecord,
  DomainSchema,
  QueryOptions,
} from './types.js';

export interface DataAuthorityOptions {
  storage?: StorageProvider;
  /** Convenience: if `storage` isn't given, constructs a SqliteStorageProvider
   * at this path. Explicit override — always wins over `storageAuthority`. */
  filePath?: string;
  /** ADR-0012 (§Law 3): when given, and neither `storage` nor `filePath` is
   * explicitly provided, IDA's default database file path is allocated from
   * ISMA (`database` domain) instead of defaulting to `:memory:`. Optional —
   * omitting it preserves IDA's exact pre-Phase-09 default behavior. */
  storageAuthority?: StorageAuthority;
  /** Distinguishes multiple IDA instances sharing one StorageAuthority. Defaults to 'ida-primary'. */
  storagePurpose?: string;
  migrations?: DataMigrationDefinition[];
}

export interface WriteOptions {
  correlationId?: string;
  reason?: string;
}

export interface CreateOptions extends WriteOptions {
  id?: string;
}

export interface UpdateOptions extends WriteOptions {
  /** Optimistic concurrency: if given, must match the record's current
   * revision, or the update is rejected (OptimisticConcurrencyError). */
  expectedRevision?: number;
}

const AUDIT_LOG_SCHEMA: DomainSchema = {
  domain: AUDIT_DOMAIN,
  version: 1,
  fields: [
    { name: 'domain', type: 'string', required: true },
    { name: 'entityId', type: 'string', required: true },
    { name: 'operation', type: 'string', required: true },
    { name: 'initiatingAuthority', type: 'string', required: true },
    { name: 'transactionId', type: 'string', required: true },
    { name: 'result', type: 'string', required: true },
  ],
};

const DURATION_WINDOW = 1000;

/**
 * IDA — the Institutional Data Authority (PHASE-08). The sole owner of
 * persistent platform knowledge. Repository-style CRUD is implemented once,
 * generically, parameterized by `domain` — matching the pattern already
 * established by ConfigurationRegistry/HardwareRegistry/EventRegistry rather
 * than one repository subclass per domain.
 *
 * Audit recording is always its own small transaction, deliberately separate
 * from the data-changing transaction it describes (Law 5/Law 6): a failed
 * create/update/delete still produces a permanent audit record, which
 * wouldn't survive if it were rolled back together with the failed change.
 */
export class DataAuthority {
  readonly schemas = new SchemaManager();
  readonly audit: DataAuditTrail;
  readonly knowledge: KnowledgeGraph;

  private storage: StorageProvider;
  private transactions: TransactionManager;
  private readonly migrationRunner: DataMigrationRunner;

  private writeCount = 0;
  private readCount = 0;
  private transactionCount = 0;
  private migrationCount = 0;
  private readonly queryDurations: number[] = [];
  private readonly transactionDurations: number[] = [];

  constructor(private readonly options: DataAuthorityOptions = {}) {
    const resolvedFilePath =
      options.filePath ??
      (options.storageAuthority && !options.storage
        ? options.storageAuthority.allocate('database', options.storagePurpose ?? 'ida-primary', { filename: 'data.db' }).path
        : ':memory:');
    this.storage = options.storage ?? new SqliteStorageProvider(resolvedFilePath);
    this.transactions = new TransactionManager(this.storage);
    this.migrationRunner = new DataMigrationRunner(options.migrations ?? []);
    this.audit = new DataAuditTrail(this.storage);
    this.knowledge = new KnowledgeGraph(this.storage);

    this.schemas.register(AUDIT_LOG_SCHEMA);
    this.storage.ensureDomainTable(AUDIT_LOG_SCHEMA);
  }

  registerDomainSchema(schema: DomainSchema): void {
    this.schemas.register(schema);
    this.storage.ensureDomainTable(schema);
  }

  create(domain: DataDomain, data: Record<string, unknown>, initiatingAuthority: string, options: CreateOptions = {}): DataRecord {
    const schema = this.schemas.get(domain);
    const id = options.id ?? randomUUID();

    try {
      const { result } = this.transactions.runInTransaction(() => {
        const errors = this.schemas.validate(domain, data);
        if (errors.length > 0) throw new SchemaValidationError(domain, errors);
        this.assertUnique(schema, domain, data, undefined);

        const now = new Date().toISOString();
        const record: DataRecord = { id, domain, data, version: schema.version, revision: 1, lifecycleStage: 'persisted', createdAt: now, updatedAt: now };
        this.storage.insert(domain, record);
        return record;
      });

      this.writeCount += 1;
      this.recordAudit(domain, id, 'create', initiatingAuthority, {
        newValue: redactSensitiveFields(schema, data),
        result: 'success',
        correlationId: options.correlationId,
        reason: options.reason,
      });
      return result;
    } catch (error) {
      this.recordAudit(domain, id, 'create', initiatingAuthority, {
        result: 'failure',
        reason: (error as Error).message,
        correlationId: options.correlationId,
      });
      throw error;
    }
  }

  update(domain: DataDomain, id: string, data: Record<string, unknown>, initiatingAuthority: string, options: UpdateOptions = {}): DataRecord {
    const schema = this.schemas.get(domain);
    const existing = this.storage.get(domain, id);

    try {
      if (!existing) throw new RecordNotFoundError(domain, id);
      const { result } = this.transactions.runInTransaction(() => {
        const errors = this.schemas.validate(domain, data);
        if (errors.length > 0) throw new SchemaValidationError(domain, errors);
        if (options.expectedRevision !== undefined && options.expectedRevision !== existing.revision) {
          throw new OptimisticConcurrencyError(domain, id, options.expectedRevision, existing.revision);
        }
        this.assertUnique(schema, domain, data, id);

        const record: DataRecord = {
          ...existing,
          data,
          version: schema.version,
          revision: existing.revision + 1,
          lifecycleStage: 'updated',
          updatedAt: new Date().toISOString(),
        };
        this.storage.update(domain, id, record);
        return record;
      });

      this.writeCount += 1;
      this.recordAudit(domain, id, 'update', initiatingAuthority, {
        previousValue: redactSensitiveFields(schema, existing!.data),
        newValue: redactSensitiveFields(schema, data),
        result: 'success',
        correlationId: options.correlationId,
        reason: options.reason,
      });
      return result;
    } catch (error) {
      this.recordAudit(domain, id, 'update', initiatingAuthority, {
        result: 'failure',
        reason: (error as Error).message,
        correlationId: options.correlationId,
      });
      throw error;
    }
  }

  delete(domain: DataDomain, id: string, initiatingAuthority: string, options: WriteOptions = {}): void {
    const schema = this.schemas.get(domain);
    const existing = this.storage.get(domain, id);

    try {
      if (!existing) throw new RecordNotFoundError(domain, id);
      this.transactions.runInTransaction(() => {
        this.storage.delete(domain, id);
      });

      this.writeCount += 1;
      this.recordAudit(domain, id, 'delete', initiatingAuthority, {
        previousValue: redactSensitiveFields(schema, existing.data),
        result: 'success',
        correlationId: options.correlationId,
        reason: options.reason,
      });
    } catch (error) {
      this.recordAudit(domain, id, 'delete', initiatingAuthority, {
        result: 'failure',
        reason: (error as Error).message,
        correlationId: options.correlationId,
      });
      throw error;
    }
  }

  get(domain: DataDomain, id: string): DataRecord | undefined {
    const start = performance.now();
    const record = this.storage.get(domain, id);
    this.trackQuery(start);
    if (!record) return undefined;
    return this.applyMigrationsOnRead(domain, record);
  }

  find(domain: DataDomain, options: QueryOptions = {}): DataRecord[] {
    const start = performance.now();
    const records = this.storage.find(domain, options);
    this.trackQuery(start);
    return records.map((record) => this.applyMigrationsOnRead(domain, record));
  }

  count(domain: DataDomain, options: QueryOptions = {}): number {
    const start = performance.now();
    const total = this.storage.count(domain, options);
    this.trackQuery(start);
    return total;
  }

  exists(domain: DataDomain, id: string): boolean {
    return this.storage.exists(domain, id);
  }

  /** §8 — atomic transactions, exposed for multi-record operations that must
   * commit or roll back together. */
  transaction<T>(fn: () => T): T {
    const start = performance.now();
    const { result } = this.transactions.runInTransaction(fn);
    this.transactionCount += 1;
    this.transactionDurations.push(performance.now() - start);
    if (this.transactionDurations.length > DURATION_WINDOW) this.transactionDurations.shift();
    return result;
  }

  /** §10 — retention/purge. Deletes records created before the cutoff and
   * records one audit entry per purged record (operation: 'purge'). */
  purge(domain: DataDomain, olderThan: Date, initiatingAuthority: string, reason = 'retention policy'): number {
    const candidates = this.storage.find(domain, { filters: [{ field: 'createdAt', op: 'lt', value: olderThan.toISOString() }] });
    for (const record of candidates) {
      this.transactions.runInTransaction(() => {
        this.storage.delete(domain, record.id);
      });
      this.writeCount += 1;
      this.recordAudit(domain, record.id, 'purge', initiatingAuthority, { result: 'success', reason });
    }
    return candidates.length;
  }

  // ---- Backup & Recovery (§14) ----

  backup(destinationPath: string): BackupResult {
    this.storage.backup(destinationPath);
    return { path: destinationPath, createdAt: new Date().toISOString(), sizeBytes: this.storage.getSizeBytes() };
  }

  validateBackup(path: string): BackupValidationResult {
    return this.storage.validateBackup(path);
  }

  /** A recovery checkpoint is a backup taken specifically to mark a known-good
   * point for later restoration; mechanically identical to backup(). */
  createRecoveryCheckpoint(destinationPath: string): BackupResult {
    return this.backup(destinationPath);
  }

  /** Restores from a backup file by replacing the live storage connection.
   * Re-establishes every previously registered domain table (idempotent). */
  restore(sourcePath: string): void {
    const validation = this.storage.validateBackup(sourcePath);
    if (!validation.valid) {
      throw new Error(`Cannot restore from "${sourcePath}": ${validation.reasons.join('; ')}`);
    }
    this.storage.close();
    this.storage = new SqliteStorageProvider(sourcePath);
    this.transactions = new TransactionManager(this.storage);
    for (const schema of this.schemas.all()) {
      this.storage.ensureDomainTable(schema);
    }
    this.storage.ensureRelationshipsTable();
  }

  getMetrics(): DataAuthorityMetrics {
    return {
      writeCount: this.writeCount,
      readCount: this.readCount,
      transactionCount: this.transactionCount,
      averageQueryLatencyMs: average(this.queryDurations),
      averageTransactionDurationMs: average(this.transactionDurations),
      storageBytes: this.storage.getSizeBytes(),
      migrationCount: this.migrationCount,
    };
  }

  close(): void {
    this.storage.close();
  }

  // ---- Internal ----

  private assertUnique(schema: DomainSchema, domain: DataDomain, data: Record<string, unknown>, excludeId: string | undefined): void {
    for (const field of schema.fields) {
      if (!field.unique) continue;
      const value = data[field.name];
      if (value === undefined || value === null) continue;
      const matches = this.storage.find(domain, { filters: [{ field: field.name, op: 'eq', value }] });
      const conflict = matches.find((match) => match.id !== excludeId);
      if (conflict) throw new DuplicateRecordError(domain, field.name, value);
    }
  }

  private applyMigrationsOnRead(domain: DataDomain, record: DataRecord): DataRecord {
    const schema = this.schemas.get(domain);
    if (record.version >= schema.version) return record;

    const migration = this.migrationRunner.migrate(domain, record.data, record.version);
    if (migration.applied.length === 0) return record;

    const migrated: DataRecord = { ...record, data: migration.data, version: migration.toVersion, updatedAt: new Date().toISOString() };
    this.storage.update(domain, record.id, migrated);
    this.migrationCount += migration.applied.length;
    return migrated;
  }

  private recordAudit(
    domain: DataDomain,
    entityId: string,
    operation: DataAuditRecord['operation'],
    initiatingAuthority: string,
    extra: Partial<Pick<DataAuditRecord, 'previousValue' | 'newValue' | 'result' | 'correlationId' | 'reason'>> & { result: DataAuditRecord['result'] },
  ): void {
    this.transactions.runInTransaction(() => {
      this.audit.record({
        domain,
        entityId,
        operation,
        initiatingAuthority,
        transactionId: this.transactions.activeTransactionId!,
        ...extra,
      });
    });
  }

  private trackQuery(startedAtPerfMs: number): void {
    this.readCount += 1;
    this.queryDurations.push(performance.now() - startedAtPerfMs);
    if (this.queryDurations.length > DURATION_WINDOW) this.queryDurations.shift();
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
