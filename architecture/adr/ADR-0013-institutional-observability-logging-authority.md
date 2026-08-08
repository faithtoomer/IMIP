# ADR-0013: Institutional Observability & Logging Authority

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 10  
**Deciders:** Architectural Authority (Specification), User (naming/scope + IOG timing)

## Context

The user again avoided a conventional name — "Logging Authority" — in favor of one that names the real scope: logging is one pillar of observability alongside metrics, tracing, diagnostics, correlation, and explainability, and building only a logger now would force a redesign later. Two things needed resolving before implementation: whether the Institutional Observability Graph (§23) should be built now or reserved, and how the several genuinely open design questions in the spec (log persistence domain, sync-vs-async API, database-sink volume, self-referential logging risk) should be resolved.

The §23 wording — "This is the enhancement I'd reserve from the beginning" — was genuinely ambiguous: it could mean "build it in from day one" (matching how IDA's Knowledge Model and ISMA's Topology were both built in full, not deferred) or "hold it in reserve for later" (matching Phase 05's Event Intelligence & Correlation Engine, which remains unbuilt). Clarified directly: build it now.

## Decisions

1. **`LogCategoryRegistry` is a real runtime registry, not a closed compile-time union** — unlike `EventCategory`/`DataDomain`, §6 explicitly says "future categories shall be registered," which is a runtime operation a TS union can't perform. The 19 named categories seed the registry; `registerCategory()` adds more without a source change.
2. **`log()` requires a pre-registered (category, operation) schema — no exceptions, no pre-populated catalog of guessed operations.** Mirrors the Event Bus's `EventRegistry` exactly: IOLA doesn't fabricate schemas on behalf of authorities that haven't adopted it yet (the same "real mechanism, zero registrations beyond what's genuinely needed" posture used for `DataMigrationRunner`, `KnowledgeGraph`, and ASIC discovery).
3. **`log()`, `LogRouter.route()`, and every sink's `write()` are synchronous.** A hard constraint carried forward from ADR-0012: any authority must be able to call IOLA from a synchronous code path without becoming async. `FileLogSink` uses `appendFileSync`; `DatabaseLogSink` calls IDA's already-synchronous `create()`.
4. **A new `runtime-logs` `DataDomain` was added** (additive widening of `DataDomain`, the same move ADR-0012 made for `EventCategory`'s `'storage'` value) rather than reusing IDA's existing `'audit-logs'` domain. IDA's `'audit-logs'` is IDA's own internal write-audit-trail (create/update/delete/purge of *data* records) — a different producer and a different shape than IOLA's platform-wide operational log records. Reusing it would conflate the two.
5. **`FileLogSink` rotates one JSONL file per UTC day, not one continuously-growing file.** §13 explicitly requires "retention execution integrates with the Storage Authority," but ISMA's real retention enforcement (Phase 09) ages out *files* in a directory by count/age — it has nothing to act on against a single ever-growing file. Day-rotation is what makes the required integration actually do something, reusing Phase 09's already-built mechanism unchanged.
6. **A default routing rule keeps low-severity logs off the database sink.** When a `DataAuthority` is supplied, `audit`/`critical`/`error`/`warning` route to it by default; `information`/`debug`/`trace` don't, unless `routingRules` overrides it. Every log line at trace/debug volume becoming a full ACID SQLite write is a real performance trap the spec's "routing policies are configurable" language doesn't preclude avoiding.
7. **Sink failures are reported through a private `emergencyLog()` that bypasses `log()`/the router entirely**, never by calling `this.log()` again. §17 explicitly names "without causing recursive logging loops" as a requirement; the only way to guarantee that is for the failure-reporting path to structurally not be able to re-enter the same routing logic that just failed.
8. **An optional `causationId` field was added to `StructuredLogRecord`**, beyond §8's literal field list — mirroring the Event Bus's own `EventEnvelope.causationId` for platform-wide consistency, and giving the Observability Graph (§23) precise causal edges instead of relying solely on chronological co-occurrence within a `correlationId` (a real but weaker signal: two independently-caused records can share a correlationId at similar times).
9. **The Institutional Observability Graph (§23) is built in full**, per the user's clarified direction, once the ambiguous "reserve from the beginning" wording was resolved. `ObservabilityGraph.chainFor()` reproduces the spec's own linear example exactly; `traceFor()`/`describe()` extend it to multi-chain and platform-wide views.
10. **No retrofit of the six existing authorities was performed.** Law 1 ("no authority implements independent logging mechanisms") had nothing live to correct — a repository-wide grep for `console.log`/`console.warn`/`console.error` across every authority's `src/` found zero matches. This is a clean, additive build, not a Law-3-style correction of an existing conflict.

## Consequences

- Any future authority that wants to log through IOLA registers its own categories/schemas and calls `log()` — no changes to IOLA itself required, the same generic-registration pattern used everywhere else in this platform.
- `runtime-logs` joins `'storage'` (ADR-0012) as the second additive extension to a Program I type union — Program II authorities are expected to keep extending these unions as needed, not to route around them.
- The Observability Graph is queryable the moment any two log calls share a `correlationId`, with no separate indexing step or background job — it reads directly off the same in-memory index every other query surface uses.
- Adopting IOLA inside ICMS/IHIS/IEB/IRBLM/IDA/ISMA (each gaining an optional `observabilityAuthority` constructor option) remains a real, low-risk, and explicitly deferred follow-up — nothing about this phase blocks it.
