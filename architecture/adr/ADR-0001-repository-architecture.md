# ADR-0001: Institutional Repository Architecture

**Status:** Accepted  
**Date:** 2026-08-07  
**Phase:** 00  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP must support unlimited expansion across mining engines, coins, hardware classes, workstations, fleet management, and AI optimization without structural redesign. A transitional layout of independent engines (`Monero_Engine`, `Flux_Engine`) cannot scale as an institutional platform.

## Decision

Adopt a permanent top-level repository architecture:

```text
architecture/  specs/  core/  plugins/  dashboard/  api/
database/  scripts/  tools/  tests/  docs/  .cursor/
```

Plugins are organized by capability class (`cpu/`, `gpu/`, `asic/`) and never become applications. Core owns all institutional services. No additional top-level folders may be introduced without architectural approval.

## Consequences

- Future engines are added as plugins under the appropriate capability class.
- Platform logic remains centralized and unique.
- Structural redesign is not required to add coins, miners, or hardware types.
- Migration relocates engines without modifying runtime behavior.
