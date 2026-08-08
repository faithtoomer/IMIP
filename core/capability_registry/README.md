# Platform Capability Registry (PCR)

**Status:** RESERVED — Not Implemented (Phase 00)  
**Location:** `core/capability_registry/`  
**Authority:** PHASE-00 §17 / ADR-0002

## Purpose

The Platform Capability Registry is the authoritative inventory of everything IMIP can do:

- Registered plugins
- Registered hardware capabilities
- Supported mining algorithms
- Available miners
- AI models
- Decision capabilities
- Telemetry providers

## Architectural Rule

The Decision Engine never scans folders or hardcodes knowledge.

The Decision Engine queries the Capability Registry.

## Phase 00 Constraint

This directory is reserved only.

- No production module is written here in Phase 00.
- No placeholder implementation is introduced.
- Future implementation requires an approved specification under `specs/`.
