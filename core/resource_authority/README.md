# Institutional Resource Intelligence Authority (IRIA)

**Status:** IMPLEMENTED (Phase 18)  
**Location:** `core/resource_authority/`  
**Authority:** PHASE-18 / ADR-0011

## Purpose

IRIA is IMIP's sole authority for resource discovery, availability, allocation, reservation, ownership, utilization, capacity forecasting, and explainable resource intelligence. It transforms hardware inventory into governed computational resources. No other authority may allocate or reserve resources directly.

## Layout

```text
core/resource_authority/
  src/
    types.ts              Shared types (ResourceProfile, IRDT, Allocation, Reservation, ...)
    providers.ts            Injectable HardwareInventory/Power/Thermal provider interfaces
    registry.ts               ResourceRegistry — SSOT keyed by resourceId
    lifecycle.ts                 Resource state transition table (§8)
    availability.ts                 Availability evaluation from health/constraints/capacity
    allocation.ts                    AllocationEngine — exclusive/shared/partial/priority/temporary
    reservation.ts                      ReservationManager — create, conflict, expire
    ownership.ts                         OwnershipManager — explicit owner, lease, history
    utilization.ts                        Utilization metrics from allocations + capacity
    forecast.ts                              Capacity forecast — exhaustion, conflicts, idle
    recommendations.ts                        Advisory recommendations (not prescriptive)
    history.ts                                   Allocation/reservation history store
    digitalTwin.ts                                IRDT assembly + ranking helpers
    events.ts                                      Interim publish/subscribe surface
    explainability.ts                               Append-only resource audit trail
    errors.ts                                          Structured, typed error taxonomy
    metrics.ts                                            Fleet metrics collector
    ResourceAuthority.ts                                     Orchestrator
    index.ts                                                    Public exports
  tests/                                                         78 tests across 13 files
```

## Usage

```ts
import { ResourceAuthority, MapHardwareInventoryProvider } from './core/resource_authority/src/index.js';

const iria = new ResourceAuthority({
  hardwareInventoryProvider: new MapHardwareInventoryProvider([
    { hardwareId: 'gpu-001', resourceType: 'gpu', maximumCapacity: 100, capabilityRefs: ['gpu-mining'], healthStatus: 'healthy' },
  ]),
});

await iria.syncFromHardwareInventory();

iria.requestReservation({ resourceId: 'gpu-001:gpu', owner: 'workload-a', requestingAuthority: 'Workload Authority', capacity: 30 });
iria.requestAllocation({ resourceId: 'gpu-001:gpu', owner: 'workload-a', requestingAuthority: 'Workload Authority', mode: 'exclusive', capacity: 100 });
iria.getDigitalTwin('gpu-001:gpu');
iria.getRecommendations({ requestedCapacity: 50, capabilityRefs: ['gpu-mining'] });
iria.rankCandidatesForWorkload({ owner: 'w', requestingAuthority: 'W', mode: 'shared', capacity: 10, resourceType: 'gpu' });
```

## Scope Boundary

IRIA owns resource registry, availability, allocation, reservation, ownership, utilization, forecasting, and explainability — never hardware discovery, power management, thermal management, mining strategy, or workload scheduling (§4). Power and thermal constraints are consumed through injectable provider interfaces; IRIA does not import hardware/power/thermal authority modules directly.

## Governance

- Deterministic allocation: identical state and policies produce identical outcomes (candidate selection sorts by `resourceId`).
- Every mutation is audited and publishes events per §15.
- IRDT is descriptive and predictive — it does not allocate by itself.
