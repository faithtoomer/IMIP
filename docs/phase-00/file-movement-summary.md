# Phase 00 — File Movement Summary

**Date:** 2026-08-07  
**Specification:** `specs/PHASE-00-repository-governance.md`

## Preserved Files

| File | Action |
|------|--------|
| `README.md` | Preserved and updated in place to institutional overview |

No files were deleted.

## Directory Moves

| From | To | Method | Result |
|------|----|--------|--------|
| `Monero_Engine/` | `plugins/cpu/monero/` | N/A — source absent | Target directory established |
| `Flux_Engine/` | `plugins/gpu/flux/` | N/A — source absent | Target directory established |

## Newly Created Governance Artifacts

Governance and specification documents created under approved top-level directories only. No runtime modules created.

### Architecture

- `architecture/GOVERNANCE.md`
- `architecture/README.md`
- `architecture/adr/ADR-0001-repository-architecture.md`
- `architecture/adr/ADR-0002-platform-capability-registry.md`
- `architecture/contracts/PLUGIN_CONTRACT.md`
- `architecture/contracts/PLUGIN_MANIFEST_STANDARD.md`
- `architecture/contracts/CAPABILITY_CLASSIFICATION.md`
- `architecture/diagrams/README.md`

### Specifications

- `specs/PHASE-00-repository-governance.md`
- `specs/README.md`

### Structure Markers (responsibility docs / gitkeep)

- Directory README files under `core/`, `plugins/`, `dashboard/`, `api/`, `database/`, `scripts/`, `tools/`, `tests/`, `docs/`, `.cursor/`
- `.gitkeep` under empty test suite directories
- `.cursor/rules/imip-governance.mdc`

### Deliverables

- `docs/phase-00/*` (this report set)

## Runtime / Feature Files

None created. None modified. None deleted.
