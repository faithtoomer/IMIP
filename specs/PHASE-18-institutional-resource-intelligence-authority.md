# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM III — RESOURCE INTELLIGENCE

## Phase 18

# Institutional Resource Intelligence Authority (IRIA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Resource Intelligence Authority

> IRIA is a new institutional authority added to `architecture/AUTHORITY_REGISTRY.md`. Hardware describes physical devices; resources describe allocatable computational capacity. IRIA is the institutional asset manager bridging hardware intelligence and future workload intelligence.

---

# 1. Mission Statement

The Institutional Resource Intelligence Authority (IRIA) shall serve as the sole authority responsible for discovering resource availability, governing resource ownership, coordinating allocation and reservation, monitoring utilization, forecasting capacity, and providing explainable resource intelligence across IMIP. IRIA transforms hardware into governed computational resources. No authority shall independently allocate or reserve resources.

---

# 2. Mission Objectives

Resource registry, classification, availability, allocation, reservation, leasing, ownership, utilization, capacity forecasting, explainable resource recommendations, and future fleet resource management.

---

# 3. Institutional Principles

1. **Single Resource Authority** — IRIA is the sole owner of computational resource governance.
2. **Hardware Is Not a Resource** — hardware describes physical devices; resources describe allocatable capacity.
3. **Allocation Requires Governance** — no workload may claim resources outside IRIA.
4. **Observation Before Allocation** — resource state measured before allocation decisions.
5. **Explainability** — every allocation answers which/why/constraints/requestor/remaining capacity.
6. **Deterministic Allocation** — identical platform state and policies produce identical outcomes.

---

# 4. Responsibilities

IRIA owns: Resource Registry/Profiles/Classification/Availability/Reservations/Allocation/Ownership/Leasing/Utilization, capacity forecasting, resource events, resource explainability, and the Institutional Resource Digital Twin (IRDT).

IRIA does **not** own: hardware discovery, power management, thermal management, mining strategy, workload scheduling, or decision intelligence.

---

# 5. Runtime Architecture

```text
Hardware Authority (inventory feed)
        │
        ▼
Institutional Resource Intelligence Authority
        │
        ├──────── Resource Registry
        ├──────── Availability Engine
        ├──────── Allocation Engine
        ├──────── Reservation Manager
        ├──────── Ownership Manager
        ├──────── Utilization Engine
        ├──────── Capacity Forecast Engine
        ├──────── Explainability Engine
        └──────── Institutional Resource Digital Twin (IRDT)
```

Orchestrated by `ResourceAuthority.ts`. Module: `core/resource_authority/`.

---

# 6–8. Registry, Types, States

Resource Profile: resource UUID, type, hardware UUID, current owner, state, available/reserved/utilized/maximum capacity, capability references, health, power/thermal profile references, last updated. Types: CPU (cores/logical/pools), GPU (device/memory/queues), ASIC (devices/hash boards), Memory, Storage, Future (cloud/remote/cluster/fleet). Lifecycle: Discovered → Registered → Available → Reserved → Allocated → Active → Released → Unavailable → Retired. Transitions auditable.

---

# 9–14. Availability through Forecasting

Availability evaluates hardware health, runtime state, power/thermal constraints, maintenance, reservations, utilization, policy. Allocation supports exclusive/shared/partial/priority/temporary modes; requires availability, policy approval, dependency validation, ownership. Reservations: immediate/future/expiring/priority with conflict detection; expired auto-released. Ownership/leasing always explicit. Utilization and capacity forecasts are advisory.

---

# 15–23. Events through Contract

Events: ResourceRegistered, ResourceAvailable, ResourceReserved, ResourceReservationExpired, ResourceAllocated, ResourceReleased, ResourceUnavailable, ResourceOwnershipChanged, ResourceForecastUpdated, ResourceUtilizationUpdated. Controlled interfaces for lookup/allocate/reserve/release/utilization/capacity/forecast/history. Detect double allocation, conflicts, invalid ownership, overcommit, orphans, leaks, inconsistencies. Full tests, acceptance, and ICS required. Cursor SHALL NOT allocate outside IRIA, duplicate registry ownership, overcommit without policy, mix scheduling/mining strategy into governance, or introduce placeholders. Integrate with Hardware, Power, Thermal, Runtime, and Data Authorities through approved injectable interfaces.

---

# 24. Architect's Enhancement: Institutional Resource Digital Twin (IRDT)

IRDT continuously models operational state of every allocatable resource by combining hardware identity (IHIS), capabilities, power profile (IPIA), thermal profile (ITIA), ownership, allocation/reservation history, utilization trends, health, runtime state, and workload forecasts. Descriptive and predictive — not prescriptive; does not allocate by itself.
