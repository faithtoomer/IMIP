export { DataAuthority, type DataAuthorityOptions, type CreateOptions, type UpdateOptions, type WriteOptions } from './DataAuthority.js';
export { SchemaManager } from './schemaManager.js';
export { DataMigrationRunner } from './migrations.js';
export { TransactionManager } from './transactionManager.js';
export { DataAuditTrail, AUDIT_DOMAIN } from './auditTrail.js';
export { KnowledgeGraph } from './knowledgeGraph.js';
export { redactSensitiveFields, REDACTED } from './security.js';
export { SqliteStorageProvider } from './sqliteStorageProvider.js';
export type { StorageProvider } from './storageProvider.js';
export {
  DataAuthorityError,
  UnknownDomainError,
  DuplicateSchemaError,
  SchemaValidationError,
  DuplicateRecordError,
  RecordNotFoundError,
  OptimisticConcurrencyError,
  InvalidQueryFieldError,
  BackupFailedError,
} from './errors.js';
export type {
  DataDomain,
  FieldType,
  FieldDefinition,
  DomainSchema,
  LifecycleStage,
  DataRecord,
  QueryOperator,
  QueryFilter,
  QueryOptions,
  DataAuditRecord,
  RelationshipRecord,
  DataAuthorityMetrics,
  BackupResult,
  BackupValidationResult,
  DataMigrationDefinition,
} from './types.js';
