import type { BackupValidationResult, DataDomain, DataRecord, DomainSchema, QueryOptions, RelationshipRecord } from './types.js';

/**
 * §7/Law 2 — the storage abstraction. Nothing above this interface ever sees
 * SQL, a connection string, or any backend-specific type. Swapping SQLite for
 * PostgreSQL/TimescaleDB later means writing a new implementation of this
 * interface — no changes anywhere else in IDA or its consumers.
 */
export interface StorageProvider {
  ensureDomainTable(schema: DomainSchema): void;

  insert(domain: DataDomain, record: DataRecord): void;
  update(domain: DataDomain, id: string, record: DataRecord): void;
  delete(domain: DataDomain, id: string): void;
  get(domain: DataDomain, id: string): DataRecord | undefined;
  find(domain: DataDomain, options: QueryOptions): DataRecord[];
  count(domain: DataDomain, options?: QueryOptions): number;
  exists(domain: DataDomain, id: string): boolean;

  beginTransaction(): void;
  commitTransaction(): void;
  rollbackTransaction(): void;
  savepoint(name: string): void;
  releaseSavepoint(name: string): void;
  rollbackToSavepoint(name: string): void;

  ensureRelationshipsTable(): void;
  insertRelationship(record: RelationshipRecord): void;
  findRelationshipsFrom(fromDomain: DataDomain, fromId: string, relationshipType?: string): RelationshipRecord[];
  findRelationshipsTo(toDomain: DataDomain, toId: string, relationshipType?: string): RelationshipRecord[];

  backup(destinationPath: string): void;
  validateBackup(path: string): BackupValidationResult;
  getSizeBytes(): number;
  close(): void;
}
