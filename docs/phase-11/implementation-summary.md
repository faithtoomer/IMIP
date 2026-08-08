# Phase 11 — Implementation Summary (ISOA)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-11-institutional-scheduling-orchestration-authority.md`  
**Branch:** `cursor/phase-00-repository-governance-5130`

---

## 1. Executive Summary

Phase 11 implements the Institutional Scheduling & Orchestration Authority (ISOA) — Program II's fourth phase and the platform's time-intelligence authority. Before any code was written, a full pre-coding spec review (explicitly requested) was performed against `architecture/AUTHORITY_REGISTRY.md`, `architecture/contracts/DECISION_PIPELINE.md`, and the actual implemented code of Hardware Authority and Runtime Bootstrap, surfacing real gaps and one pre-existing naming collision that shaped the implementation.

---

## 2. Pre-Coding Spec Review Findings

1. Policy Authority (`core/policy_engine/`) is still reserved (ADR-0004); `DECISION_PIPELINE.md` names Policy Evaluation as its exclusive stage 3. ISOA's Policy Evaluator had to be a real extension point, not fabricated logic.
2. Workload Authority is also reserved; ISOA's Resource Evaluator had nowhere real to get CPU/GPU utilization from — only Hardware Authority's real allocation state exists.
3. `hardware_authority` and `runtime_bootstrap` each export an unrelated type both literally named `RuntimeState`.
4. `RUNTIME_ARCHITECTURE.md §9`'s aspirational 11-state runtime model was never reconciled with IRBLM's actual implemented 12-state machine (pre-existing, not introduced by this phase).
5. The `'scheduler'` `EventCategory` has been reserved and unused since Phase 01/05 — no widening needed.
6. The Phase 01 Authority Registry has drifted from what Program II has actually built (documentation gap, not blocking).

Two decisions were surfaced to the user directly: permissive-by-default policy/resource gates (confirmed), and building the Institutional Time Graph now rather than reserving it (confirmed).

---

## 3. What Was Built

| Concern | File | § |
|---|---|---|
| Types (triggers, ScheduleDefinition, events) | `src/types.ts` | §6, §7, §13 |
| Typed error taxonomy | `src/errors.ts` | §16 |
| Deterministic time-trigger computation | `src/timeEvaluator.ts` | §6 |
| Lifecycle transition table | `src/lifecycle.ts` | §8 |
| Cycle-detected dependency graph | `src/dependencyGraph.ts` | §9 |
| Retry-delay computation | `src/retry.ts` | §12 |
| Policy/Resource evaluators | `src/evaluators.ts` | §3 Law 3, §10 |
| Schedule Registry (SSOT) | `src/registry.ts` | §7 |
| Event catalog | `src/events.ts` | §13 |
| Institutional Time Graph | `src/timeGraph.ts` | §22 |
| Orchestrator | `src/SchedulingAuthority.ts` | §5, §9–§15 |

68 tests across 9 files (`tests/`).

---

## 4. Real Bugs Found and Fixed During Testing

Both caught before certification, not discovered later.

1. **Retry attempt count never incremented across ticks.** The initial implementation passed a hardcoded `attempt: 1` into `executeOne()` from every call site (`tick()`, `attemptOrDelay()`, `triggerManually()`). A schedule's retry sequence spans multiple, separate method invocations — not one call stack — so `maxAttempts` never actually triggered and exponential backoff never grew; every retry was computed as if it were attempt 1. Caught while writing the retry test (reasoning through the design before running it, then confirmed with a real `[1, 2, 3]` attempt-sequence test). Fixed by tracking the current attempt in a `Map<scheduleId, number>`, incremented on each retry, reset on success, on retry exhaustion, and on an explicit manual trigger.
2. **`resume()` silently skipped an overdue occurrence.** The initial implementation recomputed `nextExecutionAt` from "now" on resume, so a job that was already due when paused would, after resuming, wait a full new interval instead of firing on the next tick. Caught by `tests/SchedulingAuthority.test.ts`'s pause/resume test failing with `handler.count` staying 0. Fixed by having `resume()` preserve the schedule's existing `nextExecutionAt`.

---

## 5. Verification

```text
npx tsc --noEmit -p tsconfig.json         → clean (src, including the ISOA module)
npx tsc --noEmit (src + tests combined)    → clean
npx vitest run core/scheduling_authority    → 9 files, 68 tests, 68 passed
npx vitest run                              → 101 files, 551 tests, 551 passed (68 new for Phase 11)
npm run build                               → dist/ emitted successfully, including core/scheduling_authority
```

---

## 6. Actions Not Performed (By Law)

- No mining, decision, hardware, profitability, or runtime-lifecycle logic in ISOA (§4 explicit exclusions)
- No fabricated Policy or Workload Authority logic — both remain real, unimplemented extension points
- No Phase 01 Authority Registry reconciliation — identified as a real documentation gap, explicitly deferred
- No IRBLM adapter for ISOA — not requested this phase, same posture as IDA/ISMA/IOLA currently have

---

## 7. Follow-Up

| Item | Status |
|---|---|
| Wiring `PolicyEvaluator`/`ResourceEvaluator` to real Policy/Workload Authority implementations, once they exist | Deferred — zero changes to ISOA required |
| IRBLM adapter for ISOA | Deferred |
| Telemetry Authority consuming `getMetrics()` | Deferred |
| Phase 01 Authority Registry reconciliation across IDA/ISMA/IOLA/ISOA | Deferred — real, identified gap |
| Pricing/opportunity window producers (Power/Profitability Authority) | Deferred — the Institutional Time Graph's registration mechanism is ready |
