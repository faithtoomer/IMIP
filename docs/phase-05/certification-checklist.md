# Phase 05 — Certification Checklist (IEB)

**Specification:** `specs/PHASE-05-institutional-event-bus.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria (§21)

| Criterion | Certified | Evidence |
|---|---|---|
| Every event type is registered before use | YES | `EventRegistry`; `publish()`/`subscribeToEvent()` both call `require()` |
| Event ownership is enforced | YES | `PublisherOwnershipViolationError`; `tests/publish-subscribe.test.ts` |
| Subscription management functions correctly | YES | `SubscriptionRegistry`; `tests/subscriptions.test.ts` |
| Routing is deterministic | YES | Event-name matches before category matches, both in registration order |
| Priority handling is operational | YES | `PriorityEventQueue`; `tests/queue.test.ts`, `tests/delivery-modes.test.ts` |
| Audit records are complete | YES | `EventAuditRecord`; `tests/audit-explainability.test.ts` |
| Explainability is available | YES | `getEventDefinition`/`getSubscriptions`/`getAuditRecord`/`getEventHistory` |
| Subscriber failures do not stop the bus | YES | `tests/failure-isolation.test.ts` (5 tests) |
| Public interfaces are complete | YES | §18 surface fully implemented |
| Tests pass | YES | 11 files / 57 tests (233 total), `npx vitest run` |
| Documentation is complete | YES | `core/event_bus/README.md`, this directory |

## Addendum — ICMS/IHIS Connection (2026-08-08)

| Requirement | Certified | Evidence |
|---|---|---|
| ICMS and IHIS mirror their event catalogs onto the IEB | YES | `configuration_authority/src/events.ts`, `hardware_authority/src/events.ts` |
| Local synchronous delivery unchanged for both modules | YES | `tests/event-bus-mirror.test.ts` in each module (existing 176 tests unaffected) |
| An independent subscriber with no reference to either authority observes both event streams via the IEB | YES | `core/event_bus/tests/cross-authority-integration.test.ts` |
| A mirror failure never affects local delivery | YES | Deterministic saturated-queue test in `configuration_authority/tests/event-bus-mirror.test.ts` |

See `docs/phase-05/event-bus-connection.md` and ADR-0009 §6.

## Institutional Completion Standard (§22 contract)

| Requirement | Certified |
|---|---|
| No ad-hoc event creation permitted | YES — `require()` throws for anything unregistered |
| No undefined event publication | YES |
| No direct authority messaging outside the bus | YES — the bus is the only mechanism shipped |
| One subscriber failure never stops delivery | YES |
| No duplicate event infrastructure elsewhere | YES — ICMS/IHIS's local buses now mirror onto the IEB rather than existing as an unconnected second implementation |
| No placeholder or incomplete implementations | YES — 'database' persistence and EICE are real, complete, currently-empty-by-design extension points (ADR-0009) |

## Architect's Enhancement (§24 — EICE)

| Requirement | Certified |
|---|---|
| Explicitly not implemented in Phase 05 | YES |
| Data model supports it without redesign (correlationId/causationId on every envelope, full audit history via persistence) | YES |

## Certification Statement

Phase 05 — Institutional Event Bus (IEB) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08, with the ICMS/IHIS mirror connection certified the same day. Type-check (src + tests), build, and the full 248-test suite (57 for IEB, 15 for the connection) pass.
