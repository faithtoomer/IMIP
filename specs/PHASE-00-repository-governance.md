# IMIP PHASE 00

# Repository Governance & Institutional Architecture

## Institutional Engineering Specification

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Specification Only

---

# 1. Objective

This phase establishes the institutional repository architecture for the Institutional Mining Intelligence Platform (IMIP).

This phase does **not** implement mining.

This phase does **not** implement authorities.

This phase does **not** implement AI.

Its sole purpose is to establish the permanent repository structure upon which every future implementation will be built.

The resulting architecture shall support unlimited expansion without requiring structural redesign.

---

# 2. Mission

Transform the current repository from multiple independent mining engines into one institutional platform capable of supporting:

* CPU mining
* GPU mining
* ASIC mining
* Multiple mining engines
* Multiple coins
* Multiple workstations
* Distributed mining
* Fleet management
* AI optimization
* Institutional governance

The repository architecture shall remain stable regardless of how many mining engines are added.

---

# 3. Existing Structure

Current repository (transitional / pre-governance state):

```text
trading-server/
└── IMIP/
    ├── Flux_Engine/
    └── Monero_Engine/
```

This structure shall be considered transitional.

**Repository note:** This GitHub repository (`faithtoomer/IMIP`) is the IMIP institutional root. At Phase 00 start, only `README.md` was present. Engine source trees `Flux_Engine/` and `Monero_Engine/` were not present in this repository and therefore could not be moved; their target plugin locations are established and reserved.

---

# 4. Target Repository Architecture

Cursor shall produce the following structure (IMIP root):

```text
IMIP/

    ├── architecture/
    │
    ├── specs/
    │
    ├── core/
    │
    ├── plugins/
    │
    │   ├── cpu/
    │   │
    │   │   └── monero/
    │   │
    │   ├── gpu/
    │   │
    │   │   └── flux/
    │   │
    │   └── asic/
    │
    ├── dashboard/
    │
    ├── api/
    │
    ├── database/
    │
    ├── scripts/
    │
    ├── tools/
    │
    ├── tests/
    │
    ├── docs/
    │
    └── .cursor/
```

No additional top-level folders may be introduced without architectural approval.

**Architect's addition (binding):** Reserve Platform Capability Registry:

```text
core/
    capability_registry/
```

---

# 5. Core Platform Ownership

The Core Platform owns every institutional capability.

Including but not limited to:

* Configuration
* Decision Engine
* Runtime
* Scheduler
* Telemetry
* Logging
* Hardware Detection
* Health Monitoring
* Profitability
* AI
* Event Bus
* Security
* Dashboard Integration
* Database Access
* Metrics
* Explainability

These capabilities shall never exist inside plugin directories.

---

# 6. Plugin Ownership

Plugins own only implementation-specific functionality.

Example — Monero Plugin owns:

* XMRig Adapter
* RandomX configuration
* Monero statistics parser
* Monero capability registration
* Monero benchmarking

Does NOT own:

* Configuration Authority
* Scheduler
* Database
* Profitability calculations
* Logging framework
* Dashboard
* Decision Engine

The same rule applies to every plugin.

---

# 7. Plugin Architecture

Plugins are institutional extensions.

Plugins shall never become applications.

Every plugin must implement the approved plugin contract.

The platform discovers plugins dynamically.

The platform never hardcodes plugin knowledge.

---

# 8. Plugin Manifest Standard

Every plugin shall expose a manifest.

Minimum information:

* Plugin ID
* Version
* Capability Type
* Supported Hardware
* Supported Algorithms
* Miner Backend
* Health Endpoints
* Statistics Interface
* Configuration Schema

The platform discovers plugins exclusively through manifests.

The platform shall never infer functionality from directory names.

---

# 9. Capability Classification

Plugins are categorized by capability.

CPU / GPU / ASIC

Future capabilities may be added.

Examples:

```text
plugins/
cpu/
gpu/
asic/
fpga/
cloud/
```

The architecture shall not require redesign to support new capability classes.

---

# 10. Repository Laws

Cursor SHALL

* Preserve every existing file.
* Preserve Git history where possible.
* Move directories rather than recreate them.
* Remove obsolete duplicate directories after successful migration.
* Produce a migration summary.

Cursor SHALL NOT

* Implement features.
* Create placeholder implementations.
* Introduce TODOs.
* Modify runtime logic.
* Rename architecture without approval.

---

# 11. Migration Rules

Monero_Engine shall become:

```text
plugins/cpu/monero/
```

Flux_Engine shall become:

```text
plugins/gpu/flux/
```

No implementation changes are permitted during migration.

Only repository organization changes.

---

# 12. Institutional Directory Responsibilities

## architecture/

Contains:

* Runtime diagrams
* Architectural Decision Records (ADRs)
* Interface contracts
* Event diagrams
* Sequence diagrams
* Data flow
* Governance

## specs/

Contains Institutional Engineering Specifications.

These are the only documents Cursor may implement.

## core/

Contains institutional platform logic.

Never coin logic.

Never miner logic.

## plugins/

Contains mining implementations.

Never platform logic.

## dashboard/

Contains Operations UI.

No mining logic.

## api/

Contains External interfaces.

No mining implementation.

## tests/

Contains:

* Platform tests
* Plugin tests
* Integration tests
* Stress tests
* Certification tests

---

# 13. Architectural Constraints

The following are prohibited:

* Duplicate configuration
* Duplicate telemetry
* Duplicate logging
* Duplicate profitability
* Duplicate scheduling
* Duplicate health monitoring
* Duplicate event systems
* Duplicate database access

All institutional services exist exactly once.

---

# 14. Acceptance Criteria

Cursor shall certify:

* Repository successfully migrated
* Existing files preserved
* Architecture matches specification
* No duplicate repositories remain
* Plugins relocated successfully (or target locations established if source absent)
* Platform directories created
* No runtime behavior modified
* No feature implementation introduced
* Migration report generated

---

# 15. Deliverables

Cursor shall provide:

1. Repository tree
2. Migration report
3. File movement summary
4. Directory responsibility summary
5. Validation report
6. Certification checklist

---

# 16. Completion Standard

Phase 00 shall not be considered complete until:

* Repository structure matches specification exactly.
* No architectural violations exist.
* Every plugin resides under the appropriate capability category.
* Core platform directories are established.
* Repository governance rules are documented.
* Migration validation passes.
* Certification report is delivered.

---

# 17. Platform Capability Registry (Architect Addition)

Before production modules are written, the **Platform Capability Registry (PCR)** is defined as a core architectural concept.

The PCR is **not implemented in Phase 00**, but it **must be reserved** in the architecture:

```text
core/
    capability_registry/
```

The Capability Registry becomes the authoritative inventory of everything IMIP can do:

* Registered plugins
* Registered hardware capabilities
* Supported mining algorithms
* Available miners
* AI models
* Decision capabilities
* Telemetry providers

The Decision Engine never scans folders or hardcodes knowledge — it queries the Capability Registry.
