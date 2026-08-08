# ADR-0014: Institutional Scheduling & Orchestration Authority

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 11  
**Deciders:** Architectural Authority (Specification), User (scope decisions after pre-coding review)

## Context

Before drafting Phase 11's code, the user explicitly asked for a review of the specs for duplications, mismatches, contradictions, and conflicts. That review (documented in full in the session, summarized here) surfaced several real findings against `architecture/AUTHORITY_REGISTRY.md`, `architecture/contracts/DECISION_PIPELINE.md`, and the actual implemented code of Hardware Authority and Runtime Bootstrap:

1. **Policy Authority is still reserved.** `ADR-0004` and the Authority Registry confirm `core/policy_engine/` has zero production code. `DECISION_PIPELINE.md` names Policy Evaluation as stage 3, exclusively owned by Policy Authority — a binding contract no other authority may duplicate. ISOA's spec (Law 3, §5's "Policy Evaluator" component, §7's `requiredPolicies` field) assumes real policy evaluation exists.
2. **Workload Authority is also reserved.** ISOA's §10 "Resource Awareness" (CPU/GPU utilization) has no real authority-owned data source; only Hardware Authority's real per-device allocation state (`reserve()`/`allocate()`) exists.
3. **A pre-existing naming collision**: `core/hardware_authority/src/types.ts` and `core/runtime_bootstrap/src/types.ts` each export an unrelated type literally named `RuntimeState` — one per-device, one platform-level. ISOA's §7 "Required Runtime State" field doesn't disambiguate against this backdrop.
4. **The `'scheduler'` `EventCategory`** has been reserved and unused since Phase 01/05, and is also already in IOLA's `DEFAULT_LOG_CATEGORIES` — no widening needed for ISOA's events.
5. **Documentation drift**: the Phase 01 Authority Registry's original 19-authority list has not been kept in sync with what Program II has actually built (IDA ≈ "Database Authority," IOLA overlaps "Telemetry Authority" but is broader, ISMA has no corresponding entry at all). Not blocking, but real.

Two decisions were surfaced to the user directly before writing code:

- What should ISOA's `PolicyEvaluator`/`ResourceEvaluator` do by default, given the authorities they'd consult don't exist? **Answered: permissive by default** — an unconfigured evaluator passes everything through, matching how every other reserved extension point in this codebase behaves (IRBLM boots fine with no Capability Registry adapter).
- Should the Institutional Time Graph (§22) be built now or reserved, given the spec reused Phase 10's identical ambiguous wording? **Answered: build it now**, same as IOG/IKM/IST.

## Decisions

1. **`PolicyEvaluator` and `ResourceEvaluator` are real, generic extension points with a permissive default**, per the user's explicit direction. `PERMISSIVE_POLICY_EVALUATOR` and `PERMISSIVE_RESOURCE_EVALUATOR` approve/allow everything, with a reason string naming ADR-0014 — not fabricated policy or workload-allocation logic, which would duplicate Policy Authority's and Workload Authority's exclusive future ownership.
2. **`hardwareResourceEvaluator()` grounds resource checks in Hardware Authority's real, already-existing per-device allocation state**, the only genuinely real resource-availability data on the platform today. It is opt-in (constructed from a supplied `HardwareAuthority`), not the default, since not every deployment needs device-level gating.
3. **`requiredRuntimeState` refers to the platform-level `RuntimeState`** (`core/runtime_bootstrap`), checked via an optional `RuntimeOrchestrator.getRuntimeState()` call — chosen explicitly over Hardware Authority's identically-named but unrelated per-device state, and documented as such given the pre-existing collision.
4. **The schedule lifecycle is extended with `paused` and `cancelled`** beyond the spec's literal 9-node §8 diagram — required for §12 (retry) and §15 (pause/resume/cancel) to be real, working states rather than interfaces with nowhere to route.
5. **`ScheduleDelayed` vs `ScheduleSkipped` is a real, distinct signal, not two names for the same event.** A recurring trigger whose eligibility check fails gets `ScheduleDelayed` (it will be re-evaluated on a later tick, nothing is lost). A one-shot `at` trigger whose eligibility check fails has no later occurrence to fall back to — that gets `ScheduleSkipped`, and the schedule retires immediately, since silently rescheduling it would misrepresent what happened.
6. **Retry attempt count is tracked in a dedicated `attemptCounts` map, not passed as a parameter threaded through call sites.** A real bug was caught during testing: the initial implementation passed a hardcoded `attempt: 1` into every `executeOne()` call site (`tick()`, `attemptOrDelay()`, `triggerManually()`), so a schedule's retry attempt count never actually incremented across separate `tick()` invocations — `maxAttempts` would never trigger and exponential backoff would never grow, because a schedule's retry sequence spans multiple, independent method calls, not one call stack. Fixed by reading/writing the current attempt from a map keyed by `scheduleId`, reset on success, on retry exhaustion, and on an explicit manual trigger (which always starts a fresh attempt sequence).
7. **`resume()` preserves the schedule's existing `nextExecutionAt` rather than recomputing it from "now".** A second real bug was caught during testing: the initial implementation recomputed `nextExecutionAt` on resume, which meant resuming a job that was already overdue when paused silently skipped that occurrence and pushed the next one a full interval further out — surprising and almost certainly not what an operator resuming a paused job would expect.
8. **`pause`/`resume` have no corresponding IEB event name in §13's literal 11-event list.** Rather than fabricate `SchedulePaused`/`SchedumeResumed` event names not given in the spec, these are logged through IOLA only (when configured), under operations `schedule-paused`/`schedule-resumed` — real, but not claimed as part of the Event Bus's approved 11-event catalog.
9. **ISOA publishes directly through the real IEB and logs directly through IOLA**, not the ICMS/IHIS/ISMA/IOLA mirror pattern — it has no legacy synchronous API to preserve (IRBLM's precedent, ADR-0010 §2), and §17 names "the Observability Authority" specifically, which now exists (unlike prior phases' "future Telemetry Authority").
10. **The Institutional Time Graph (§22) is built in full**, per the user's clarified direction.

## Consequences

- Any future authority that wants ISOA's Policy/Resource gates to be meaningful supplies a real `PolicyEvaluator`/`ResourceEvaluator` — no changes to ISOA itself required once Policy Authority and Workload Authority exist.
- The Phase 01 Authority Registry reconciliation (mapping IDA/ISMA/IOLA/ISOA back onto the original 19-authority list) remains a real, identified, but explicitly deferred documentation follow-up — not performed this phase.
- Two genuine logic bugs (retry attempt count never incrementing; resume() silently skipping an overdue occurrence) were caught and fixed by the test suite before certification, not discovered later in integration.
