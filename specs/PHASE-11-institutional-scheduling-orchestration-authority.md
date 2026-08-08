# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 11

# Institutional Scheduling & Orchestration Authority (ISOA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Core Infrastructure Authority

> ISOA fills the "Scheduler Authority" slot named in `architecture/AUTHORITY_REGISTRY.md` (Phase 01, "Owns mining schedules and workload timing"), expanded from a plain scheduler into the platform's time-intelligence authority: time, dependencies, policies, resources, runtime state, and maintenance windows are all first-class scheduling inputs, not just a timer. See ADR-0014.

---

# 1. Mission Statement

ISOA is the sole authority for scheduling, orchestrating, coordinating, and supervising time-based and policy-driven execution across IMIP. No authority independently schedules recurring work.

---

# 2. Mission Objectives

Time-based, event-triggered, dependency-aware, resource-aware, and policy-aware scheduling; maintenance scheduling; retry scheduling; deferred execution; schedule auditing; explainable scheduling; a real, generic extension point for future AI-assisted scheduling.

---

# 3. Institutional Principles

1. **Single Scheduling Authority** — ISOA is the sole owner of execution scheduling.
2. **Time Is a Resource** — time is managed as an institutional resource (the Institutional Time Graph, §22).
3. **Policy Before Execution** — every schedule is gated by a `PolicyEvaluator` before execution. **Real gap identified during pre-implementation review**: Policy Authority (`core/policy_engine/`) remains unimplemented (ADR-0004), so ISOA's default evaluator is permissive — there are no real policies to violate yet. See ADR-0014.
4. **Runtime Awareness** — scheduling decisions consult the platform's real `RuntimeState` (`core/runtime_bootstrap`) when a `RuntimeOrchestrator` is supplied.
5. **Explainability** — every schedule answers why/why-now/why-not-earlier/why-delayed/who-requested/which-policy via `explain()`.
6. **Deterministic Execution** — an injectable clock (`now`) makes scheduling outcomes reproducible given the same inputs.

---

# 4. Responsibilities

ISOA owns: the schedule registry, job scheduling, schedule evaluation, deferred execution, retry coordination, maintenance windows, dependency scheduling, schedule auditing, scheduling events, scheduling metrics. ISOA does **not** own: mining, decisions, hardware, profitability, runtime lifecycle, or event routing.

---

# 5. Runtime Architecture

```text
Authorities
        │
        ▼
Institutional Scheduling & Orchestration Authority
        │
        ├──────── Schedule Registry
        ├──────── Scheduler Engine (tick / notifyEvent / notifyRecommendation)
        ├──────── Policy Evaluator (real extension point — permissive default, ADR-0014)
        ├──────── Dependency Evaluator (cycle-detected, execution-outcome-gated)
        ├──────── Resource Evaluator (real IHIS-grounded default, or permissive)
        ├──────── Retry Manager
        └──────── Execution Dispatcher (calls caller-supplied ScheduleExecutionHandler)
                    │
                    ▼
Approved Authority Interfaces (schedule owners' own handlers)
```

Publishes directly through the real IEB (no legacy synchronous API to preserve — IRBLM's pattern, ADR-0010 §2) and, when an `ObservabilityAuthority` is supplied, logs every lifecycle event through it too.

---

# 6. Schedule Types

Six schedule types (`ScheduleType`/`ScheduleTrigger`): time (interval/daily/weekly/one-shot, UTC, no timezone dependency), event (IEB event name), policy (gated through the shared `PolicyEvaluator`, no separate signaling path needed), conditional (a real predicate function), manual (operator-initiated only), and ai-recommendation. **AI recommendations never bypass policy**: `notifyRecommendation()` still runs the full eligibility gate (dependencies, runtime state, windows, policy, resources) before executing — "recommendations only, policies remain authoritative" is enforced structurally, not just documented.

---

# 7. Schedule Registry

Every `ScheduleDefinition` carries every field §7 requires, with `requiredRuntimeState` explicitly referring to the platform-level `RuntimeState` (`core/runtime_bootstrap`) — **a pre-existing naming collision was found during review**: Hardware Authority exports an unrelated, identically-named per-device `RuntimeState`. `priority` reuses the Event Bus's existing `EventPriority` scale rather than inventing a fourth priority system.

---

# 8. Schedule Lifecycle

```text
created → validated → registered → eligible → scheduled → executing → {completed | failed} → rescheduled | retired
```

Extended beyond the spec's literal 9-node diagram with `paused` and `cancelled` (reachable from any non-terminal stage) — required for §12 (retry) and §15 (pause/resume/cancel) to be real rather than fabricated. See ADR-0014.

---

# 9. Dependency Awareness

A schedule with dependencies is not eligible until every dependency's most recent execution recorded `result: 'success'`. Circular schedule dependencies are rejected at registration time (`ScheduleDependencyGraph`, DFS cycle detection) — a schedule-to-schedule graph, distinct from IRBLM's authority-boot dependency graph (no topological boot order needed here, only cycle rejection).

---

# 10. Resource Awareness

**Real gap identified during pre-implementation review**: Workload Authority (which would own utilization-based allocation) is unimplemented, and no authority tracks live CPU/GPU utilization percentages. The default `ResourceEvaluator` is permissive; when a `HardwareAuthority` is supplied, `hardwareResourceEvaluator()` grounds resource checks in IHIS's real, existing per-device allocation state (`reserve()`/`allocate()`) — real data, not fabricated utilization numbers.

---

# 11. Maintenance Windows

Modeled as `TimeWindow` entries in the Institutional Time Graph (§22) with `blocksExecution: true`. Deliberately a scheduling-level concept, independent of but readable alongside IRBLM's platform-wide `maintenance` RuntimeState — ISOA doesn't drive the platform's lifecycle, it respects windows registered against its own graph.

---

# 12. Retry Management

`immediate | fixed-interval | exponential-backoff | manual` (`RetryPolicy`/`computeRetryDelayMs`). Attempt count is tracked per schedule across separate `tick()`/`notify*()` invocations (a retry sequence spans multiple, independent calls, not one call stack) — a real bug where attempt count silently never incremented was caught and fixed during testing; see `docs/phase-11/implementation-summary.md` §4.

---

# 13. Scheduling Events

The 11 named events, registered under the `'scheduler'` `EventCategory` — reserved and unused since Phase 01/05, so no category widening was needed (unlike ISMA's `'storage'` or IOLA's `runtime-logs`). `pause`/`resume` have no corresponding IEB event names in the spec's list; they log through IOLA only (operations `schedule-paused`/`schedule-resumed`), not fabricated IEB event names. `ScheduleDelayed` fires when a recurring trigger's eligibility check fails (retried next tick); `ScheduleSkipped` fires specifically when a one-shot `at` trigger misses its only window (permanently unrecoverable, the schedule retires).

---

# 14. Explainability

`explain(scheduleId)` returns the schedule, its dependency chain, its full execution history, currently active time windows, and its most recent delay reasons — together, not scattered across separate calls.

---

# 15. Public Interfaces

`registerSchedule()`, `pause()`/`resume()`/`cancel()`, `triggerManually()`, `notifyEvent()`/`notifyRecommendation()`, `tick()`, `explain()`, `getMetrics()`, plus the `registry`/`graph` read surfaces. No consumer executes work outside its own `ScheduleExecutionHandler`.

---

# 16. Error Handling

`InvalidScheduleError`, `DuplicateScheduleError`, `ScheduleNotFoundError`, `CircularScheduleDependencyError`, `InvalidScheduleTransitionError`, `ExecutionTimeoutError` — all typed.

---

# 17. Performance Metrics

`getMetrics()`: scheduledJobs, successfulExecutions, failedExecutions, delayedExecutions, retryCount, averageSchedulingLatencyMs, averageExecutionLatencyMs. **Deviation**: "queue depth" doesn't apply — ISOA has no queue (schedules are evaluated in registry order each `tick()`). Exposed to **the Observability Authority** specifically (IOLA now exists, unlike prior phases' "future Telemetry Authority") — ISOA logs every lifecycle event through IOLA when one is supplied.

---

# 18. Testing Requirements

68 tests across 9 files: time-trigger computation (interval/daily/weekly/one-shot, verified against real date arithmetic), lifecycle transitions, dependency-graph cycle detection, retry-delay computation, evaluators (including real IHIS-grounded resource checks), the schedule registry, the Institutional Time Graph, and the orchestrator end-to-end — registration lifecycle, time-based execution timing, recurring reschedule, one-shot retire, missed-window skip, dependency gating, maintenance-window blocking, policy gating, real hardware-resource gating, retry with attempt tracking across ticks, pause/resume, cancel, manual trigger, event/AI-recommendation notification (including the "AI never bypasses policy" guarantee), conditional triggers, execution timeout, explainability, metrics, and real IEB/IOLA integration.

---

# 19. Acceptance Criteria

All scheduling flows through ISOA. The schedule registry is authoritative. Dependency-, policy-, and resource-aware scheduling are operational (with honest, non-fabricated defaults where the authorities they'd consult don't exist yet). Maintenance windows are respected. Retry management functions correctly, including across separate evaluation cycles. Scheduling events are published. Explainability is complete. Tests pass. Documentation is complete.

---

# 20. Institutional Completion Standard (ICS) / Compliance Note

No placeholder implementations: the `PolicyEvaluator`/`ResourceEvaluator` extension points are real, generic, and fully functional, with an honest permissive default rather than fabricated policy/resource logic that would duplicate Policy Authority's and Workload Authority's future ownership. A pre-coding spec review (per explicit instruction) found and addressed: the Policy/Workload Authority gap, a pre-existing `RuntimeState` naming collision across two unrelated modules, and confirmed the `'scheduler'` `EventCategory` was already reserved and required no widening.

---

# 22. Architect's Enhancement: Institutional Time Graph (ITG)

**Implemented in full**, per explicit direction — the same ambiguous "reserve from the beginning" wording used for Phase 10's Observability Graph was clarified before implementation (build now). `InstitutionalTimeGraph` models schedule dependencies, time windows (maintenance/pricing/opportunity/any caller-defined type), and historical execution timelines. Answers the spec's own example questions directly: `whyDelayed()` ("why was this benchmark delayed?"), `activeWindowsAt()` ("which maintenance window caused shifts?"), `missedWindowRate()` ("which recurring jobs consistently miss their execution window?"). Pricing/opportunity windows have no real producer yet (Power/Profitability Authority are both unimplemented) — the registration mechanism is real and fully functional, with zero such windows pre-populated.
