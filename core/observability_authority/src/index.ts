export { ObservabilityAuthority, type ObservabilityAuthorityOptions } from './ObservabilityAuthority.js';
export { LogCategoryRegistry } from './categoryRegistry.js';
export { LogSchemaRegistry } from './schemaRegistry.js';
export { maskSensitiveContext, REDACTED } from './security.js';
export { ConsoleLogSink, MemoryLogSink, FileLogSink, DatabaseLogSink, RUNTIME_LOG_DOMAIN, RUNTIME_LOG_SCHEMA } from './sinks.js';
export type { LogSink } from './sinks.js';
export { LogRouter } from './router.js';
export { AuditLogTrail } from './auditTrail.js';
export { DiagnosticsEngine } from './diagnostics.js';
export { ObservabilityGraph } from './graph.js';
export {
  ObservabilityAuthorityError,
  UnregisteredLogCategoryError,
  DuplicateLogCategoryError,
  UnregisteredLogSchemaError,
  DuplicateLogSchemaError,
  LogSchemaValidationError,
  CorrelationNotFoundError,
  TraceNotFoundError,
} from './errors.js';
export {
  DEFAULT_LOG_CATEGORIES,
  type DefaultLogCategory,
  type LogSeverity,
  type LogExceptionInfo,
  type LogContext,
  type StructuredLogRecord,
  type LogEntryInput,
  type LogSchemaDefinition,
  type RoutingRule,
  type IolaMetrics,
  type ObservabilityChain,
  type ObservabilityGraphSnapshot,
} from './types.js';
