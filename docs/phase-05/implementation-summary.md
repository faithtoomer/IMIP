# Phase 05 — Implementation Summary (IEB)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-05-institutional-event-bus.md`  
**Branch:** `cursor/phase-00-repository-governance-5130`

---

## 1. Executive Summary

Phase 05 implements the Institutional Event Bus (IEB) — IMIP's third production module and its real communication backbone, replacing the "interim, standing in for the real thing" justification that ICMS's `ConfigEventBus` and IHIS's `HardwareEventBus` have carried since Phase 02/03.

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Event registry (SSOT) | `src/registry.ts` | §1 Law 1, §7 |
| Priority queue (binary min-heap) | `src/queue.ts` | §13, §19 |
| Subscription management + dead-subscriber tracking | `src/subscriptions.ts` | §11, §16 |
| Persistence (none/memory/file; database = extension point) | `src/persistence.ts` | §17 |
| Errors | `src/errors.ts` | §16 |
| Orchestrator + public API | `src/InstitutionalEventBus.ts` | §5, §6, §18 |

57 tests across 11 files (`tests/`).

---

## 3. Key Decisions

1. **Real binary-heap priority queue**, not an array sorted on every insert — O(log n), deterministic FIFO within a priority tier.
2. **Drain start deferred to a microtask.** Caught and fixed during testing: starting the drain loop inline on the first `enqueue()` let that first item begin dispatching before a same-tick burst of other publishes had even finished enqueuing, silently defeating priority reordering. `queueMicrotask()` fixes it.
3. **Circular-publication detection is scoped to synchronous/awaited recursive chains** via a call-stack of in-flight event names. Direct and indirect (A→B→A) cycles within one `publish()` call's descendant tree are caught; cycles formed by independently-triggered async events are not, and that boundary is documented rather than papered over.
4. **Per-event audit isolation**: a nested `publish()`'s subscriber failures land on *that* event's own `EventAuditRecord`, not the outer event's — each event's audit reflects only its own dispatch outcome.
5. **'database' persistence mode and the Event Intelligence & Correlation Engine are real, empty-by-design extension points** — no Database Authority exists to connect a database-backed `EventPersistence` to, and EICE was explicitly specified as reserved, not implemented. Both are documented, not faked.

See ADR-0009 for full rationale.

---

## 4. Verification

```text
npx tsc --noEmit -p tsconfig.json         → clean (src)
npx tsc --noEmit (src + tests combined)    → clean (caught real bugs: NoopEventPersistence's
                                              zero-arg method signatures, several test handlers
                                              returning a number where void was expected)
npm run build                              → dist/ emitted successfully
npx vitest run                             → 39 files, 233 tests, 233 passed (57 new for Phase 05)
```

---

## 5. Actions Not Performed (By Law)

- No business logic, decision-making, mining, scheduling, or hardware-management logic in the bus (§4 explicit exclusions)
- No database-backed persistence implementation (no Database Authority exists yet)
- No Event Intelligence & Correlation Engine implementation (§24 — explicitly reserved)
- No full migration of ICMS/IHIS onto the IEB as their sole event mechanism — connected via mirror instead (ADR-0009 §6, `docs/phase-05/event-bus-connection.md`)

---

## 6. Follow-Up

| Item | Status |
|---|---|
| Connect `ConfigEventBus` (ICMS) and `HardwareEventBus` (IHIS) to the IEB | **Done** (2026-08-08) — mirror/bridge, see `event-bus-connection.md` |
| Full migration (IEB as ICMS/IHIS's sole mechanism, methods made async) | Deferred — not required for the connection above; remains possible later |
| Database Authority implementation; supply a `EventPersistence` for mode 'database' | Deferred |
| Event Intelligence & Correlation Engine (EICE) implementation | Deferred, reserved per §24 |
| Register the platform's actual event catalog (the concrete `ConfigurationChanged`, `HardwareDiscovered`, etc. definitions) with the IEB | Deferred — depends on the retargeting above |
