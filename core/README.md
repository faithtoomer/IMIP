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
