# Phase 11 — Certification Checklist (ISOA)

**Specification:** `specs/PHASE-11-institutional-scheduling-orchestration-authority.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria (§19)

| Criterion | Certified | Evidence |
|---|---|---|
| All scheduling flows through ISOA | YES | `registerSchedule()`/`tick()`/`notify*()` are the only execution paths |
| Schedule registry is authoritative | YES | `ScheduleRegistry`; `tests/registry.test.ts` |
| Dependency-aware scheduling operational | YES | Cycle detection + execution-outcome gating; `tests/dependencyGraph.test.ts`, dependency-gating test |
| Policy-aware scheduling enforced (honest default) | YES | Permissive `PolicyEvaluator` extension point; `tests/evaluators.test.ts` |
| Resource-aware scheduling operational (honest default) | YES | Real IHIS-grounded `hardwareResourceEvaluator`; `tests/evaluators.test.ts` |
| Maintenance windows respected | YES | `InstitutionalTimeGraph.isBlockedAt()`; maintenance-window test |
| Retry management functions correctly | YES | Attempt tracking across ticks; fixed-interval/exponential-backoff/manual tests |
| Scheduling events published | YES | 11 `SCHEDULE_EVENTS` under the reserved `'scheduler'` category; IEB integration test |
| Explainability complete | YES | `explain()`; `tests/SchedulingAuthority.test.ts` |
| Tests pass | YES | 9 files / 68 tests (551 total), `npx vitest run` |
| Documentation complete | YES | `core/scheduling_authority/README.md`, this directory |

## Institutional Completion Standard (§20 contract)

| Requirement | Certified |
|---|---|
| No placeholder or incomplete implementations | YES — Policy/Resource evaluators are real, generic mechanisms with an honest permissive default, not fabricated logic |
| Pre-coding spec review performed as explicitly requested | YES — findings against AUTHORITY_REGISTRY.md, DECISION_PIPELINE.md, and real code, documented in ADR-0014 |
| Two real bugs found and fixed before certification | YES — retry attempt tracking; resume() overdue-occurrence skip (implementation-summary.md §4) |
| AI recommendations never bypass policy | YES — `notifyRecommendation()` always runs the full eligibility gate |

## Architect's Enhancement (§22 — Institutional Time Graph)

| Requirement | Certified |
|---|---|
| Models schedule dependencies, windows, and execution history | YES — `InstitutionalTimeGraph` |
| Answers the spec's own example questions | YES — `whyDelayed()`, `activeWindowsAt()`, `missedWindowRate()`; `tests/timeGraph.test.ts` |
| Implemented in full, not reserved | YES — clarified explicitly with the user before implementation began |

## Certification Statement

Phase 11 — Institutional Scheduling & Orchestration Authority (ISOA), including the Institutional Time Graph (ITG) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08. Type-check (src + tests), build, and the full 551-test suite (68 new for Phase 11) pass.
