# IMIP Repository Governance

**Version:** 1.0  
**Phase:** 00  
**Status:** Binding  
**Authority:** Institutional Engineering Specification PHASE-00

---

## 1. Purpose

This document establishes permanent repository governance rules for the Institutional Mining Intelligence Platform (IMIP). Every future phase depends on these rules. They may not be altered without architectural approval.

---

## 2. Architectural Authorities

| Role | Authority |
|------|-----------|
| Architectural Authority | Specifications only (`specs/`) |
| Implementation Authority | Cursor, executing approved specifications |
| Governance Documents | `architecture/` |

Cursor may implement **only** documents present under `specs/` that are marked approved for implementation.

---

## 3. Repository Laws

### Cursor SHALL

- Preserve every existing file during structural migrations.
- Preserve Git history where possible.
- Move directories rather than recreate them.
- Remove obsolete duplicate directories after successful migration.
- Produce a migration summary for structural changes.
- Place platform logic exclusively under `core/`.
- Place mining implementations exclusively under `plugins/`.
- Discover plugins exclusively through manifests (when implemented).
- Keep institutional services unique (no duplicates).

### Cursor SHALL NOT

- Implement features outside an approved specification.
- Create placeholder implementations.
- Introduce TODOs as substitutes for specification work.
- Modify runtime logic during structural phases.
- Rename architecture without approval.
- Hardcode plugin knowledge into the platform.
- Place institutional capabilities inside plugin directories.
- Place coin or miner logic inside `core/`.
- Introduce additional top-level folders without architectural approval.

---

## 4. Ownership Boundaries

### Core Platform Ownership

The Core Platform owns every institutional capability, including but not limited to:

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
- Platform Capability Registry (PCR)
- Policy Engine (reserved)

These capabilities shall never exist inside plugin directories.

### Plugin Ownership

Plugins own only implementation-specific functionality.

**Example — Monero Plugin owns:**

- XMRig Adapter
- RandomX configuration
- Monero statistics parser
- Monero capability registration
- Monero benchmarking

**Monero Plugin does NOT own:**

- Configuration Authority
- Scheduler
- Database
- Profitability calculations
- Logging framework
- Dashboard
- Decision Engine

The same rule applies to every plugin.

---

## 5. Plugin Architecture Laws

1. Plugins are institutional extensions.
2. Plugins shall never become applications.
3. Every plugin must implement the approved plugin contract.
4. The platform discovers plugins dynamically.
5. The platform never hardcodes plugin knowledge.
6. The platform discovers plugins exclusively through manifests.
7. The platform shall never infer functionality from directory names.

---

## 6. Capability Classification

Plugins are categorized by capability class under `plugins/`:

| Class | Path | Example |
|-------|------|---------|
| CPU | `plugins/cpu/` | `plugins/cpu/monero/` |
| GPU | `plugins/gpu/` | `plugins/gpu/flux/` |
| ASIC | `plugins/asic/` | — |

Future classes (for example `fpga/`, `cloud/`) may be added under `plugins/` without redesigning the repository.

---

## 7. Institutional Service Uniqueness

The following are prohibited as duplicates across the repository:

- Duplicate configuration
- Duplicate telemetry
- Duplicate logging
- Duplicate profitability
- Duplicate scheduling
- Duplicate health monitoring
- Duplicate event systems
- Duplicate database access

All institutional services exist exactly once, under Core ownership.

---

## 8. Platform Capability Registry (PCR)

`core/capability_registry/` is reserved as an architectural component.

The PCR is the authoritative inventory of everything IMIP can do:

- Registered plugins
- Registered hardware capabilities
- Supported mining algorithms
- Available miners
- AI models
- Decision capabilities
- Telemetry providers

The Decision Engine never scans folders or hardcodes knowledge — it queries the Capability Registry.

**Phase 00 status:** Reserved only. Not implemented.

---

## 9. Top-Level Directory Freeze

Approved top-level directories:

```text
architecture/
specs/
core/
plugins/
dashboard/
api/
database/
scripts/
tools/
tests/
docs/
.cursor/
```

No additional top-level folders may be introduced without architectural approval.

---

## 10. Expansion Principle

The repository architecture shall remain stable regardless of how many mining engines, coins, workstations, or capability classes are added. Adding a new coin, miner, or hardware type is a registration and plugin exercise — not a core architectural change.

---

## 11. Runtime Architecture (Phase 01)

`architecture/RUNTIME_ARCHITECTURE.md` is binding, alongside this document. It establishes the runtime topology, runtime layers, runtime lifecycle, dependency laws, event bus model, decision pipeline, explainability pipeline, runtime state machine, and AI integration boundaries. No authority, plugin, or interface may bypass it.

`core/policy_engine/` is reserved for the Policy Authority. Every decision in the Decision Pipeline is evaluated against policy before execution. See ADR-0004.
