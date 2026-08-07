# Phase 00 — Directory Responsibility Summary

**Date:** 2026-08-07  
**Authority:** PHASE-00 §12 / `architecture/GOVERNANCE.md`

| Directory | Responsibility | Must Contain | Must Never Contain |
|-----------|----------------|--------------|--------------------|
| `architecture/` | Governance, ADRs, contracts, diagrams | Runtime/event/sequence/data-flow diagrams, ADRs, interface contracts, governance | Feature implementation code |
| `specs/` | Institutional Engineering Specifications | Approved phase specifications | Informal notes treated as implementation authority |
| `core/` | Institutional platform logic | Platform services (future), `capability_registry/` reservation | Coin logic, miner logic, plugin adapters |
| `core/capability_registry/` | PCR reservation | Reservation documentation until implemented | Phase 00 production modules |
| `plugins/` | Mining implementations by capability | Capability classes and plugin slots | Platform logic, institutional services |
| `plugins/cpu/` | CPU capability class | CPU plugins (e.g. `monero/`) | GPU/ASIC-specific ownership outside class |
| `plugins/cpu/monero/` | Monero CPU plugin slot | Monero-specific implementation (future) | Config authority, scheduler, DB, profitability, logging framework, dashboard, decision engine |
| `plugins/gpu/` | GPU capability class | GPU plugins (e.g. `flux/`) | Platform services |
| `plugins/gpu/flux/` | Flux GPU plugin slot | Flux-specific implementation (future) | Institutional services |
| `plugins/asic/` | ASIC capability class | Future ASIC plugins | Platform services |
| `dashboard/` | Operations UI | UI surfaces integrating with Core | Mining logic |
| `api/` | External interfaces | Platform-facing APIs | Mining implementation |
| `database/` | Persistence boundary | Schemas/migrations via institutional access (future) | Duplicate plugin-owned DB stacks |
| `scripts/` | Operational scripts | Admin/ops scripts | Embedded platform redesign |
| `tools/` | Developer/platform tooling | Tooling utilities | Core service duplication |
| `tests/` | Test suites | Platform, plugin, integration, stress, certification | Production runtime ownership |
| `docs/` | Documentation and phase reports | Phase deliverables, institutional docs | Alternate architecture authority overriding `specs/` |
| `.cursor/` | Cursor agent governance | Project rules binding future agents | Feature code |

## Ownership Split (Binding)

- **Core owns once:** configuration, decision engine, runtime, scheduler, telemetry, logging, hardware detection, health, profitability, AI, event bus, security, dashboard integration, database access, metrics, explainability, PCR.
- **Plugins own only:** implementation-specific adapters, algorithm/config surfaces, stats parsers, capability registration payloads, benchmarking for that plugin.
