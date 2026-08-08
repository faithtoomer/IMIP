/** §6 — the 19 named categories the spec requires at minimum. Unlike the
 * closed compile-time unions used elsewhere (DataDomain, EventCategory),
 * §6 explicitly says "future categories shall be registered" — a runtime
 * requirement, not a compile-time one — so `LogCategoryRegistry` (not a TS
 * union) is the source of truth; this list only seeds it. */
export const DEFAULT_LOG_CATEGORIES = [
  'runtime',
  'configuration',
  'capability',
  'plugin',
  'hardware',
  'mining',
  'decision',
  'profitability',
  'power',
  'thermal',
  'health',
  'security',
  'scheduler',
  'api',
  'dashboard',
  'database',
  'storage',
  'diagnostics',
  'audit',
] as const;

export type DefaultLogCategory = (typeof DEFAULT_LOG_CATEGORIES)[number];

/** §7. */
export type LogSeverity = 'trace' | 'debug' | 'information' | 'warning' | 'error' | 'critical' | 'audit';

export interface LogExceptionInfo {
  name: string;
  message: string;
  stack?: string;
}

export interface LogContext {
  [key: string]: unknown;
}

/**
 * §8 — every field the spec requires, plus one addition: `causationId`
 * (optional). It's absent from §8's literal field list, but the Event Bus's
 * own `EventEnvelope` already carries one (Phase 05) — adding it here gives
 * the Observability Graph (§23) precise causal edges instead of only
 * chronological co-occurrence within a `correlationId`. See ADR-0013.
 */
export interface StructuredLogRecord {
  logId: string;
  timestamp: string;
  severity: LogSeverity;
  category: string;
  authority: string;
  component?: string;
  eventId?: string;
  correlationId?: string;
  traceId?: string;
  causationId?: string;
  operation: string;
  message: string;
  context?: LogContext;
  result?: 'success' | 'failure' | 'partial';
  durationMs?: number;
  exception?: LogExceptionInfo;
  version: string;
  hostId?: string;
  sessionId?: string;
}

/** What a caller supplies to `log()` — IOLA fills in `logId`/`timestamp`/`version`. */
export type LogEntryInput = Omit<StructuredLogRecord, 'logId' | 'timestamp' | 'version'>;

/** §Law 2 — every (category, operation) pair must be registered before use,
 * the same "no undeclared event types" discipline the Event Bus's
 * `EventRegistry` already enforces for event names. */
export interface LogSchemaDefinition {
  category: string;
  operation: string;
  description: string;
  requiredContextFields?: string[];
}

/** §12 — routing policy. Rules are evaluated in order; the first match wins.
 * No match falls back to every configured sink. */
export interface RoutingRule {
  category?: string;
  severity?: LogSeverity;
  sinks: string[];
}

export interface IolaMetrics {
  totalLogged: number;
  bySeverity: Record<string, number>;
  routingFailureCount: number;
  averageRoutingLatencyMs: number;
  retentionExecutionCount: number;
}

export interface ObservabilityChain {
  correlationId: string;
  steps: StructuredLogRecord[];
}

export interface ObservabilityGraphSnapshot {
  generatedAt: string;
  chains: ObservabilityChain[];
}
