# Plugin Contract

**Status:** Architectural Standard  
**Phase:** 00 (defined; not implemented)  
**Authority:** PHASE-00 Repository Governance

## Purpose

Every IMIP plugin is an institutional extension. Plugins shall never become applications. Every plugin must implement this contract.

## Contract Principles

1. The platform discovers plugins dynamically.
2. The platform never hardcodes plugin knowledge.
3. Discovery occurs exclusively through manifests.
4. Functionality is never inferred from directory names.
5. Plugins own only implementation-specific functionality.
6. Plugins never own institutional services (configuration authority, scheduler, database, profitability, logging framework, dashboard, decision engine).

## Required Surfaces

A conforming plugin exposes:

| Surface | Description |
|---------|-------------|
| Manifest | Declares identity, capability, hardware, algorithms, backend, health, statistics, configuration schema |
| Capability Registration | Registers with the Platform Capability Registry (when PCR is implemented) |
| Adapter Boundary | Isolates miner/backend specifics behind platform interfaces |
| Statistics Interface | Provides plugin-specific metrics to core telemetry consumers |
| Health Endpoints | Reports plugin-local health without owning platform health monitoring |
| Configuration Schema | Declares plugin-local settings consumed by Core Configuration Authority |

## Prohibited Surfaces

Plugins must not implement:

- Configuration Authority
- Decision Engine
- Scheduler
- Platform logging framework
- Platform telemetry framework
- Profitability engine
- Database access layer
- Dashboard application logic
- Event bus ownership
- Security authority

## Lifecycle (Future Implementation)

Defined for architectural clarity. Not implemented in Phase 00.

1. Manifest discovered by platform
2. Manifest validated against schema
3. Capabilities registered in PCR
4. Plugin activated under Core Runtime control
5. Health and statistics consumed by Core services
