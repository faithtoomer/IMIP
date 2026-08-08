# Institutional Observability & Logging Authority (IOLA)

**Status:** IMPLEMENTED (Phase 10)  
**Location:** `core/observability_authority/`  
**Authority:** PHASE-10 / ADR-0013

## Purpose

IOLA is the sole institutional authority for structured logging, correlation/tracing, immutable audit logging, diagnostics, and the Institutional Observability Graph. Named deliberately broader than "Logging Authority" — logging is one pillar of observability, not the whole of it.

## Layout

```text
core/observability_authority/
  src/
    types.ts                 LogSeverity, StructuredLogRecord, LogSchemaDefinition,
                               RoutingRule, IolaMetrics, DEFAULT_LOG_CATEGORIES (19), ...
    errors.ts                  Structured, typed error taxonomy
    categoryRegistry.ts          LogCategoryRegistry — real, runtime-extensible (§6)
    schemaRegistry.ts              LogSchemaRegistry — Law 2 (registered schemas only)
    security.ts                     maskSensitiveContext — always-on, pattern-based (Law 5)
    sinks.ts                          ConsoleLogSink, MemoryLogSink, FileLogSink (real,
                                       day-rotated JSONL), DatabaseLogSink (real IDA writes)
    router.ts                          LogRouter — rule-based routing, per-sink failure isolation
    auditTrail.ts                       AuditLogTrail — structurally immutable
    diagnostics.ts                       DiagnosticsEngine — real, log-driven queries
    graph.ts                              ObservabilityGraph — the Architect's Enhancement (§23)
    ObservabilityAuthority.ts               The orchestrator: log(), correlation/trace lookup,
                                             retention delegation, metrics
    index.ts                                 Public exports
  tests/                                      47 tests across 10 files
```

## Usage

```ts
import { ObservabilityAuthority } from './core/observability_authority/src/index.js';

const iola = new ObservabilityAuthority(); // console-only by default

// Law 2 — register before use:
iola.registerSchema({ category: 'runtime', operation: 'boot-started', description: 'Runtime boot began.' });

const correlationId = iola.newCorrelationId();
iola.log({
  severity: 'information',
  category: 'runtime',
  authority: 'Runtime Bootstrap',
  operation: 'boot-started',
  message: 'Boot sequence started.',
  correlationId,
});

// ... later, elsewhere, same correlationId ...
iola.log({
  severity: 'audit',
  category: 'runtime',
  authority: 'Runtime Bootstrap',
  operation: 'boot-started', // reusing a registered schema is fine
  message: 'Boot completed.',
  correlationId,
});

iola.findByCorrelation(correlationId);  // the ordered chain
iola.graph.chainFor(correlationId);     // same data, via the Observability Graph
iola.diagnostics.failureDiagnostics();  // real, log-driven
iola.getMetrics();
```

### Wiring into IDA / ISMA

```ts
const iola = new ObservabilityAuthority({
  dataAuthority: ida,        // audit/critical/error/warning persist through IDA by default
  storageAuthority: isma,    // real, day-rotated log files under an ISMA-allocated directory
});

iola.enforceRetention();     // delegates to ISMA's real retention enforcement (Phase 09)
```

## Scope Boundary

IOLA owns structured logging, schemas, routing, categorization, correlation/trace IDs, diagnostics, audit logging, retention delegation, explainability, and logging metrics — never business logic, decision-making, event routing, database persistence policy, or notification delivery (§4).

## Governance

- Every log entry's (category, operation) pair must be pre-registered (Law 2) — no free-form logging.
- Sensitive context fields are masked unconditionally (Law 5), not opt-in — pattern-based, since freeform log context has no schema to declare sensitivity against.
- `log()` and every sink are synchronous, so any authority can call IOLA without becoming async.
- `AuditLogTrail` exposes no update or delete method for any reason — immutability is structural.
- A sink failure is isolated to that sink and reported via a path that bypasses `log()`/the router entirely — a routing failure can never trigger a recursive logging loop (§17).
- `runtime-logs` is a new, additive `DataDomain` (IDA) distinct from IDA's own internal `'audit-logs'` — different producer, different shape, no conflation.
