# ADR-0024: Institutional Mining Adapter Framework & Mining Backend Registry

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 24  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP needs to communicate with heterogeneous external mining implementations without allowing a backend's configuration syntax, process model, statistics, failure vocabulary, or coin-specific behavior to escape into institutional core. The existing plugin architecture reserves discovery/validation to a future Plugin Registry Authority, capability registration to a future Capability Registry, and activation/authorization to a future Mining Authority. None exists in Phase 24.

Putting a named miner or algorithm in the core would couple all IMIP authorities to one backend and force platform redesign when miners, protocols, operating systems, or hardware evolve. Calling Hardware, Resource, Security, Power, Thermal, Health, Benchmark, Arbitration, Certification, Workload, or Scheduling authorities directly would also violate authority isolation.

## Decision

- Implement IMAF at `core/mining_adapter_framework/`, orchestrated by `MiningAdapterFramework.ts`.
- Make the `MiningAdapter` contract the sole boundary for backend-specific behavior: identity, validation, configuration, preparation, lifecycle control, health, statistics, capability declaration, diagnostics, and cleanup.
- Maintain an IMAF-owned Mining Backend Registry of explicitly supplied adapter manifests/capabilities keyed by Adapter ID and queryable by algorithm, OS, hardware, and protocol. This registry is not plugin discovery, manifest validation, or capability-registry state.
- Negotiate compatibility deterministically across OS, hardware, algorithm, pool protocol, required statistics, required controls, supplied required capabilities, and minimum framework version.
- Use per-adapter pluggable translators, statistics normalizers, and error classifiers. IMAF orchestrates these functions; adapters own backend syntax and backend-specific mapping.
- Model the guarded nominal lifecycle Discovered → Registered → Validated → Configured → Prepared → Started → Running → Stopping → Stopped → Retired, with explicit `Failed` and `Rejected` exception states.
- Define complete adapter-neutral process descriptor types but do not spawn a real process in IMAF.
- Consume only an injected ISTA-shaped `SecretProvider`; reject raw credential fields and redact returned diagnostics.
- Track a lightweight, explainable adapter-certification level distinct from IHCA's hardware certification.
- Publish the eleven specified events under the additive `mining-adapter` EventCategory and reserve `mining-adapter-registry` / `mining-adapter-history` Data Domains.

## Why the Adapter Is the Boundary

- **Backend internals stay outside IMIP core.** An adapter encapsulates its configuration grammar, executable/process model, status format, diagnostics, backend error signatures, and future miner-specific logic. IMIP core sees only structural institutional contracts.
- **The boundary is replaceable.** A future plugin can implement the same interface for an unanticipated miner, OS, hardware class, or protocol without changing `MiningAdapterFramework` or another authority.
- **The boundary is testable.** Two deliberately generic test fixtures with different raw statistics shapes pass through one contract end to end, proving IMAF does not assume a backend shape.
- **The boundary preserves future ownership.** Future Plugin Registry/Capability Registry can consume IMAF's exported manifest/capability shapes; a future Mining Authority can authorize activation. Neither responsibility is preempted by IMAF.

## No Coin Logic in Core

IMAF contains no implementation of a mining algorithm, coin, wallet convention, named real miner, executable assumption, or protocol-specific mining behavior. `algorithm` and `protocol` are opaque identifiers declared by an adapter manifest and caller negotiation request. Backend translation and classification functions are registered per adapter. This keeps Program V coin/plugin behavior outside Program IV institutional core.

## Formal Authority Boundary Resolution

- **IHIS discovers; IMAF negotiates adapter compatibility.** IMAF accepts a structural hardware shape supplied by a composition root and never imports/updates hardware inventory or raw device records.
- **IRIA allocates; IMAF never requests capacity.** A compatible adapter does not mean hardware is allocated or available.
- **ISTA owns secrets; IMAF only receives an injected provider.** IMAF cannot store secrets, use a vault, import `SecurityAuthority`, or return unredacted diagnostics.
- **Future Mining Authority activates; IMAF orchestrates a supplied contract.** IMAF makes no authorization, workload, scheduling, profitability, or coin-selection decision.
- **Future Plugin Registry Authority discovers/validates; IMAF registers an explicitly supplied adapter object.** No scanning, manifest parsing, plugin installation, or Capability Registry state is implemented.
- **Direct authority calls are prohibited.** Dependencies cross only as Event Bus events, exported interfaces, or injected structural provider contracts.

## Boundaries

- IMAF does **not** mine, implement coin/algorithm logic, or hard-code a real miner.
- IMAF does **not** perform hardware discovery, resource allocation, scheduling, health/power/thermal monitoring, benchmarking, arbitration, hardware certification, workload governance, or secret storage.
- IMAF does **not** create a Plugin Registry Authority, Mining Authority, Capability Registry implementation, plugin manifest validator, or a process execution engine.
- IMAF does **not** persist its registry through Data Authority in Phase 24; reserved data domains are only governance vocabulary.
- `MockCpuAdapter` and `MockGpuAdapter` are test fixtures, never production miner integrations.

## Consequences

- IMIP gains a stable integration surface for future mining software without backend lock-in.
- A composition root or future Mining Authority must deliberately provide adapters, secret-provider access, and authority-derived hardware/resource context.
- Compatibility and failure classification are reproducible and explainable; actual external-process outcomes remain appropriately outside deterministic core logic.
- Security handling is enforceable at the framework boundary: institutional config contains only references and diagnostics cannot expose sensitive fields.
- A future Plugin Registry/Capability Registry can consume existing exported surfaces instead of requiring an IMAF rewrite.

## Rejected Alternatives

- **Hard-code a popular miner in IMAF:** Rejected — turns core into a backend integration and violates backend independence.
- **Implement coin algorithms in the framework:** Rejected — Program V plugin responsibility would leak into institutional core.
- **Have IMAF scan plugins or validate manifests:** Rejected — explicitly owned by the future Plugin Registry Authority.
- **Have IMAF call Hardware/Resource/Security authorities directly:** Rejected — violates authority isolation and makes tests/integration coupling fragile.
- **Let IMAF store wallet/pool credentials:** Rejected — ISTA is the institutional secret owner; config uses references and adapters receive only an injected provider.
- **Spawn OS processes in framework core:** Rejected — adapters must own backend/process integration; Phase 24 defines only the portable process abstraction.
- **Treat failures as untyped thrown errors outside lifecycle:** Rejected — explicit Failed/Rejected states preserve explainability and auditability.
