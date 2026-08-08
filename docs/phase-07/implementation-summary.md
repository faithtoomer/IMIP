# Phase 07 — Implementation Summary (IRBLM)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-07-runtime-bootstrap-lifecycle-manager.md`  
**Branch:** `cursor/phase-00-repository-governance-5130`

---

## 1. Executive Summary

Phase 07 implements the Institutional Runtime Bootstrap & Lifecycle Manager (IRBLM) — IMIP's fourth production module and Program I's capstone. It orchestrates the three authorities that actually exist (Institutional Event Bus, Configuration Authority/ICMS, Hardware Authority/IHIS) via a fully generic, dependency-graph-driven framework, since the spec's own architecture diagram names Capability Registry and Plugin Registry, neither of which are implemented yet.

Note: there is no Phase 06 specification. Phase 07 was given directly as Program I's final phase.

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Component contract + types | `src/types.ts` | §4, §9 |
| Dependency graph (topological order, cycle detection) | `src/dependencyGraph.ts` | §8 |
| Lifecycle state machine (12 states) | `src/lifecycleStateMachine.ts` | §7 |
| Runtime Governance Board | `src/governanceBoard.ts` | §22 |
| Certification gate | `src/certification.ts` | §10 |
| Adapters for the 3 real authorities | `src/adapters.ts` | §5, §9 |
| Orchestrator (boot/shutdown/restart/pause/recover) | `src/RuntimeOrchestrator.ts` | §6, §11, §12, §13 |

75 tests across 14 files (`tests/`).

---

## 3. Key Decisions

1. **Generic dependency-graph orchestration instead of a hardcoded named sequence** — the spec's diagram names components (Capability Registry, Plugin Registry) that don't exist as code. See ADR-0010.
2. **IRBLM publishes directly through the real IEB**, not a mirrored local bus — unlike ICMS/IHIS, it has no legacy synchronous API to preserve.
3. **Readiness verification is a distinct pass from initialization**, matching §16's explicit separation of the two failure categories.
4. **Certification blocks only on faulted health, never degraded** — degraded-but-operational is the Governance Board's whole point (§22).
5. **`allowPartialStartup` applies to both initialization and readiness failures uniformly**, and only the successfully-initialized-and-ready pool is certified when authorized — failures stay visible, never hidden.
6. **Single-component restart does not cascade to dependents** — documented scope simplification, not silently assumed.

See ADR-0010 for full rationale.

---

## 4. A Real Bug Found and Fixed During Testing

The initial dependency-check logic used `this.instances.has(dep)` to decide whether a dependency was available to a downstream component. That's wrong: a component whose `create()` succeeds but whose `initialize()` throws is still present in `this.instances` (it was created, just never finished starting up) — so a downstream component would have silently proceeded to depend on a broken instance. Fixed by tracking a separate `initializedNames` set, populated only on full success, and checking *that* instead. Caught by `explainability.test.ts`'s "why is Downstream unavailable" test, which initially returned an empty reason list instead of "Missing dependencies: Upstream."

---

## 5. Verification

```text
npx tsc --noEmit -p tsconfig.json         → clean (src)
npx tsc --noEmit (src + tests combined)    → clean (caught: generic-variance issues on
                                              DependencyGraph/certifyRuntime needing
                                              ComponentDefinition<any>, and several test
                                              handlers returning a value where void was
                                              expected — same class of issue as Phase 05)
npm run build                              → dist/ emitted successfully
npx vitest run                             → 56 files, 323 tests, 323 passed (75 new for Phase 07)
```

---

## 6. Actions Not Performed (By Law)

- No mining, scheduling, hardware-discovery, profitability, plugin-execution, or decision-making logic in IRBLM (§4 explicit exclusions)
- No Capability Registry or Plugin Registry adapters (neither exists as code — both remain reserved)
- No Telemetry Authority integration (doesn't exist yet) — `getMetrics()` is the read surface it will consume
- No cascading single-component restart (documented simplification)

---

## 7. Follow-Up

| Item | Status |
|---|---|
| Capability Registry / Plugin Registry adapters, once those are implemented | Deferred — plugs into the existing generic framework with no orchestrator changes |
| Telemetry Authority consuming `getMetrics()` | Deferred |
| Cascading dependent-aware single-component restart | Deferred |
| A concrete `bin/` or entrypoint script actually running `RuntimeOrchestrator` against a real IMIP process | Deferred — this phase delivers the orchestrator itself, not a deployment entrypoint |
