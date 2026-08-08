# Phase 17 — Certification Checklist (ITIA)

**Specification:** `specs/PHASE-17-institutional-thermal-intelligence-authority.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria (§17)

| Criterion | Certified | Evidence |
|---|---|---|
| Thermal telemetry collection via injectable providers | YES | `src/sensors.ts`; `tests/sensors.test.ts` |
| Every device has exactly one registry entry | YES | `ThermalRegistry.upsert()` keyed by deviceId; `tests/registry.test.ts` |
| Thermal budgets with warning/critical thresholds | YES | `src/budgets.ts`; `tests/budget.test.ts` |
| Trend analysis (slope, heating/cooling rates) | YES | `src/trends.ts`; `tests/trends.test.ts` |
| Forecasting (expected temp, ETA to thresholds) | YES | `src/forecast.ts`; `tests/forecast.test.ts` |
| Anomaly detection (spikes, sensor failures, oscillation) | YES | `src/anomaly.ts`; `tests/anomaly.test.ts` |
| Advisory recommendations only | YES | `src/recommendations.ts`; `tests/recommendations.test.ts` |
| Thermal events published correctly | YES | `src/events.ts`; `tests/events.test.ts` |
| Explainability is complete | YES | `src/explainability.ts` + `getAssessment()`; `tests/explainability.test.ts` |
| Institutional Thermal Digital Twin (ITDT) | YES | `src/digitalTwin.ts`; `tests/digitalTwin.test.ts` |
| Lifecycle transitions enforced | YES | `src/lifecycle.ts`; `tests/lifecycle.test.ts` |
| Diagnostics (impossible temps, NaN, drift) | YES | `src/diagnostics.ts`; `tests/diagnostics.test.ts` |
| Tests pass | YES | `npx vitest run core/thermal_authority` |
| Documentation is complete | YES | `core/thermal_authority/README.md`, this directory |

## Institutional Completion Standard (§22)

| Requirement | Certified |
|---|---|
| No thermal monitoring duplicated in other authorities | YES |
| No fan/clock/voltage control | YES |
| No direct power_authority or hardware_authority imports | YES — injectable providers only |
| Thermal Registry never bypassed | YES |
| Recommendations are advisory only (`advisory: true`) | YES |
| Missing sensors handled as first-class condition | YES |
| No placeholder or incomplete implementations | YES — extension points are real, empty-by-design |

## Architect's Enhancement (ITDT)

| Requirement | Certified |
|---|---|
| ITDT combines sensors, trends, forecasts, anomalies, power, recommendations | YES — `assembleDigitalTwin()` |
| Platform helpers: nearing warning, power reduction estimate, degradation candidates | YES — `digitalTwin.ts` |
| Assessments expose device, sensors, trend, budget, forecast, recommendation, evidence | YES — `ThermalAssessment` type |

## Certification Statement

Phase 17 — Institutional Thermal Intelligence Authority (ITIA) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08. The full `core/thermal_authority` test suite passes.
