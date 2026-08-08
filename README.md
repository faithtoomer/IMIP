# IMIP

**Institutional Mining Intelligence Platform**

IMIP is an institutional platform architecture for multi-engine, multi-hardware, multi-coin mining operations. It is not a collection of independent mining applications.

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 00 | Repository Governance & Institutional Architecture | Established |
| 01 | Institutional System Architecture & Runtime Blueprint | Established |
| 02 | Institutional Configuration Management System (ICMS) — Single Source of Truth | Implemented (v2.0) |
| 03 | Institutional Hardware Intelligence System (IHIS) — Hardware Authority | Implemented |
| 05 | Institutional Event Bus (IEB) — communication backbone | Implemented |
| 07 | Institutional Runtime Bootstrap & Lifecycle Manager (IRBLM) — Program I capstone | Implemented |
| 08 | Institutional Data Authority (IDA) — Program II, persistence & data governance | Implemented |
| 09 | Institutional Storage Management Authority (ISMA) — Program II, physical storage infrastructure | Implemented |
| 10 | Institutional Observability & Logging Authority (IOLA) — Program II, structured logging & observability | Implemented |
| 11 | Institutional Scheduling & Orchestration Authority (ISOA) — Program II, time-based & policy-driven execution scheduling | Implemented |
| 12 | Institutional Security & Trust Authority (ISTA) — Program II, security governance & trust | Implemented |
| 13 | Institutional Notification & Communication Authority (INCA) — Program II, institutional communication | Implemented |
| 14 | Institutional Backup, Recovery & Resilience Authority (IBRRA) — Program II, operational resilience | Implemented |
| 15 | Institutional Version Governance & Migration Authority (IVGMA) — Program II, final phase: version governance & controlled migration | Implemented |

Phase 04 was not implemented as a separate specification — its content overlapped almost entirely with Phase 03 and was absorbed as additive enhancements instead (`docs/phase-03/implementation-summary.md` §2a). Phase 06 was never specified; Phase 07 was given directly as Program I's final phase.

**Program I (Foundation) is certified complete.** See `docs/program-1-certification/` for the consolidated architecture diagrams, authority registry, dependency graph, event/capability/configuration catalogs, runtime lifecycle documentation, certification results, and the known-assumptions ledger. **Program II (Core Infrastructure) is certified complete as of Phase 15** — eight authorities (Phases 08–15) built on Program I as a stable, documented platform. See `docs/phase-15/certification-checklist.md`.

## Repository Architecture

```text
IMIP/
├── architecture/     # ADRs, contracts, diagrams, governance
├── specs/            # Institutional Engineering Specifications (implementation authority)
├── core/             # Institutional platform logic (never coin/miner logic)
│   ├── capability_registry/   # Reserved — Platform Capability Registry (PCR)
│   ├── policy_engine/         # Reserved — Policy Authority (Phase 01)
│   ├── configuration_authority/  # Implemented — Single Source of Truth (Phase 02)
│   ├── hardware_authority/       # Implemented — Hardware Intelligence / Digital Twin (Phase 03)
│   ├── event_bus/                # Implemented — Institutional Event Bus (Phase 05)
│   ├── runtime_bootstrap/        # Implemented — Runtime Orchestrator (Phase 07, Program I capstone)
│   ├── data_authority/           # Implemented — Data Authority (Phase 08, Program II)
│   ├── storage_authority/        # Implemented — Storage Authority (Phase 09, Program II)
│   ├── observability_authority/  # Implemented — Observability & Logging Authority (Phase 10, Program II)
│   ├── scheduling_authority/     # Implemented — Scheduling & Orchestration Authority (Phase 11, Program II)
│   ├── security_authority/       # Implemented — Security & Trust Authority (Phase 12, Program II)
│   ├── notification_authority/   # Implemented — Notification & Communication Authority (Phase 13, Program II)
│   ├── resilience_authority/     # Implemented — Backup, Recovery & Resilience Authority (Phase 14, Program II)
│   └── version_governance_authority/  # Implemented — Version Governance & Migration Authority (Phase 15, Program II)
├── plugins/          # Mining implementations by capability class
│   ├── cpu/
│   │   └── monero/
│   ├── gpu/
│   │   └── flux/
│   └── asic/
├── dashboard/        # Operations UI
├── api/              # External interfaces
├── database/         # Data persistence boundary
├── scripts/          # Operational scripts
├── tools/            # Developer and platform tooling
├── tests/            # Platform, plugin, integration, stress, certification
├── docs/             # Institutional documentation and phase reports
└── .cursor/          # Cursor agent governance and project rules
```

## Governance

- **Architectural Authority:** Specifications in `specs/` only.
- **Implementation Authority:** Cursor, executing approved specifications.
- **Core owns** all institutional capabilities (configuration, decision engine, runtime, scheduler, telemetry, logging, hardware detection, health, profitability, AI, event bus, security, metrics, explainability, database access, dashboard integration).
- **Plugins own** only implementation-specific functionality and must implement the approved plugin contract.
- **No additional top-level folders** may be introduced without architectural approval.

See `architecture/GOVERNANCE.md` for repository laws.

## Phase 00 Deliverables

See `docs/phase-00/` for the migration report, validation report, and certification checklist.

## Phase 01 — Runtime Architecture

The complete runtime blueprint (topology, authority hierarchy, decision pipeline, event model, dependency laws, explainability pipeline, AI boundaries) is defined in `architecture/RUNTIME_ARCHITECTURE.md` and `architecture/AUTHORITY_REGISTRY.md`. See `docs/phase-01/` for the deliverable summary and certification checklist.

## Phase 02 — Institutional Configuration Management System (ICMS)

ICMS (`core/configuration_authority/`) is IMIP's first implemented module and institutional Single Source of Truth: staged 9-phase validation, immutable content-addressed snapshots with rollback, per-key provenance, a migration framework, and 5-tier secret classification. Node.js (ESM) + TypeScript; run `npm install && npm test` to verify (81 tests). See `core/configuration_authority/README.md` and `docs/phase-02/` for the implementation summary, the Configuration/Policy/Operational-State boundary mapping, and the certification checklist.

## Phase 03 — Institutional Hardware Intelligence System (IHIS)

IHIS (`core/hardware_authority/`) is IMIP's Hardware Authority: real cross-platform discovery (CPU/GPU/ASIC-ready/memory/storage/motherboard/network), capability-first assessment (never device-name lookups), runtime state + lifecycle tracking, and a Digital Twin that scores hardware suitability per workload from health, availability, and reliability rather than identity. See `core/hardware_authority/README.md` and `docs/phase-03/` for the implementation summary and certification checklist.

## Phase 05 — Institutional Event Bus (IEB)

IEB (`core/event_bus/`) is IMIP's real communication backbone: an ownership-enforced event registry, a binary-heap priority queue, subscriber-failure isolation with dead-subscriber detection, circular-publication detection, and configurable persistence. ICMS and IHIS are connected to it via a mirror/bridge (their synchronous APIs unchanged, every event additionally mirrored onto the IEB) — see ADR-0009 §6 and `docs/phase-05/event-bus-connection.md`. See `core/event_bus/README.md` and `docs/phase-05/` for the implementation summary and certification checklist.

## Phase 07 — Institutional Runtime Bootstrap & Lifecycle Manager (IRBLM)

IRBLM (`core/runtime_bootstrap/`) assembles, validates, initializes, supervises, and gracefully shuts down IMIP — Program I's capstone. It's a generic, dependency-graph-driven orchestrator (not a hardcoded sequence) with adapters wrapping the three authorities that actually exist (Event Bus, Configuration Authority, Hardware Authority) plus a continuously-updated Runtime Governance Board answering "why is X unavailable" at any point in the platform's life. See `core/runtime_bootstrap/README.md` and `docs/phase-07/` for the implementation summary and certification checklist.

## Phase 08 — Institutional Data Authority (IDA)

IDA (`core/data_authority/`) is IMIP's first real persistence layer and Program II's first phase: schema-governed CRUD, transactions with nested-savepoint semantics, a monotonic-revision optimistic-concurrency model, read-time schema migration, retention/purge, real atomic backup and recovery, a self-hosted structurally-immutable audit trail, and the Institutional Knowledge Model — a generic, cross-domain entity-relationship graph built in full rather than deferred. Storage-technology-independent by construction (Law 2): all SQL is confined to one file, behind a `StorageProvider` interface, backed by Node's built-in `node:sqlite`. See `core/data_authority/README.md` and `docs/phase-08/` for the implementation summary and certification checklist.

## Phase 09 — Institutional Storage Management Authority (ISMA)

ISMA (`core/storage_authority/`) is Program II's second phase and IMIP's first authority for physical storage infrastructure — cleanly separated from IDA's ownership of logical data (IDA owns *data*; ISMA owns *where it lives*). Real storage registry, synchronous allocation, capacity/health monitoring (`fs.statfsSync` + `systeminformation`), retention enforcement, checksummed archival, a 6-stage lifecycle, and the Institutional Storage Topology — a continuously queryable map of every managed storage resource. IDA and ICMS were additively retrofitted with an opt-in `storageAuthority` option so Law 3 ("no hardcoded filesystem paths") holds for all three authorities, not just future ones — see ADR-0012. See `core/storage_authority/README.md` and `docs/phase-09/` for the implementation summary and certification checklist.

## Phase 10 — Institutional Observability & Logging Authority (IOLA)

IOLA (`core/observability_authority/`) is Program II's third phase — named deliberately broader than "Logging Authority" since logging is one pillar of observability alongside metrics, tracing, diagnostics, correlation, and explainability. Schema-enforced structured logging (Law 2, mirroring the Event Bus's own registry discipline), correlation/trace propagation, a structurally-immutable audit trail, real log-driven diagnostics, configurable routing (console/memory/file/database, with a safe low-severity-off-the-database default), and the Institutional Observability Graph — a causal-chain view over correlated log records, built in full rather than deferred. See `core/observability_authority/README.md` and `docs/phase-10/` for the implementation summary and certification checklist.

## Phase 11 — Institutional Scheduling & Orchestration Authority (ISOA)

ISOA (`core/scheduling_authority/`) is Program II's fourth phase and the platform's time-intelligence authority — filling the "Scheduler Authority" slot named in the Phase 01 Authority Registry, expanded from a plain timer into scheduling that's aware of time, dependencies, policy, resources, runtime state, and maintenance windows. Six schedule types, real dependency-cycle detection, retry with tracked attempt counts, real IEB/IOLA integration, and the Institutional Time Graph — a queryable model of schedule dependencies, time windows, and execution history, built in full. A pre-coding spec review (explicitly requested before implementation) found that Policy Authority and Workload Authority are both still unimplemented, so ISOA's Policy/Resource evaluators are real, generic extension points with an honest permissive default rather than fabricated logic. See `core/scheduling_authority/README.md` and `docs/phase-11/` for the implementation summary and certification checklist.

## Phase 12 — Institutional Security & Trust Authority (ISTA)

ISTA (`core/security_authority/`) is Program II's fifth phase — security *governance*, not just authentication and permissions: a Trust Registry (Law 2 "Zero Implicit Trust"), deny-by-default RBAC with ABAC-readiness, a Secret Vault with real AES-256-GCM encryption at rest, immutable security auditing, and the Institutional Security Posture Model, built in full. A pre-coding spec review (explicitly requested) found a real naming collision between ISTA's access-control "Authorization" and `DECISION_PIPELINE.md`'s mining-decision "Authorization" stage (documented apart as "Access Authorization"), and confirmed ISTA's Secret Vault is complementary to — not a duplicate of — ICMS's existing secret classification/masking and IOLA's existing log masking, forming a real three-layer defense-in-depth stack. See `core/security_authority/README.md` and `docs/phase-12/` for the implementation summary and certification checklist.

## Phase 13 — Institutional Notification & Communication Authority (INCA)

INCA (`core/notification_authority/`) is Program II's sixth phase — notifications as institutional decisions (who should know, what, when, through which channel, at what priority, whether acknowledgement is required, whether it escalates), not just messages. Real multi-channel delivery (Console/Memory/Log/Webhook/Discord, all functional; Email as an honest bring-your-own-sender interface), a tick-based escalation engine, structurally-immutable acknowledgement/audit trails, and suppression/digest generation genuinely integrated with ISOA's real scheduling and Institutional Time Graph rather than duplicating either — plus the Institutional Communication Intelligence layer, built in full. A pre-coding spec review (explicitly requested) confirmed INCA's own notification-category and priority types are deliberately distinct from the Event Bus's `EventCategory`/`EventPriority`, since the spec's value sets don't match those unions. See `core/notification_authority/README.md` and `docs/phase-13/` for the implementation summary and certification checklist.

## Phase 14 — Institutional Backup, Recovery & Resilience Authority (IBRRA)

IBRRA (`core/resilience_authority/`) is Program II's seventh phase and the last foundational infrastructure authority before specialized platform capabilities begin — operational resilience, not just "backup and restore." A pre-coding spec review (explicitly requested) found that IDA, ICMS, ISMA, and IRBLM already have real backup/recovery/certification primitives, so IBRRA is built as a real cross-authority orchestration layer: every domain handler wraps an already-real, already-certified method (IDA's `backup()`/`restore()`, ICMS's `SnapshotStore`, ISMA's `allocate()`, IRBLM's `getCertificationStatus()`) rather than duplicating persistence logic — Law 1 applied reflexively to IBRRA's own design. Mandatory backup verification, deterministic multi-step recovery that halts on any real failure, and the Institutional Recovery Graph — a real model of recovery-point compatibility and schema-version drift — built in full. See `core/resilience_authority/README.md` and `docs/phase-14/` for the implementation summary and certification checklist.

## Phase 15 — Institutional Version Governance & Migration Authority (IVGMA)

IVGMA (`core/version_governance_authority/`) is Program II's eighth and final phase — versioning and migration treated as one authority spanning two distinct concerns: versioning is governance (what version is this, is it certified, is it compatible), migration is controlled evolution (how the platform moves safely from one version to another). A pre-coding spec review (explicitly requested) found that ICMS, IDA, IEB, and IBRRA already have real version-tracking and migration/rollback primitives, so IVGMA is built as a real cross-authority governance and orchestration layer: every version source reads an already-real version field (ICMS's `getVersionInfo()`, IDA's `DomainSchema.version`, IEB's `EventDefinition.version`) and every migration executor wraps an already-real mechanism (ICMS's `reload()`/`rollback()`, IDA's migration-on-read, optionally IBRRA's `requestRecovery()` via a composable `withResilienceRollback()`) rather than duplicating migration logic — Law 1 applied reflexively to IVGMA's own design. A real naming collision with ICMS's own `CompatibilityRegistry` class was found and resolved by naming IVGMA's cross-artifact-type registry `ArtifactCompatibilityRegistry`. Fail-closed compatibility verification, transactional migration (certified or rolled back/failed, never left partial), and the Institutional Evolution Graph — a real model of version lineage, migration paths, and upgrade safety — built in full. See `core/version_governance_authority/README.md` and `docs/phase-15/` for the implementation summary and certification checklist. **This certifies Program II — Core Infrastructure as complete.**

### Local Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Local PC Setup

Cloud agents cannot access your workstation. On the local PC:

```bash
git checkout cursor/phase-00-repository-governance-5130
chmod +x scripts/local-pc-bootstrap.sh
./scripts/local-pc-bootstrap.sh
```

If `Monero_Engine` / `Flux_Engine` already exist on that machine, import them with the paths documented in `docs/phase-00/local-pc-setup.md`.
