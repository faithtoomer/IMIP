# ADR-0009: Institutional Power Intelligence Authority & Energy Digital Twin

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 16  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP requires a single authority responsible for power monitoring, cost analysis, budgeting, efficiency calculation, and advisory recommendations. Power must be treated as a managed institutional resource with the same rigor as CPU, GPU, memory, and storage. PHASE-16 establishes IPIA as the implementation of the "Power Authority" entry in `architecture/AUTHORITY_REGISTRY.md`.

Three engineering decisions needed a record:

1. **Power telemetry is often unavailable on real hosts.** Unlike CPU temperature or utilization, instantaneous watt draw is frequently absent from OS APIs. IPIA must treat missing sensors as a first-class state (`sensorAvailable: false`) rather than failing or fabricating data.
2. **Electricity pricing comes from Configuration Authority.** IPIA must not hardcode rates or import Configuration Authority at runtime. An injectable `ElectricityPricingProvider` interface is the integration surface, with `StaticElectricityPricingProvider` as the default for standalone operation and tests.
3. **Recommendations must never execute hardware control.** IPIA measures, analyzes, and advises. Policy Authority determines allowable actions. Every `PowerRecommendation` carries `advisory: true` and IPIA exposes no power-limit mutation methods.

## Decision

- Implement IPIA at `core/power_authority/` orchestrated by `PowerAuthority.ts`, following the IHIS module pattern (registry, events, explainability, digital twin, injectable providers, comprehensive vitest tests with fakes).
- Adopt `PowerTelemetryProvider` as the production telemetry backend integration surface. Default `InjectablePowerTelemetryProvider` holds samples set externally; no mandatory `systeminformation` power dependency since power sensors are often unavailable.
- Adopt `ElectricityPricingProvider` for Configuration Authority integration. `StaticElectricityPricingProvider` + `resolveEffectiveRate()` handle flat and time-of-use billing.
- Implement the Institutional Energy Digital Twin (IEDT) as a descriptive assembly of profiles, history trends, pricing, efficiency, cost, budgets, and recommendations — with query helpers (`rankByRevenuePerKwh`, `estimateCostImpactOfPowerReduction`, `platformEnergySummary`, `efficiencyTrend`) that never control hardware.
- Use in-memory `PowerHistoryStore` as interim persistence until Database Authority exists.
- Use interim `PowerEventBus` (EventEmitter pattern) until institutional Event Bus is implemented.

## Consequences

- No future authority needs to duplicate power telemetry or cost calculations; all power intelligence is queried from IPIA.
- When real power sensor backends or Configuration Authority pricing integration are implemented, they plug into existing extension points with no changes to `PowerAuthority`'s public API.
- Policy Authority can consume IPIA recommendations and assessments to enforce power policies without IPIA ever mutating hardware limits.
- Historical data will migrate to Database Authority when available; `PowerHistoryStore` is a drop-in interim with a stable query interface.
