# ADR-0002: Platform Capability Registry (PCR)

**Status:** Accepted (Reserved)  
**Date:** 2026-08-07  
**Phase:** 00  
**Deciders:** Architectural Authority (Specification)

## Context

Enterprise platforms discover and compose capabilities dynamically. If the Decision Engine scans folders or hardcodes plugin knowledge, IMIP becomes brittle and couples core logic to every new coin, miner, or hardware type.

## Decision

Reserve `core/capability_registry/` as the Platform Capability Registry (PCR).

The PCR is the authoritative inventory of:

- Registered plugins
- Registered hardware capabilities
- Supported mining algorithms
- Available miners
- AI models
- Decision capabilities
- Telemetry providers

The Decision Engine queries the PCR. It never scans folders and never hardcodes plugin knowledge.

## Phase 00 Scope

- Directory reserved: `core/capability_registry/`
- Implementation deferred to a future approved specification
- No production module written in Phase 00

## Consequences

- Adding a new coin, miner, or hardware type becomes a registration exercise.
- Core remains stable while plugins expand.
- Plugin manifests feed the registry; directory names are not authoritative.
