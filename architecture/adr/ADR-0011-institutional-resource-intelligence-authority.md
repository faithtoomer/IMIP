# ADR-0011: Institutional Resource Intelligence Authority & Resource Digital Twin

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 18  
**Deciders:** Architectural Authority (Specification)

## Context

PHASE-03 (IHIS) established hardware as discovered physical devices with capabilities and health. Workload and mining authorities must not claim hardware directly — but hardware alone is not an allocatable resource. A GPU device is not the same as 16 GB of GPU memory, a compute queue slot, or a partial shared allocation.

PHASE-18 introduces IRIA as the sole authority for:

- Resource registry and classification (CPU cores/pools, GPU memory/queues, ASIC hashboards, future cloud/fleet types)
- Availability, reservation, allocation, ownership, and leasing
- Utilization monitoring and capacity forecasting
- Explainable resource intelligence via the Institutional Resource Digital Twin (IRDT)

IRIA must integrate with Hardware, Power, and Thermal authorities without creating compile-time coupling — those authorities may not exist or may evolve independently.

## Decision

- Implement IRIA at `core/resource_authority/` orchestrated by `ResourceAuthority.ts`.
- Consume hardware inventory through `HardwareInventoryProvider` — a list of allocatable units `{ hardwareId, resourceType, maximumCapacity, capabilityRefs, healthStatus }`. Production wiring to IHIS is deferred; tests use `MapHardwareInventoryProvider` / `InjectableHardwareInventoryProvider`.
- Consume power and thermal constraints through `PowerConstraintProvider` and `ThermalConstraintProvider` with optional `isPowerBlocking` / `isThermalBlocking` and profile ref accessors. Null/Map/Injectable implementations provided for tests.
- Use abstract capacity units within each `ResourceProfile` — dimensionless governance units comparable only within a single resource, not across types.
- Enforce deterministic candidate selection: when multiple resources qualify, sort by `resourceId` ascending before choosing.
- Implement allocation modes: `exclusive`, `shared`, `partial`, `priority`, `temporary` with rejection of double exclusive allocation and capacity overcommit.
- Implement reservation manager with time-range overlap detection, priority conflict rules, and automatic expiry.
- Implement IRDT (`digitalTwin.ts`) as a read-model combining profile, ownership, utilization, forecast, and constraint flags. Helpers (`rankCandidatesForWorkload`, `underutilizedHealthy`, `explainUnavailability`, `projectedImpactOfAllocation`) are advisory — IRDT does not allocate.
- Publish events per spec §15 through interim `ResourceEventBus` (same pattern as IHIS/ICMS).
- Record every mutation in `ResourceAuditTrail`.

## Consequences

- Future Workload Intelligence Authority queries IRIA for allocation/reservation; it never maintains a parallel resource registry.
- IHIS remains the hardware SSOT; IRIA remains the resource SSOT. `syncFromHardwareInventory()` is the approved ingestion path.
- Power/thermal policy enforcement stays in IPIA/ITIA; IRIA only respects blocking signals via providers.
- Suitability and ranking in IRDT use deterministic weighted formulas (health + spare capacity), not ML — consistent with ADR-0008's Digital Twin approach for hardware.
- When the institutional Event Bus is implemented, `ResourceEventBus` retargets without API changes to `ResourceAuthority`.

## Rejected Alternatives

- **Direct IHIS imports:** Rejected — violates authority boundary and prevents testing without hardware module.
- **Mining-aware allocation:** Rejected — scheduling and strategy are explicit non-responsibilities (§4).
- **Device-name-based selection:** Rejected — capability refs and deterministic scoring only.
