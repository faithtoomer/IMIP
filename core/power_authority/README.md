# Institutional Power Intelligence Authority (IPIA)

**Status:** IMPLEMENTED (Phase 16)  
**Location:** `core/power_authority/`  
**Authority:** PHASE-16 / ADR-0009

## Purpose

IPIA is IMIP's sole authority for power monitoring, profiling, budgeting, cost analysis, efficiency calculation, and explainability. It is the implementation of the "Power Authority" entry in `architecture/AUTHORITY_REGISTRY.md` — not a separate authority. No other authority may independently monitor or control platform power consumption.

## Layout

```text
core/power_authority/
  src/
    types.ts              Shared types (PowerProfile, EnergyDigitalTwin, PowerBudget, ...)
    telemetry.ts            PowerTelemetryProvider interface + injectable default
    pricing.ts                ElectricityPricingProvider + static default + rate resolution
    registry.ts                 PowerRegistry — SSOT keyed by deviceId
    cost.ts                       Energy cost calculations (kWh, session, hourly/daily)
    efficiency.ts                   Efficiency metrics from power + workload telemetry
    budget.ts                         BudgetManager — set/evaluate/track exceeded/recovered
    recommendations.ts                  Advisory recommendation engine (never executes)
    diagnostics.ts                        Sample validation + sensor-unavailable handling
    history.ts                              In-memory historical store (interim)
    lifecycle.ts                              Power lifecycle stage transitions
    digitalTwin.ts                            IEDT assembly + platform energy queries
    events.ts                                   Interim publish/subscribe surface
    explainability.ts                            Append-only power audit trail
    errors.ts                                     Structured, typed error taxonomy
    metrics.ts                                      Performance metrics collector
    PowerAuthority.ts                                Orchestrator: register → collect → analyze
    index.ts                                          Public exports
  tests/                                               60+ tests across 12 files. All telemetry
                                                       tests use InjectablePowerTelemetryProvider
                                                       — no test depends on host power sensors.
```

## Usage

```ts
import { PowerAuthority, InjectablePowerTelemetryProvider, StaticElectricityPricingProvider } from './core/power_authority/src/index.js';

const telemetry = new InjectablePowerTelemetryProvider();
const pricing = new StaticElectricityPricingProvider({ ratePerKwh: 0.12, currency: 'USD', billingModel: 'flat' });
const ipia = new PowerAuthority({ telemetryProvider: telemetry, pricingProvider: pricing });

ipia.registerDevice({ deviceId: 'gpu-1', deviceType: 'gpu', maximumRatedWatts: 320, idleWatts: 25 });
telemetry.setSamples([{ deviceId: 'gpu-1', watts: 280, timestamp: new Date().toISOString(), sensorAvailable: true }]);
await ipia.collectAndUpdate();

ipia.getProfile('gpu-1');
ipia.getCost('gpu-1');
ipia.getEfficiency('gpu-1');
ipia.getAssessment('gpu-1');
ipia.getDigitalTwin('gpu-1');
ipia.getPlatformEnergySummary();
ipia.rankByRevenuePerKwh();

ipia.setBudget('platform-cap', 'platform', 1000);
ipia.getRecommendations(); // advisory only — never modifies hardware
```

## Scope Boundary

IPIA owns power telemetry, profiling, cost, efficiency, budgeting, recommendations, and explainability — never mining strategy, thermal management, hardware discovery, runtime lifecycle, profitability decisions, or direct power-limit mutation (§4). Recommendations are advisory only; Policy Authority determines allowable actions.

## Governance

- No authority performs independent power monitoring; all power intelligence originates from IPIA.
- No consumer mutates a `PowerProfile` directly — only through `registerDevice()`, `ingestTelemetry()`, `collectAndUpdate()`, all fully audited.
- `PowerTelemetryProvider` and `ElectricityPricingProvider` are real injectable extension points — tests use fakes; production integrates with host sensors and Configuration Authority pricing respectively (ADR-0009).
- IPIA never modifies hardware power limits.
