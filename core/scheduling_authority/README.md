# Institutional Scheduling & Orchestration Authority (ISOA)

**Status:** IMPLEMENTED (Phase 11)  
**Location:** `core/scheduling_authority/`  
**Authority:** PHASE-11 / ADR-0014

## Purpose

ISOA is the sole institutional authority for time-based and policy-driven execution scheduling — the platform's time-intelligence authority, not a plain cron. It fills the "Scheduler Authority" slot named in `architecture/AUTHORITY_REGISTRY.md` (Phase 01). No authority independently schedules recurring work.

## Layout

```text
core/scheduling_authority/
  src/
    types.ts               ScheduleType/Trigger variants, ScheduleDefinition, RetryPolicy,
                             TimeWindow, SCHEDULE_EVENTS (11), ...
    errors.ts                 Structured, typed error taxonomy
    timeEvaluator.ts             Real, deterministic next-execution computation (UTC)
    lifecycle.ts                   Schedule lifecycle transition table
    dependencyGraph.ts               ScheduleDependencyGraph — cycle detection
    retry.ts                           Real retry-delay computation
    evaluators.ts                       PolicyEvaluator/ResourceEvaluator — permissive
                                         defaults + a real IHIS-grounded resource evaluator
    registry.ts                          ScheduleRegistry — the SSOT
    events.ts                              The 11 named events, direct-IEB-publish pattern
    timeGraph.ts                            InstitutionalTimeGraph — the Architect's
                                             Enhancement (§22)
    SchedulingAuthority.ts                   The orchestrator
    index.ts                                  Public exports
  tests/                                       68 tests across 9 files
```

## Usage

```ts
import { SchedulingAuthority } from './core/scheduling_authority/src/index.js';

const isoa = new SchedulingAuthority(); // permissive policy/resource gates, console-free by default

await isoa.registerSchedule(
  {
    name: 'nightly-benchmark',
    ownerAuthority: 'Hardware Authority',
    scheduleType: 'time',
    trigger: { kind: 'time', dailyAt: { hour: 2, minute: 0 } }, // UTC
    retryPolicy: { strategy: 'exponential-backoff', intervalMs: 60_000, maxAttempts: 3 },
  },
  { execute: async ({ schedule }) => ({ success: true }) }, // caller-supplied — ISOA never contains this logic itself
);

// A maintenance window (§11) — same graph the spec's example questions target:
isoa.graph.registerWindow({
  windowId: 'maint-1',
  type: 'maintenance',
  label: 'Weekly maintenance',
  startsAt: '2026-08-09T00:00:00.000Z',
  endsAt: '2026-08-09T02:00:00.000Z',
  source: 'Operator',
  blocksExecution: true,
});

await isoa.tick(); // the evaluation + dispatch pass
isoa.graph.whyDelayed('scheduleId');       // §22 example question
isoa.graph.missedWindowRate('scheduleId'); // §22 example question
```

### Wiring real gates and observability

```ts
import { hardwareResourceEvaluator } from './core/scheduling_authority/src/index.js';

const isoa = new SchedulingAuthority({
  eventBus,                                          // publishes the 11 events under 'scheduler'
  observabilityAuthority: iola,                       // logs every lifecycle event through IOLA
  runtimeOrchestrator,                                 // gates on real platform RuntimeState
  resourceEvaluator: hardwareResourceEvaluator(ihis),   // real device-availability gate
  // policyEvaluator: permissive by default — Policy Authority doesn't exist yet (ADR-0014)
});
```

## Scope Boundary

ISOA owns the schedule registry, scheduling evaluation, retry coordination, maintenance windows, dependency scheduling, schedule auditing, and scheduling events/metrics — never mining, decisions, hardware, profitability, runtime lifecycle, or event routing (§4). Every schedule supplies its own `ScheduleExecutionHandler`; ISOA never executes business logic itself.

## Governance

- `PolicyEvaluator`/`ResourceEvaluator` are real, generic extension points, permissive by default — Policy Authority and Workload Authority are both still unimplemented; ISOA does not fabricate their logic.
- AI-recommendation triggers never bypass the policy gate — `notifyRecommendation()` runs the full eligibility check every time (§6: "Recommendations only. Policies remain authoritative.").
- Circular schedule dependencies are rejected at registration time.
- Retry attempt count is tracked per schedule across separate `tick()`/`notify*()` calls, not per call stack — a retry sequence spans multiple, independent invocations.
- `resume()` preserves a paused schedule's original due time rather than resetting it — an overdue job fires on the next tick after resuming, it doesn't silently wait a full new interval.
- `requiredRuntimeState` refers to the platform-level `RuntimeState` (`core/runtime_bootstrap`), not Hardware Authority's unrelated, identically-named per-device `RuntimeState`.
