# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM I — FOUNDATION

## Phase 05

# Institutional Event Bus (IEB)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Foundational Authority

> IEB is the real implementation of the "Event Bus" referenced throughout `architecture/RUNTIME_ARCHITECTURE.md` §6 and used as the interim-until-real-thing justification in ICMS (`core/configuration_authority/src/events.ts`) and IHIS (`core/hardware_authority/src/events.ts`). Retargeting those interim buses onto the IEB is a deliberate follow-up, not done as part of this phase — see `docs/phase-05/implementation-summary.md` §6.

---

# 1. Mission Statement

The IEB is the sole institutional communication backbone for IMIP: reliable, deterministic, observable, auditable, extensible event-driven communication between all authorities, plugins, services, and future components. No authority implements its own event system or communicates through ad-hoc messaging.

---

# 2. Objectives

Publication, subscription, routing, filtering, prioritization, auditing, replay (future-ready, not implemented), configurable persistence, diagnostics, explainability, structured metadata, deterministic ordering.

---

# 3. Institutional Principles

1. **Single Communication Backbone** — the IEB is the only institutional event system.
2. **Event Ownership** — every event has exactly one publishing authority (enforced at `publish()`).
3. **Loose Coupling** — authorities communicate through events, not direct dependencies.
4. **Deterministic Delivery** — ordering, where it matters, is deterministic and documented (priority + FIFO within a tier; see `queue.ts`).
5. **Explainability** — every event answers what/who/why/who-consumed-it/success/duration.
6. **No Silent Events** — every published event is observable and traceable via its `EventAuditRecord`.

---

# 4. Responsibilities

IEB owns: event definitions, registration, routing, subscription management, metadata, delivery, auditing, diagnostics, filtering, priorities, configurable history, and the reserved replay/correlation extension point (§24).

IEB does **not** own: business logic, decision making, mining, scheduling, hardware management, plugin execution.

---

# 5. Runtime Architecture

```text
Publisher → Event Definition (registry) → Validation (ownership + payload)
  → Envelope → [sync: immediate dispatch | async: priority queue] → Subscriber fan-out
  → Audit & Diagnostics
```

Implemented in `InstitutionalEventBus.ts`, orchestrating `registry.ts`, `queue.ts`, `subscriptions.ts`, `persistence.ts`.

---

# 6. Event Lifecycle

Created → Validated → Published → Queued (async only) → Dispatched → Consumed → Completed → Audited → Archived (via configurable persistence). No stage is skippable — `publish()` runs them in this order unconditionally.

---

# 7. Event Registry

`EventRegistry` (`registry.ts`) — SSOT for event definitions: id, name, category, description, publisher authority, allowed subscribers, priority, delivery mode, targeting, payload validator, version, deprecation. Duplicate registration throws.

---

# 8. Event Categories

`EventCategory` (`types.ts`): configuration, capability, plugin, hardware, runtime, mining, scheduler, power, thermal, health, database, security, profitability, decision, ai, dashboard, notification, diagnostics — all 18 from the spec.

---

# 9. Event Metadata

`EventEnvelope`: eventId, eventType, eventVersion, timestamp, publisher, correlationId, causationId, severity, priority, payload, processingStatus, plus optional traceId/parentEventId/retryCount/processingDurationMs — every field from §9.

---

# 10. Event Delivery

`DeliveryMode` = `sync` (dispatches inline, strict publish order) | `async` (priority-queued, may reorder relative to other concurrently-pending async events). `DeliveryTargeting` = `broadcast` (all matching subscriptions) | `directed` (only subscriptions whose authority is listed in `targetAuthorities`, required for directed events).

---

# 11. Subscription Management

`subscribeToEvent()` (specific event, must be registered) and `subscribeToCategory()` (whole category, present and future events). Both support a `filter` predicate. `allowedSubscribers` on a definition restricts who may subscribe at all.

---

# 12. Event Routing

Routing is driven entirely by the registry + subscription tables — no authority name is hardcoded into the dispatch path. Every routing decision (who a given event was delivered to) is recorded on its `EventAuditRecord`.

---

# 13. Event Priorities

`critical | high | normal | low | background` — `PriorityEventQueue` is a binary min-heap keyed by (priority rank, insertion sequence), so priority governs order without affecting ownership.

---

# 14. Event Auditing

`EventAuditRecord`: publisher, subscriberResults (one per matched subscription: success, duration, error), overallDurationMs, outcome (`completed | failed | partial | no-subscribers`). Nothing is processed without producing one.

---

# 15. Event Explainability

Every envelope + audit pair together answer identity, origin, publisher, subscribers, processing path, completion status, timing, and outcome — queryable via `getEventDefinition()`, `getSubscriptions()`, `getAuditRecord()`, `getEventHistory()`.

---

# 16. Error Handling

`UnregisteredEventError`, `PublisherOwnershipViolationError`, `SubscriberNotAllowedError`, `PayloadValidationError`, `CircularPublicationError` (sync-mode, scoped to synchronous/awaited recursive chains — documented limitation, not silently ignored), `QueueOverflowError`, `DuplicateEventDefinitionError`, `MissingTargetAuthoritiesError`. A subscriber throwing or rejecting is caught per-subscriber (`Promise.allSettled`) and never stops delivery to the rest or crashes the bus; three consecutive failures marks that subscription dead.

---

# 17. Event Persistence

`EventPersistence` interface with `NoopEventPersistence` (mode: none), `MemoryEventPersistence` (mode: memory, bounded ring buffer), `FileEventPersistence` (mode: file, JSONL). Mode 'database' is achieved by supplying a custom `EventPersistence` implementation once a Database Authority exists — no concrete class ships for it, since there is nothing to connect to yet (same deferred-integration pattern as ADR-0008).

---

# 18. Public Interfaces

`registerEventType()`, `subscribeToEvent()`/`subscribeToCategory()` (+ returned unsubscribe closures), `publish()`, `getEventDefinition()`/`getEventDefinitions()`, `getSubscriptions()`, `getEventHistory()`, `getAuditRecord()`, `getMetrics()`. No direct queue manipulation is exposed.

---

# 19. Performance Requirements

Subscribers fan out concurrently (`Promise.allSettled`), not serially — one slow subscriber never blocks another. `getMetrics()` (totalPublished, totalDispatched, totalFailedDeliveries, queueDepth, averageDispatchMs, deadSubscriptions) is the read surface a future Telemetry Authority will consume.

---

# 20. Testing Requirements

57 tests across 11 files: registry, priority-queue ordering/overflow, subscription matching/dead-detection, persistence (all three real modes), publish/subscribe fundamentals + ownership + payload validation, delivery modes (sync/async/broadcast/directed), failure isolation, circular-publication detection, audit/explainability, metrics, performance smoke tests.

---

# 21. Acceptance Criteria

Every event type registered before use. Ownership enforced. Subscription management correct. Routing deterministic. Priority operational. Audit records complete. Explainability available. Subscriber failures don't stop the bus. Public interfaces read-only except the named workflows. Tests pass. Documentation complete.

---

# 22. Cursor Implementation Contract — Compliance Note

'database' persistence mode and the Event Intelligence & Correlation Engine (§24) are real, documented extension points with nothing plugged in — not placeholder code. See ADR-0009.

---

# 24. Architect's Enhancement: Event Intelligence & Correlation Engine (EICE) — Reserved

**Not implemented in Phase 05.** The data this would consume already exists (`correlationId`/`causationId` on every envelope, full audit history via `EventPersistence`), so EICE can be added later without redesigning the bus. Its future responsibilities (correlating events into timelines, detecting abnormal patterns, building causal chains, flow visualization, feeding the future ML program) are documented but not built — see `architecture/adr/ADR-0009-institutional-event-bus.md` §"Reserved: EICE".
