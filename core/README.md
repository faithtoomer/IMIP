# core/

Institutional platform logic.

## Ownership

Core owns every institutional capability, including:

- Configuration
- Decision Engine
- Runtime
- Scheduler
- Telemetry
- Logging
- Hardware Detection
- Health Monitoring
- Profitability
- AI
- Event Bus
- Security
- Dashboard Integration
- Database Access
- Metrics
- Explainability
- Platform Capability Registry (reserved)
- Policy Engine (reserved)

## Prohibitions

- Never coin logic
- Never miner logic
- Never plugin-specific adapters

## Phase 00

Core directories are established. No platform modules are implemented in Phase 00.

### Reserved

```text
core/capability_registry/
core/policy_engine/
```

See `capability_registry/README.md` and `architecture/adr/ADR-0002-platform-capability-registry.md`.

See `policy_engine/README.md` and `architecture/adr/ADR-0004-policy-authority.md`.

## Phase 01

Runtime architecture (topology, layers, lifecycle, dependency laws, decision pipeline, explainability pipeline) is documented in `architecture/RUNTIME_ARCHITECTURE.md`. No platform modules are implemented in Phase 01.

## Phase 02

`core/configuration_authority/` is the first implemented core module — the Institutional Configuration Management System (ICMS), the institutional Single Source of Truth. See `configuration_authority/README.md`, `architecture/adr/ADR-0005-configuration-authority-ssot.md`, `architecture/adr/ADR-0006-configuration-policy-boundary.md`, and `architecture/adr/ADR-0007-configuration-policy-operational-state.md`.

## Phase 03

`core/hardware_authority/` is the second implemented core module — the Institutional Hardware Intelligence System (IHIS), the Hardware Authority. See `hardware_authority/README.md` and `architecture/adr/ADR-0008-hardware-intelligence-digital-twin.md`.

## Phase 05

`core/event_bus/` is the third implemented core module — the Institutional Event Bus (IEB), IMIP's real communication backbone. See `event_bus/README.md` and `architecture/adr/ADR-0009-institutional-event-bus.md`. (There is no Phase 04 module — see `specs/README.md`.)

## Phase 07

`core/runtime_bootstrap/` is the fourth implemented core module — the Institutional Runtime Bootstrap & Lifecycle Manager (IRBLM), Program I's capstone. See `runtime_bootstrap/README.md` and `architecture/adr/ADR-0010-runtime-bootstrap-orchestrator.md`. (There is no Phase 06 module — Phase 07 was given directly as the final phase.)

## Phase 08

`core/data_authority/` is the fifth implemented core module and Program II's first — the Institutional Data Authority (IDA), IMIP's first real persistence layer, plus the Institutional Knowledge Model (IKM) built in full. See `data_authority/README.md` and `architecture/adr/ADR-0011-institutional-data-authority.md`.

## Phase 09

`core/storage_authority/` is the sixth implemented core module and Program II's second — the Institutional Storage Management Authority (ISMA), owning physical storage infrastructure as distinct from IDA's ownership of logical data. IDA and `configuration_authority/` were additively retrofitted with an opt-in `storageAuthority` option. See `storage_authority/README.md` and `architecture/adr/ADR-0012-institutional-storage-management-authority.md`.
