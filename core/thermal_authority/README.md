# Institutional Thermal Intelligence Authority (ITIA)

**Status:** IMPLEMENTED (Phase 17)  
**Location:** `core/thermal_authority/`  
**Authority:** PHASE-17 / ADR-0010

## Purpose

ITIA is IMIP's sole authority for monitoring, modeling, analyzing, forecasting, and explaining thermal behavior. It is the implementation of the "Thermal Authority" entry in `architecture/AUTHORITY_REGISTRY.md`. No other authority may independently monitor or analyze platform thermal behavior.

## Layout

```text
core/thermal_authority/
  src/
    types.ts              Shared types (ThermalProfile, ITDT, ThermalState, ...)
    sensors.ts              ThermalSensorProvider interface + injectable implementation
    powerBridge.ts            PowerSnapshotProvider for cross-domain IPIA integration
    budgets.ts                  BudgetManager + default presets
    registry.ts                   ThermalRegistry — SSOT keyed by deviceId
    trends.ts                     Trend analysis (linear regression, heating/cooling rates)
    forecast.ts                   Forecast engine (ETA to warning/critical)
    anomaly.ts                    Anomaly detection (spikes, sensor failures, oscillation)
    recommendations.ts              Advisory recommendation engine (never controls hardware)
    diagnostics.ts                    Impossible temps, NaN, drift checks
    history.ts                        In-memory history store with queries
    lifecycle.ts                       Lifecycle transition table
    digitalTwin.ts                      ITDT assembly + platform helpers
    events.ts                           Interim publish/subscribe surface
    explainability.ts                    Append-only thermal audit trail
    errors.ts                             Structured, typed error taxonomy
    metrics.ts                              MetricsCollector for observability
    ThermalAuthority.ts                       Orchestrator: collect → analyze → forecast → recommend
    index.ts                                  Public exports
  tests/                                       60+ tests across 13 files
```

## Usage

```ts
import { ThermalAuthority, InjectableThermalSensorProvider } from './core/thermal_authority/src/index.js';

const sensors = new InjectableThermalSensorProvider();
const itia = new ThermalAuthority({ sensorProvider: sensors });

itia.registerDevice('gpu-0', 'gpu', 35);
sensors.setSamples([{
  deviceId: 'gpu-0',
  deviceType: 'gpu',
  celsius: 72,
  fanRpm: 1800,
  collectedAt: new Date().toISOString(),
  sensorAvailable: true,
}]);

await itia.collectAndUpdate();
itia.getProfile('gpu-0');
itia.getDigitalTwin('gpu-0');
itia.getRecommendations('gpu-0'); // advisory only
```

## Scope Boundary

ITIA owns thermal telemetry, profiling, trend analysis, budgeting, forecasting, anomaly detection, advisory recommendations, explainability, and the Institutional Thermal Digital Twin (ITDT). It does **not** control fans, clocks, voltages, mining strategy, runtime lifecycle, or hardware discovery.

Sensor acquisition integrates with IHIS via injectable `ThermalSensorProvider`. Cross-domain power data integrates with IPIA via injectable `PowerSnapshotProvider`. Budget configuration integrates with Configuration Authority via `setBudget()` / `setBudgetForDevice()` — no direct ICMS import.

## Governance

- No authority performs independent thermal monitoring; all thermal intelligence originates from ITIA.
- All recommendations are advisory (`advisory: true`); ITIA never autonomously controls hardware.
- Missing sensors are first-class (`sensorAvailable: false`, `ThermalSensorUnavailable` events).
- `InjectableThermalSensorProvider` and `PowerSnapshotProvider` are real extension points with injectable defaults — see ADR-0010.
