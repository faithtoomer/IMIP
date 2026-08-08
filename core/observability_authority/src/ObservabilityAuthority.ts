import { randomUUID } from 'node:crypto';
import type { DataAuthority } from '../../data_authority/src/index.js';
import type { RetentionPolicy, RetentionResult, StorageAuthority } from '../../storage_authority/src/index.js';
import { LogCategoryRegistry } from './categoryRegistry.js';
import { LogSchemaRegistry } from './schemaRegistry.js';
import { maskSensitiveContext } from './security.js';
import { ConsoleLogSink, DatabaseLogSink, FileLogSink, RUNTIME_LOG_DOMAIN, RUNTIME_LOG_SCHEMA } from './sinks.js';
import type { LogSink } from './sinks.js';
import { LogRouter } from './router.js';
import { AuditLogTrail } from './auditTrail.js';
import { DiagnosticsEngine } from './diagnostics.js';
import { ObservabilityGraph } from './graph.js';
import { CorrelationNotFoundError, LogSchemaValidationError, TraceNotFoundError, UnregisteredLogCategoryError } from './errors.js';
import type { IolaMetrics, LogEntryInput, LogSchemaDefinition, ObservabilityChain, RoutingRule, StructuredLogRecord } from './types.js';

export interface ObservabilityAuthorityOptions {
  /** When given, audit/critical/error/warning severities also persist
   * through IDA by default (RUNTIME_LOG_DOMAIN); trace/debug/information
   * stay off the database sink unless `routingRules` overrides it — full
   * per-log-line ACID persistence for high-volume, low-severity logs is a
   * real performance trap, not something Law 2/§12 requires. See ADR-0013. */
  dataAuthority?: DataAuthority;
  /** When given, a real, ISMA-managed, day-rotated log directory
   * (`telemetry` domain) replaces/joins the default console-only sink, and
   * `enforceRetention()` becomes real. */
  storageAuthority?: StorageAuthority;
  logRetentionPolicy?: RetentionPolicy;
  /** Additional sinks beyond the defaults derived from dataAuthority/storageAuthority. */
  sinks?: LogSink[];
  routingRules?: RoutingRule[];
  version?: string;
  memoryLimit?: number;
}

const DEFAULT_MEMORY_LIMIT = 2000;
const DATABASE_SEVERITIES = ['audit', 'critical', 'error', 'warning'] as const;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * IOLA — the Institutional Observability & Logging Authority (PHASE-10).
 * The sole authority for structured logging, correlation/trace, immutable
 * audit logging, diagnostics, and the Institutional Observability Graph.
 * No authority writes to a log destination directly (Law 1); every log
 * entry must conform to a pre-registered (category, operation) schema
 * (Law 2, mirroring the Event Bus's EventRegistry).
 */
export class ObservabilityAuthority {
  readonly categories = new LogCategoryRegistry();
  readonly schemas = new LogSchemaRegistry();
  readonly audit = new AuditLogTrail();
  readonly diagnostics: DiagnosticsEngine;
  readonly graph: ObservabilityGraph;

  private readonly version: string;
  private readonly router: LogRouter;
  private readonly memoryLimit: number;
  private readonly storageAuthority?: StorageAuthority;
  private storageEntryId?: string;

  private index: StructuredLogRecord[] = [];
  private totalLogged = 0;
  private readonly bySeverity: Record<string, number> = {};
  private routingFailureCount = 0;
  private readonly routingDurations: number[] = [];
  private retentionExecutionCount = 0;
  private readonly retentionDurations: number[] = [];

  constructor(options: ObservabilityAuthorityOptions = {}) {
    this.version = options.version ?? '1.0.0';
    this.memoryLimit = options.memoryLimit ?? DEFAULT_MEMORY_LIMIT;
    this.diagnostics = new DiagnosticsEngine(() => this.index);
    this.graph = new ObservabilityGraph(() => this.index);
    this.storageAuthority = options.storageAuthority;

    const sinks: LogSink[] = [...(options.sinks ?? [new ConsoleLogSink()])];

    if (options.dataAuthority) {
      if (!options.dataAuthority.schemas.has(RUNTIME_LOG_DOMAIN)) {
        options.dataAuthority.registerDomainSchema(RUNTIME_LOG_SCHEMA);
      }
      sinks.push(new DatabaseLogSink(options.dataAuthority));
    }

    if (options.storageAuthority) {
      const entry = options.storageAuthority.allocate('telemetry', 'iola-logs', {
        retentionPolicy: options.logRetentionPolicy ?? { maxAgeMs: 30 * 24 * 60 * 60 * 1000 },
      });
      this.storageEntryId = entry.storageId;
      sinks.push(new FileLogSink(entry.path));
    }

    const defaultRules: RoutingRule[] = [];
    if (sinks.some((sink) => sink.name === 'database')) {
      const nonDatabaseSinkNames = sinks.filter((sink) => sink.name !== 'database').map((sink) => sink.name);
      const allSinkNames = sinks.map((sink) => sink.name);
      for (const severity of DATABASE_SEVERITIES) {
        defaultRules.push({ severity, sinks: allSinkNames });
      }
      for (const severity of ['information', 'debug', 'trace'] as const) {
        defaultRules.push({ severity, sinks: nonDatabaseSinkNames });
      }
    }

    this.router = new LogRouter(sinks, [...(options.routingRules ?? []), ...defaultRules]);
  }

  registerCategory(category: string): void {
    this.categories.register(category);
  }

  registerSchema(schema: LogSchemaDefinition): void {
    if (!this.categories.has(schema.category)) throw new UnregisteredLogCategoryError(schema.category);
    this.schemas.register(schema);
  }

  newCorrelationId(): string {
    return randomUUID();
  }

  newTraceId(): string {
    return randomUUID();
  }

  /** §Law 1/§Law 2 — the sole entry point for platform logging. Throws if
   * the category is unregistered, if the (category, operation) pair has no
   * registered schema, or if a schema's required context fields are missing. */
  log(entry: LogEntryInput): StructuredLogRecord {
    if (!this.categories.has(entry.category)) throw new UnregisteredLogCategoryError(entry.category);
    const schema = this.schemas.require(entry.category, entry.operation);
    if (schema.requiredContextFields) {
      const missing = schema.requiredContextFields.filter((field) => !entry.context || !(field in entry.context));
      if (missing.length > 0) {
        throw new LogSchemaValidationError(entry.category, entry.operation, missing);
      }
    }

    const record: StructuredLogRecord = {
      ...entry,
      context: maskSensitiveContext(entry.context),
      logId: randomUUID(),
      timestamp: new Date().toISOString(),
      version: this.version,
    };

    this.index.push(record);
    if (this.index.length > this.memoryLimit) this.index.shift();

    if (record.severity === 'audit') this.audit.record(record);

    const start = performance.now();
    const failures = this.router.route(record, (sinkName, error) => this.emergencyLog(sinkName, error));
    this.routingDurations.push(performance.now() - start);
    this.routingFailureCount += failures;

    this.totalLogged += 1;
    this.bySeverity[record.severity] = (this.bySeverity[record.severity] ?? 0) + 1;

    return record;
  }

  findByCorrelation(correlationId: string): StructuredLogRecord[] {
    const records = this.graph.chainFor(correlationId);
    if (records.length === 0) throw new CorrelationNotFoundError(correlationId);
    return records;
  }

  findByTrace(traceId: string): ObservabilityChain[] {
    const chains = this.graph.traceFor(traceId);
    if (chains.length === 0) throw new TraceNotFoundError(traceId);
    return chains;
  }

  search(predicate: (record: StructuredLogRecord) => boolean): StructuredLogRecord[] {
    return this.index.filter(predicate);
  }

  enforceRetention(): RetentionResult | undefined {
    if (!this.storageAuthority || !this.storageEntryId) return undefined;
    const start = performance.now();
    const result = this.storageAuthority.enforceRetention(this.storageEntryId);
    this.retentionDurations.push(performance.now() - start);
    this.retentionExecutionCount += 1;
    return result;
  }

  getMetrics(): IolaMetrics {
    return {
      totalLogged: this.totalLogged,
      bySeverity: { ...this.bySeverity },
      routingFailureCount: this.routingFailureCount,
      averageRoutingLatencyMs: average(this.routingDurations),
      retentionExecutionCount: this.retentionExecutionCount,
    };
  }

  /** §17 — deliberately bypasses `log()`/`router` entirely. A sink failure
   * must never trigger another `log()` call routed through the same sink,
   * which would recurse; this is the platform's one intentional, undeclared
   * escape hatch, reserved solely for reporting IOLA's own routing failures. */
  private emergencyLog(sinkName: string, error: Error): void {
    console.error(`[IOLA] sink "${sinkName}" failed: ${error.message}`);
  }
}
