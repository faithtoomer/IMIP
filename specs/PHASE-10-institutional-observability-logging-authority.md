# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 10

# Institutional Observability & Logging Authority (IOLA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Core Infrastructure Authority

> Named deliberately broader than "Logging Authority" — logging is one pillar of observability, alongside metrics, tracing, diagnostics, correlation, and explainability. Building only a logger now would mean redesigning it later. See ADR-0013.

---

# 1. Mission Statement

IOLA is the sole authority for structured logging, runtime observability, diagnostics, traceability, operational auditing, and telemetry integration across IMIP. No authority implements independent logging mechanisms; all runtime logs originate through IOLA.

---

# 2. Mission Objectives

Structured logging, log routing, categorization, filtering, correlation IDs, trace IDs, runtime diagnostics, operational auditing, retention, archival, explainability integration, metrics integration, future distributed tracing support.

---

# 3. Institutional Principles

1. **Single Logging Authority** — IOLA is the sole owner of runtime logging.
2. **Structured Logging Only** — free-form string logging is prohibited; every log entry conforms to a pre-registered (category, operation) schema (`LogSchemaRegistry`), mirroring the Event Bus's `EventRegistry` discipline.
3. **Correlation** — every log supports correlation with events, authorities, runtime operations, decisions, transactions, and components via `correlationId`/`traceId`/optional `causationId`.
4. **Explainability** — every log answers what/why/which-authority/which-component/outcome/success.
5. **Security** — sensitive information never appears in logs; masking is unconditional (§14), not opt-in.

---

# 4. Responsibilities

IOLA owns: structured logging, log schemas, routing, categorization, correlation/trace IDs, runtime diagnostics, audit logging, retention, archival, explainability, logging metrics. IOLA does **not** own: business logic, decision-making, event routing, database persistence policy, or notification delivery.

---

# 5. Runtime Architecture

```text
Authorities
        │
        ▼
Institutional Observability & Logging Authority
        │
        ├──────── Log Category / Schema Registries (Law 2)
        ├──────── Structured Logger (log())
        ├──────── Audit Log Trail (structurally immutable)
        ├──────── Diagnostics Engine
        ├──────── Observability Graph (§23)
        └──────── Log Router
                    │
                    ▼
        Console / Memory / File (ISMA) / Database (IDA)
```

`log()` and `LogRouter.route()` are deliberately synchronous (plain `fs` sync calls in `FileLogSink`, IDA's already-synchronous `create()` in `DatabaseLogSink`) — the same constraint established in ADR-0012, so any authority can call IOLA from a synchronous code path without becoming async.

---

# 6. Log Categories

19 named categories, pre-seeded into a real, extensible `LogCategoryRegistry` (not a closed compile-time union, since §6 requires future categories to be *registered* — a runtime operation): `runtime`, `configuration`, `capability`, `plugin`, `hardware`, `mining`, `decision`, `profitability`, `power`, `thermal`, `health`, `security`, `scheduler`, `api`, `dashboard`, `database`, `storage`, `diagnostics`, `audit`.

---

# 7. Log Levels

`trace | debug | information | warning | error | critical | audit` (`LogSeverity`).

---

# 8. Structured Log Schema

Every `StructuredLogRecord` carries every field §8 requires (logId, timestamp UTC, severity, category, authority, component, eventId, correlationId, traceId, operation, message, context, result, durationMs, exception, version, hostId, sessionId), plus one addition: optional `causationId`, for precise Observability Graph edges (mirrors the Event Bus's own `EventEnvelope.causationId`). See ADR-0013.

---

# 9. Correlation & Traceability

`newCorrelationId()`/`newTraceId()` generate real UUIDs; `findByCorrelation()`/`findByTrace()` query the accumulated log index. These flow through any code path that calls `log()` — the mechanism is generic, not wired specifically into the Event Bus/IDA/IRBLM's internals this phase (no authority currently free-form-logs; see §21).

---

# 10. Audit Logging

Any `log()` call with `severity: 'audit'` is additionally captured in `AuditLogTrail` — structurally immutable, no update or delete method exposed, mirroring `DataAuditTrail`'s (Phase 08) enforcement exactly.

---

# 11. Diagnostics

`DiagnosticsEngine` — real, log-driven queries over the accumulated record index: `componentDiagnostics()`, `failureDiagnostics()`, `startupDiagnostics()`, `recoveryDiagnostics()`, `healthDiagnostics()`, `explain(correlationId)`.

---

# 12. Log Routing

`LogRouter` with a pluggable `LogSink` interface: `ConsoleLogSink` (default), `MemoryLogSink`, `FileLogSink` (real, day-rotated JSONL under an ISMA-allocated directory), `DatabaseLogSink` (real writes through IDA). Routing rules match by category and/or severity, first match wins, no match falls back to every configured sink. **Deviation from a literal reading of "configurable"**: when a `DataAuthority` is supplied, a sensible default routing rule keeps `audit`/`critical`/`error`/`warning` on the database sink and keeps `information`/`debug`/`trace` off it — full per-line ACID persistence for high-volume, low-severity logs is a real performance trap, not something the spec's intent requires. Callers can override via `routingRules`. See ADR-0013.

---

# 13. Log Retention

`FileLogSink` rotates one JSONL file per UTC day inside its managed directory specifically so ISMA's real, already-built retention enforcement (Phase 09 — ages out files in a directory by count/age) has multiple files to act on; a single ever-growing file would give it nothing to enforce against. `enforceRetention()` delegates to `StorageAuthority.enforceRetention()` — no retention logic is reimplemented in IOLA.

---

# 14. Security

`maskSensitiveContext()` — unconditional, pattern-based redaction of freeform log `context` (password/secret/token/private-key/api-key/wallet/credential/passphrase/seed-phrase patterns), always applied inside `log()`, not opt-in. Unlike IDA's schema-declared `sensitive` fields (Phase 08), log context has no schema to declare against, so pattern matching is the only universal mechanism — matching Law 5's unconditional wording.

---

# 15. Explainability

Every `StructuredLogRecord` already carries operation/authority/eventId/correlationId/component/result; `DiagnosticsEngine.explain()` and `ObservabilityGraph.chainFor()` surface the full correlation chain.

---

# 16. Public Interfaces

`log()`, `registerCategory()`, `registerSchema()`, `newCorrelationId()`/`newTraceId()`, `findByCorrelation()`/`findByTrace()`, `search()`, `enforceRetention()`, `getMetrics()`, plus `audit`, `diagnostics`, and `graph` read surfaces. No consumer writes to a log destination directly.

---

# 17. Error Handling

`UnregisteredLogCategoryError`, `DuplicateLogCategoryError`, `UnregisteredLogSchemaError`, `DuplicateLogSchemaError`, `LogSchemaValidationError`, `CorrelationNotFoundError`, `TraceNotFoundError` — all typed. Sink failures are isolated per-sink (one broken destination never blocks the others) and reported via a private `emergencyLog()` that bypasses `log()`/the router entirely, so a routing failure can never trigger the recursive logging loop §17 prohibits.

---

# 18. Performance Metrics

`getMetrics()`: totalLogged, bySeverity, routingFailureCount, averageRoutingLatencyMs, retentionExecutionCount. **Deviation**: the spec's literal "queue depth"/"correlation success rate"/"trace completion rate" don't apply to a synchronous, no-queue design (§5) — there is no queue to have depth, and every correlation/trace lookup either finds real matching records or doesn't, with no separate "success rate" concept. See ADR-0013.

---

# 19. Testing Requirements

47 tests across 10 files: category/schema registries, security masking, all four sinks (including real file rotation and real IDA persistence), the router (including failure isolation), the audit trail (including structural immutability), diagnostics, the Observability Graph (including the spec's own example chain), the orchestrator end-to-end (Law 1/Law 2 enforcement, real IDA/ISMA wiring, sink-failure containment), and a performance smoke test.

---

# 20. Acceptance Criteria

All logging flows through IOLA. Structured schemas are enforced (Law 2). Correlation/trace IDs propagate and are queryable. Audit logs are immutable. Sensitive data is masked unconditionally. Routing is configurable with a safe default. Diagnostics are operational. Explainability is complete. Tests pass. Documentation is complete.

---

# 21. Institutional Completion Standard (ICS) / Compliance Note

No placeholder implementations — masking, routing, retention, and the Observability Graph all operate on real data. **No retrofit was needed**: unlike Phase 09's Law 3 conflict with IDA/ICMS, a repository-wide scan (`grep` for `console.log`/`console.warn`/`console.error` across every authority's `src/`) found zero existing ad-hoc logging to migrate away from — this is a clean, additive build, the same posture Phase 09 started from before the Law 3 revision. Adopting IOLA inside the other six authorities (each gaining an optional `observabilityAuthority` option) is a natural, low-risk follow-up, not required by this phase.

---

# 23. Architect's Enhancement: Institutional Observability Graph (IOG)

**Implemented in full**, per explicit direction — the ambiguous "reserve from the beginning" language was clarified before implementation began (build now, matching IDA's Knowledge Model and ISMA's Topology, not Phase 05's deferred EICE). `ObservabilityGraph.chainFor(correlationId)` reproduces exactly the spec's own example (Runtime Started → Configuration Loaded → Plugin Registered → Hardware Available → Decision Approved → Mining Started) as an ordered sequence; `traceFor()` groups multiple chains under one trace; `describe()` gives a platform-wide snapshot. Edges are explicit when a record's `causationId` names its cause's `logId`, falling back to chronological co-occurrence within a shared `correlationId` otherwise.
