# ADR-0010: Institutional Thermal Intelligence Authority & Digital Twin

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 17  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP requires a single authority for thermal intelligence — monitoring, modeling, analysis, forecasting, and explainability. Multiple authorities independently reading temperature sensors would violate the Single Thermal Authority principle (PHASE-17 §3). ITIA must also integrate cross-domain data (power from IPIA, sensors from IHIS, budgets from Configuration Authority) without creating compile-time coupling between authority modules.

Two engineering decisions needed a record:

1. **Sensor and power data must be injectable.** ITIA cannot import `hardware_authority` or `power_authority` directly. Sensor acquisition and power snapshots are provided via `ThermalSensorProvider` and `PowerSnapshotProvider` interfaces with testable defaults.
2. **Recommendations must be advisory only.** ITIA observes and recommends; it never controls fans, clocks, or voltages. Every recommendation carries `advisory: true` as a type-level constraint.

## Decision

- Implement ITIA at `core/thermal_authority/` with `ThermalAuthority` as the orchestrator: collect → profile → trend → forecast → anomaly → recommend → ITDT.
- Adopt `InjectableThermalSensorProvider` as the default sensor backend (empty until configured); production deployments plug in an IHIS-backed or OS-level adapter.
- Adopt `NullPowerSnapshotProvider` as the default power backend; IPIA integration plugs in via `MapPowerSnapshotProvider` or a custom implementation.
- Budget configuration arrives via `setBudget()` / `setBudgetForDevice()` — no direct ICMS import. Default domain presets (`DEFAULT_BUDGET_PRESETS`) apply when no custom budget is set.
- Implement the Institutional Thermal Digital Twin (ITDT) as a deterministic assembly of profile, trend, forecast, budget, anomalies, recommendations, power snapshot, and history summary — with platform helpers (`devicesNearingWarning`, `estimateThermalImpactOfPowerReduction`, `degradationCandidates`, `platformThermalSummary`).
- Trend analysis uses linear regression on in-memory history; forecasting extrapolates slope against budget thresholds. Both are advisory and explainable, not ML-based.
- Missing sensors are first-class: `sensorAvailable: false`, `thermalState: 'unknown'`, `ThermalSensorUnavailable` events, and sensor-failure anomalies.

## Consequences

- No authority needs to read temperature sensors independently; all thermal intelligence originates from ITIA.
- IHIS, IPIA, and Configuration Authority integrate via injectable providers without circular dependencies.
- Policy and Decision authorities can consume ITIA's advisory recommendations and assessments without ITIA making autonomous control decisions.
- When persistent history (Data Authority) or the institutional Event Bus are implemented, they plug into existing extension points (`ThermalHistoryStore`, `ThermalEventBus`) with no changes to ITIA's public API.
