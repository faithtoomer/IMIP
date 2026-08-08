# Capability Registry Specification

**Status:** Reserved — Not Implemented (Phase 01)  
**Location:** `core/capability_registry/`  
**Authority:** PHASE-01 §9 / ADR-0002 / `architecture/RUNTIME_ARCHITECTURE.md` §6 (Capability Layer)

## Purpose

The Platform Capability Registry (PCR) is the sole discovery mechanism for the entire platform. Runtime Layer 4 (Capability Layer) consumes it exclusively; nothing scans directories or hardcodes plugin/hardware/algorithm knowledge.

## Owned Data

| Category | Description |
|----------|--------------|
| Registered Authorities | Every active institutional authority and its interface surface |
| Registered Plugins | Every discovered, manifest-validated plugin |
| Registered Hardware | Hardware inventory reported by the Hardware Authority |
| Supported Algorithms | Mining algorithms supported by registered plugins |
| Supported Mining Software | Miner backends supported by registered plugins |
| AI Models | Registered machine learning models available to the Decision Layer |
| Decision Policies | Policy references evaluated by the Decision Pipeline |
| Capability Metadata | Manifest-derived metadata for every registered capability |

## Architectural Rules

1. The Decision Engine never scans folders or hardcodes knowledge — it queries the Capability Registry.
2. The Plugin Manager registers plugins into the PCR only after manifest validation (`PLUGIN_MANIFEST_STANDARD.md`).
3. Directory names and file layout are never authoritative; only registered, manifest-derived data is authoritative.
4. The PCR is queried through an interface — no authority or plugin accesses its internal state directly.

## Consumers

Decision Intelligence Authority, Plugin Registry Authority, Mining Authority, and the Machine Learning Authority (future) consume the PCR through approved interfaces only.

## Phase 01 Constraint

This directory remains reserved only, as established in Phase 00 (ADR-0002).

- No production module is written here in Phase 01.
- No placeholder implementation is introduced.
- Future implementation requires an approved specification under `specs/`.
