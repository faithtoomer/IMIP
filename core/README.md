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

## Phase 10

`core/observability_authority/` is the seventh implemented core module and Program II's third — the Institutional Observability & Logging Authority (IOLA): structured, schema-enforced logging, correlation/tracing, immutable audit logging, diagnostics, and the Institutional Observability Graph. See `observability_authority/README.md` and `architecture/adr/ADR-0013-institutional-observability-logging-authority.md`.

## Phase 11

`core/scheduling_authority/` is the eighth implemented core module and Program II's fourth — the Institutional Scheduling & Orchestration Authority (ISOA): time/dependency/policy/resource-aware scheduling, retry management, maintenance windows, and the Institutional Time Graph. A pre-coding spec review found Policy Authority and Workload Authority both still reserved; ISOA's evaluators are real, permissive-by-default extension points rather than fabricated logic. See `scheduling_authority/README.md` and `architecture/adr/ADR-0014-institutional-scheduling-orchestration-authority.md`.

## Phase 12

`core/security_authority/` is the ninth implemented core module and Program II's fifth — the Institutional Security & Trust Authority (ISTA): security governance, Zero Implicit Trust, deny-by-default authorization, a real-encryption Secret Vault, immutable security auditing, and the Institutional Security Posture Model. See `security_authority/README.md` and `architecture/adr/ADR-0015-institutional-security-trust-authority.md`.

## Phase 13

`core/notification_authority/` is the tenth implemented core module and Program II's sixth — the Institutional Notification & Communication Authority (INCA): notifications as decisions, real multi-channel delivery, escalation, suppression, acknowledgement tracking, digest generation genuinely integrated with ISOA, and the Institutional Communication Intelligence layer. See `notification_authority/README.md` and `architecture/adr/ADR-0016-institutional-notification-communication-authority.md`.

## Phase 14

`core/resilience_authority/` is the eleventh implemented core module and Program II's seventh — the Institutional Backup, Recovery & Resilience Authority (IBRRA): real cross-authority backup/recovery orchestration over IDA/ICMS/ISMA/IHIS/IRBLM's own existing mechanisms, mandatory verification, deterministic recovery, and the Institutional Recovery Graph. See `resilience_authority/README.md` and `architecture/adr/ADR-0017-institutional-backup-recovery-resilience-authority.md`.

## Phase 15

`core/version_governance_authority/` is the twelfth implemented core module and Program II's eighth and final — the Institutional Version Governance & Migration Authority (IVGMA): real cross-authority version governance and migration orchestration over ICMS/IDA/IEB/IBRRA's own existing mechanisms, fail-closed compatibility verification, transactional migration, and the Institutional Evolution Graph. See `version_governance_authority/README.md` and `architecture/adr/ADR-0018-institutional-version-governance-migration-authority.md`. **Program II — Core Infrastructure is certified complete as of this phase.**
