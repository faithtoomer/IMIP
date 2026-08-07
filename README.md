# IMIP

**Institutional Mining Intelligence Platform**

IMIP is an institutional platform architecture for multi-engine, multi-hardware, multi-coin mining operations. It is not a collection of independent mining applications.

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 00 | Repository Governance & Institutional Architecture | Established |

## Repository Architecture

```text
IMIP/
├── architecture/     # ADRs, contracts, diagrams, governance
├── specs/            # Institutional Engineering Specifications (implementation authority)
├── core/             # Institutional platform logic (never coin/miner logic)
│   └── capability_registry/   # Reserved — Platform Capability Registry (PCR)
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
