# Phase 18 — Certification Checklist (IRIA)

**Specification:** `specs/PHASE-18-institutional-resource-intelligence-authority.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria

| Criterion | Certified | Evidence |
|---|---|---|
| Resource registry is SSOT keyed by resourceId | YES | `src/registry.ts`; `tests/registry.test.ts` |
| Resource types and states match spec | YES | `src/types.ts`, `src/lifecycle.ts` |
| Availability evaluates health, state, power/thermal, reservations, utilization | YES | `src/availability.ts`; `tests/availability.test.ts` |
| Allocation supports exclusive/shared/partial/priority/temporary modes | YES | `src/allocation.ts`; `tests/allocation.test.ts` |
| Double allocation and overcommit rejected | YES | `src/errors.ts`; `tests/failure-recovery.test.ts` |
| Reservations with conflict detection and expiry | YES | `src/reservation.ts`; `tests/reservation.test.ts` |
| Ownership and leasing explicit with history | YES | `src/ownership.ts`; `tests/ownership.test.ts`, `tests/leasing.test.ts` |
| Utilization and forecast computed | YES | `src/utilization.ts`, `src/forecast.ts`; `tests/utilization.test.ts`, `tests/forecast.test.ts` |
| Events published per §15 | YES | `src/events.ts`; `tests/events.test.ts` |
| Explainability / audit trail complete | YES | `src/explainability.ts`; `tests/explainability.test.ts` |
| IRDT assembled with ranking helpers | YES | `src/digitalTwin.ts`; `tests/digitalTwin.test.ts` |
| Deterministic allocation | YES | `tests/performance.test.ts` |
| Injectable providers (no direct authority imports) | YES | `src/providers.ts` |
| Tests pass (60+) | YES | 13 files / 78 tests, `npx vitest run core/resource_authority` |
| Documentation complete | YES | `core/resource_authority/README.md`, this directory, ADR-0011 |

## Institutional Completion Standard

| Requirement | Certified |
|---|---|
| No resource allocation duplicated in other authorities | YES |
| No mining/scheduling logic mixed into IRIA | YES |
| No direct hardware/power/thermal authority imports | YES — injectable providers only |
| No placeholder or incomplete implementations | YES |
| All mutations audited and event-published | YES — `ResourceAuthority.ts` |

## Architect's Enhancement (IRDT)

| Requirement | Certified |
|---|---|
| Combines profile, ownership, utilization, forecast, constraints | YES — `ResourceDigitalTwin` + `assembleResourceDigitalTwin()` |
| `rankCandidatesForWorkload` deterministic ranking | YES |
| `underutilizedHealthy`, `explainUnavailability`, `projectedImpactOfAllocation` | YES |
| IRDT is descriptive, not prescriptive | YES — does not allocate |

## Certification Statement

Phase 18 — Institutional Resource Intelligence Authority (IRIA) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08. `npx vitest run core/resource_authority` reports 78 tests passed.
