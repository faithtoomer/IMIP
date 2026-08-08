# ADR-0020: Institutional Health Intelligence Authority & Institutional Health Digital Twin

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 20  
**Deciders:** Architectural Authority (Specification)

## Context

IHIS (Phase 03) already owns per-device `HealthSummary`, `ReliabilityRecord`, and `EfficiencyProfile`; it remains the source of hardware-level health detection. IRIA (Phase 18) already owns resource profiles and their `healthStatus`. IWIA (Phase 19) owns workload governance and workload-side health/performance evidence. IPIA and ITIA own their respective power and thermal source signals.

IMIP nevertheless needs one institutional view that can assess all component categories—Hardware, Resources, Workloads, Plugins, Authorities, Runtime, Storage, Database, and Communications—without creating a duplicate hardware monitor, resource registry, scheduler, allocator, or mining controller.

## Decision

- Implement IHIA at `core/health_authority/` orchestrated by `HealthAuthority.ts`.
- Maintain a generic `HealthRegistry` keyed by Component Type + Component ID + Provider Source. Each profile contains UUID, current composite/sub-scores, immutable historical assessments, source-published failure count/MTBF/availability/reliability trend, inspection time, evidence, and maintenance history.
- Consume source-published data only through small `HardwareHealthProvider`, `ResourceHealthProvider`, `WorkloadHealthProvider`, `PowerHealthProvider`, and `ThermalHealthProvider` interfaces (or additional `HealthSignalProvider`s). The composition root adapts exposed source data; IHIA imports no other authority implementation class.
- Treat source scores and evidence as source-owned. IHIA only calculates configurable cross-cutting composite/sub-scores from values supplied through providers; it does not recreate hardware, resource, workload, power, or thermal detection mathematics.
- Make composite weights injectable and overridable. Defaults weight Reliability 35%, Stability 25%, Performance 20%, and Availability 20%; a future composition root may feed the same object from Configuration Authority without coupling IHIA to it.
- Make degradation and failure forecasts explicitly advisory. IHIA may issue explanations, maintenance recommendations, and `FailurePredicted`; it cannot trigger repairs, allocations, scheduling, throttles, or any other action.
- Implement IHDT as a continuously refreshed institutional read model combining profiles from hardware/power/thermal/resource/workload/runtime categories with reliability and maintenance histories.
- Publish the seven Phase 20 events through `HealthEventBus`, locally and optionally mirrored to the Institutional Event Bus. Every mirrored definition is tagged with the existing `health` EventCategory.
- Reserve Data Authority domains `health-registry` and `health-history` for governed persistence.

## Boundaries

- **IHIS / Hardware Authority:** IHIS owns `DeviceRecord.health`, `HealthSummary`, `ReliabilityRecord`, `EfficiencyProfile`, and hardware detection. IHIA consumes an adapter-provided published view and never recalculates device health or reliability.
- **IRIA / Resource Authority:** IRIA owns resource identity, availability, allocation, reservation, capacity, and `healthStatus`. IHIA consumes health evidence only and neither changes a resource nor duplicates resource-side scoring.
- **IWIA / Workload Authority:** IWIA owns workload registry, lifecycle, placement recommendations, efficiency, and workload evidence. IHIA may roll up injected workload health signals but has no workload lifecycle, scheduling, or placement methods.
- **IPIA / Power Authority and ITIA / Thermal Authority:** they own measurement, constraints, trend/anomaly detection, and their advisory recommendations. IHIA consumes their published scores/evidence only; it does not model sensors, power budgets, or thermal budgets.
- **Runtime, Storage, Database, Communications, Plugins, and Authorities:** IHIA records generic observed profiles but does not own their service operation, persistence, recovery execution, or configuration.
- Direct authority-to-authority calls are prohibited. Dependencies cross the boundary only through provider contracts, Event Bus events, or published interfaces.

## Consequences

- Institutional operators receive one explainable health view while source authorities retain their single-source ownership and raw metric definitions.
- Production composition must supply thin provider adapters; IHIA remains independently testable with null, map, and injectable providers.
- A critical score or predicted failure is notification-quality advisory information, not an authorization to act.
- IHDT can inform dashboards, operators, and future policy components without becoming a hidden control loop.
- Existing generic `health` events from other authorities remain valid; IHIA adds distinct Health Authority event definitions under the same category.

## Rejected Alternatives

- **Recalculating `HealthSummary` or `ReliabilityRecord` in IHIA:** Rejected — IHIS already owns those metrics and duplicate math would produce conflicting truth.
- **Embedding a second resource health field or resource allocator:** Rejected — IRIA owns resource health status and all resource governance.
- **Importing or instantiating other authority classes:** Rejected — violates authority isolation and prevents independent deployment/testing.
- **Allowing forecasts to invoke maintenance or scheduling:** Rejected — forecasts are advisory and IHIA does not own operational action.
- **Adding a new EventCategory:** Rejected — the generic `health` category already exists and supports IHIA’s event catalog.
