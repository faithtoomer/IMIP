# Phase 16 — Certification Checklist (IPIA)

**Specification:** `specs/PHASE-16-institutional-power-intelligence-authority.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria (§19)

| Criterion | Certified | Evidence |
|---|---|---|
| Power profiles exist for monitored devices | YES | `registerDevice()`, `PowerRegistry`; `tests/registry.test.ts` |
| Registry is authoritative (SSOT) | YES | `PowerRegistry.upsert()` keyed by deviceId; `tests/registry.test.ts` |
| Telemetry collection works | YES | `src/telemetry.ts`; `tests/telemetry.test.ts` |
| Cost calculations work | YES | `src/cost.ts`; `tests/cost.test.ts` |
| Efficiency calculations work | YES | `src/efficiency.ts`; `tests/efficiency.test.ts` |
| Budget management works | YES | `src/budget.ts`; `tests/budget.test.ts` |
| Recommendations are advisory only | YES | `src/recommendations.ts`; `tests/recommendations.test.ts` |
| Power events published correctly | YES | `src/events.ts`; `tests/events.test.ts` |
| Explainability is complete | YES | `src/explainability.ts` + `getAssessment()`; `tests/explainability.test.ts` |
| History store works | YES | `src/history.ts`; `tests/history.test.ts` |
| IEDT queries work | YES | `src/digitalTwin.ts`; `tests/digitalTwin.test.ts` |
| Tests pass (60+) | YES | 12 files, `npx vitest run core/power_authority` |
| Documentation is complete | YES | `core/power_authority/README.md`, this directory |

## Institutional Completion Standard (§21 contract)

| Requirement | Certified |
|---|---|
| No power monitoring duplicated in other authorities | YES |
| No hardware power limit mutation | YES — recommendations are advisory only |
| Power Registry never bypassed | YES |
| Missing sensors handled gracefully | YES — first-class `sensorAvailable: false` |
| No mining/thermal/hardware-discovery logic in IPIA | YES |
| No placeholder or incomplete implementations | YES — injectable providers are real, complete extension points (ADR-0009) |

## Architect's Enhancement (IEDT)

| Requirement | Certified |
|---|---|
| Models platform electrical behavior | YES — `EnergyDigitalTwin` + `assembleEnergyDigitalTwin()` |
| Relates power, history, pricing, efficiency, cost, budgets, recommendations | YES — `digitalTwin.ts` |
| Descriptive and explainable, never controlling | YES — no hardware control methods |
| Platform queries (rank, cost impact, summary, trend) | YES — `rankByRevenuePerKwh`, `estimateCostImpactOfPowerReduction`, `platformEnergySummary`, `efficiencyTrend` |

## Certification Statement

Phase 16 — Institutional Power Intelligence Authority (IPIA) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08. Type-check and the full power_authority test suite pass.
