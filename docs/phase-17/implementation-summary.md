# Phase 17 — Implementation Summary (ITIA)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-17-institutional-thermal-intelligence-authority.md`  
**Branch:** `cursor/program-iii-resource-intelligence-a927`

---

## 1. Executive Summary

Phase 17 implements the Institutional Thermal Intelligence Authority (ITIA) — IMIP's thermal intelligence module for Program III (Resource Intelligence). Node.js (ESM) + TypeScript, built on injectable sensor and power providers, with full trend analysis, budgeting, forecasting, anomaly detection, advisory recommendations, explainability, and the Institutional Thermal Digital Twin (ITDT).

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Types & domain model | `src/types.ts` | §6–9 |
| Sensor provider (injectable) | `src/sensors.ts` | §5, §22 |
| Power snapshot bridge (IPIA cross-domain) | `src/powerBridge.ts` | §22, ITDT |
| Budget manager + presets | `src/budgets.ts` | §9 |
| Thermal registry (SSOT) | `src/registry.ts` | §6 |
| Trend analyzer | `src/trends.ts` | §10 |
| Forecast engine | `src/forecast.ts` | §11 |
| Anomaly detector | `src/anomaly.ts` | §12 |
| Advisory recommendations | `src/recommendations.ts` | §13 |
| Diagnostics | `src/diagnostics.ts` | §22 |
| History store | `src/history.ts` | §6 |
| Lifecycle transitions | `src/lifecycle.ts` | §14 |
| ITDT assembly | `src/digitalTwin.ts` | §23 |
| Events | `src/events.ts` | §15 |
| Audit trail | `src/explainability.ts` | §16 |
| Error taxonomy | `src/errors.ts` | §22 |
| Metrics collector | `src/metrics.ts` | §22 |
| Orchestrator + public API | `src/ThermalAuthority.ts` | §5, §17 |

Tests across 17 files in `tests/` (106 tests), all using `InjectableThermalSensorProvider` for determinism.

---

## 3. Key Decisions

1. **Injectable providers, no direct IHIS/IPIA/ICMS imports.** `ThermalSensorProvider` and `PowerSnapshotProvider` are real extension points; defaults are `InjectableThermalSensorProvider` and `NullPowerSnapshotProvider`.
2. **Advisory-only recommendations.** Every `ThermalRecommendation` carries `advisory: true`; ITIA never controls fans, clocks, or voltages.
3. **Missing sensors are first-class.** `sensorAvailable: false` profiles, `ThermalSensorUnavailable` events, and sensor-failure anomalies are explicit — not treated as zero-temperature readings.
4. **Trend analysis via linear regression.** Slope, heating rate, cooling rate, and cycling frequency computed deterministically from in-memory history.
5. **ITDT is descriptive and predictive.** Combines telemetry, trends, forecasts, anomalies, power snapshots, and recommendations into a single explainable assessment per device.

---

## 4. Verification

```text
npx vitest run core/thermal_authority   → all tests pass
```

---

## 5. Actions Not Performed (By Law)

- No fan/clock/voltage control
- No direct imports of `power_authority` or `hardware_authority`
- No mining, scheduling, or profitability logic
- No hardware discovery (deferred to IHIS via injectable sensor provider)
- No Event Bus implementation (interim local emitter, same pattern as IHIS/ICMS)
- No root README, AUTHORITY_REGISTRY, or specs README updates

---

## 6. Follow-Up

| Item | Status |
|---|---|
| IHIS sensor acquisition adapter (`ThermalSensorProvider` implementation) | Deferred |
| IPIA power snapshot adapter (`PowerSnapshotProvider` implementation) | Deferred |
| Configuration Authority budget injection adapter | Deferred — `setBudget()` API ready |
| Data Authority persistent history backend | Deferred — interim in-memory store |
| Event Bus implementation; retarget `ThermalEventBus` calls | Deferred |
