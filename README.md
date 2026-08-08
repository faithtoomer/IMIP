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

## Repository Architecture

```text
IMIP/
├── architecture/     # ADRs, contracts, diagrams, governance
├── specs/            # Institutional Engineering Specifications (implementation authority)
├── core/             # Institutional platform logic (never coin/miner logic)
│   ├── capability_registry/   # Reserved — Platform Capability Registry (PCR)
│   ├── policy_engine/         # Reserved — Policy Authority (Phase 01)
│   ├── configuration_authority/  # Implemented — Single Source of Truth (Phase 02)
│   └── hardware_authority/       # Implemented — Hardware Intelligence / Digital Twin (Phase 03)
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
