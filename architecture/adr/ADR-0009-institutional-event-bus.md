# ADR-0009: Institutional Event Bus & Reserved Event Intelligence

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 05  
**Deciders:** Architectural Authority (Specification)

## Context

ICMS (Phase 02) and IHIS (Phase 03) both ship interim, per-module `EventEmitter` wrappers, explicitly documented in their source as "standing in for the institutional Event Bus... until it is implemented." Phase 05 is that implementation. It also needed real decisions on delivery-ordering semantics and on how far to build the "Event Intelligence & Correlation Engine" the spec proposes.

## Decisions

1. **Real priority queue, not a naive array.** `PriorityEventQueue` is a binary min-heap keyed by (priority rank, insertion sequence) — O(log n) enqueue/dequeue with deterministic FIFO tie-breaking within a priority tier, matching Law 4.
2. **Draining is deferred to a microtask, not started inline.** The first `scheduleDrain()` call for a burst of async publishes must not begin dispatching before the rest of that synchronous burst has finished enqueuing — otherwise the very first event "wins" regardless of its priority, defeating the point of the priority queue. `queueMicrotask()` lets a same-tick burst fully enqueue before any of it is dispatched.
3. **Circular-publication detection is scoped to synchronous/awaited recursive chains**, tracked via a call-stack of in-flight event *names* (not instance ids) on the bus instance. It catches direct and indirect (A→B→A) cycles formed within one `publish()` call's descendant dispatch tree. It cannot detect cycles formed by independently-triggered async events published later from unrelated code paths — that is inherent to any event-driven system and is documented as a scope boundary, not silently pretended away.
4. **A nested publish's subscriber failure is recorded on that nested event's own audit, not propagated to the outer event's audit.** Each `publish()` call owns its own `EventAuditRecord`; a handler that awaits a nested `publish()` and doesn't itself throw is recorded as successful, even if the nested event it triggered failed for its own subscribers. This preserves per-event auditability (§14 — every event's audit reflects only its own dispatch) rather than conflating causally-related but distinct events into one outcome.
5. **'database' persistence mode and the Event Intelligence & Correlation Engine (EICE) are real, empty-by-design extension points, not implementations.** `EventPersistence` is the interface a future Database Authority-backed class will implement; `correlationId`/`causationId` already exist on every envelope so EICE can be built later purely as a *consumer* of existing audit/persistence data, without redesigning the bus. Neither ships any code beyond the interface/data model — there is nothing to connect a database mode to yet, and no correlation/pattern-detection logic was written, per explicit instruction that EICE is reserved, not implemented.
6. **ICMS and IHIS are connected to the IEB via a mirror/bridge, not a full migration.** A full migration (making the IEB the literal sole event mechanism, per Law 1's letter) would require making `ConfigurationAuthority.load()`/`requestUpdate()`/`rollback()` and most of `HardwareAuthority`'s mutation methods `async`, breaking both modules' certified synchronous public APIs and touching ~15–20 already-passing test files for no functional gain. Instead, `ConfigEventBus` and `HardwareEventBus` keep local `EventEmitter`-based delivery as their primary, synchronous mechanism (zero API change, zero test churn) and additionally register their real event catalogs with a shared `InstitutionalEventBus` and fire-and-forget mirror every publish onto it. A mirror failure (e.g. a saturated queue) is swallowed and never affects local delivery. This is a deliberate, documented trade-off: full Law 1 compliance was not chosen over API stability for two already-certified phases — see `docs/phase-05/event-bus-connection.md`.

## Consequences

- Every future authority publishes and subscribes through the IEB; no authority may build its own event mechanism (Law 1) — new authorities have no interim bus to fall back on and go straight to the IEB.
- Event ownership is structurally enforced — `publish()` throws if the caller isn't the registered owner, closing off the "who's allowed to say this happened" question at the infrastructure level rather than leaving it to convention.
- When a Database Authority and EICE are eventually built, they are additive: a new `EventPersistence` implementation and a new consumer of `getEventHistory()`/`getAuditRecord()`, respectively — no changes to `InstitutionalEventBus` itself.
- ICMS and IHIS are connected to the IEB (mirror/bridge, point 6) — their events are now discoverable, audited, and cross-subscribable through the IEB by any consumer holding only a bus reference, without either module's synchronous API changing. A future full migration remains possible but is not required for this connection to be real.
