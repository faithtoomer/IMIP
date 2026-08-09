# ADR-0025: Institutional CPU Mining Framework & CPU Performance Digital Twin

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 25  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP needs a reusable CPU execution layer for future coin plugins without embedding a coin, a real mining algorithm, a named backend, or a competing CPU-resource ledger. CPU identity and capabilities are source-owned by IHIS; CPU-thread availability and reservations are owned by IRIA; thermal, power, and certification state are owned by ITIA, IPIA, and IHCA. IMAF already owns the backend adapter contract and adapter lifecycle machinery.

Embedding these source concerns into a CPU framework would duplicate state, violate authority isolation, and permit ungoverned consumption of CPU capacity. A CPU mining framework must therefore add only the CPU-mining-specific coordination and read intelligence that no existing authority owns.

## Decision

- Implement ICMF at `core/cpu_mining_framework/`, orchestrated by `CpuMiningFramework.ts`.
- Define a coin- and algorithm-agnostic `CpuAlgorithmProfile` registry with instruction-set, memory, and thread-characteristic compatibility. Include only a clearly marked non-production test fixture, never RandomX or another real algorithm.
- Compose a CPU mining session from injected IHIS-, IRIA-, ITIA-, IPIA-, and IHCA-shaped structural providers, plus an already-selected IMAF `MiningAdapter` contract.
- Implement deterministic affinity, core/logical-processor, SMT, and NUMA placement plans exclusively from an IRIA-supplied thread grant.
- Record session lifecycle, performance history, advisory optimization telemetry, reporting-only safety conditions, explainability, and append-only CPU Performance Digital Twin records.
- Publish the eight CPU mining events under additive `cpu-mining` EventCategory and reserve `cpu-mining-performance` / `cpu-mining-digital-twin` Data Domains.

## CPU Profile as a Composed View, Not a New Source of Truth

- `CpuProfileComposer` reads current snapshots from injected providers every time a profile is requested. It stores no raw discovery, capacity, power, thermal, or certification profile and intentionally has no cache.
- IHIS remains the owner of CPU UUID, architecture, core/thread count, instruction flags, cache, and NUMA topology. IRIA owns available/allocated-thread state and utilization. ITIA owns thermal state; IPIA owns power state; IHCA owns certification status.
- The composed `CpuProfile` is a defensive read snapshot for compatibility, placement, performance, and explanation. It cannot update an upstream source and is not a substitute registry.

## Resource Allocation Comes from IRIA, Never Duplicated

- ICMF requests a structural `CpuThreadAllocationRequest` from injected `CpuResourceProvider` and receives a `CpuThreadGrant`. It releases that grant through the same provider when the session ends or fails.
- ICMF owns no availability counter, reservation ledger, allocation state, or self-granting operation. `ThreadManagement` accepts an existing grant and can only select `grantedThreadIds` for affinity/NUMA placement.
- A compatible algorithm or recommended thread count never constitutes resource authorization. IRIA remains the source of truth for `cpu`, `cpu-core`, and `cpu-pool` capacity.

## IMAF Adapter-Contract Composition

- ICMF imports only erased TypeScript contract types from IMAF: `MiningAdapter`, `AdapterManifest`, `NormalizedStatistics`, `NormalizedError`, `CapabilityNegotiationRequest`, and `CapabilityNegotiationResult` where useful to express boundaries.
- ICMF neither imports/instantiates `MiningAdapterFramework` nor recreates its registry, capability negotiation, translator, statistics normalizer, error classifier, secret provider, backend configuration, or adapter lifecycle audit trail.
- A composition root supplies an adapter already selected/configured/prepared through IMAF. ICMF calls the adapter's existing `start`, `stop`, `statistics`, and `health` controls while owning only the CPU mining-session lifecycle that surrounds those calls.

## Safety and Optimization Are Advisory

- Safety conditions are detections published as events: temperature, power, contention, hardware health degradation, miner crash, pool failure, and invalid configuration. ICMF does not throttle, restart, alter allocation, or change policy.
- Optimization outputs are recommendations only. Applying a thread, affinity, NUMA, performance-mode, power, thermal, security, or policy change requires the appropriate owner outside ICMF.

## Boundaries

- ICMF does **not** discover or inventory hardware, monitor health independently, allocate capacity itself, enforce power/thermal policy, certify hardware, store secrets, authorize mining, schedule workload, or implement a coin plugin.
- ICMF does **not** import or instantiate Hardware, Resource, Power, Thermal, Health, Security, Certification, Arbitration, Benchmark, Workload, or Scheduling Authority implementation classes.
- ICMF does **not** implement a mining backend contract; it consumes IMAF's published `MiningAdapter` interface through injection.
- Dependencies cross only through Event Bus publication, exported structural contracts, and injected providers.

## Consequences

- Future coin plugins can use common CPU placement, telemetry, safety reporting, and historical performance behavior without contaminating Program IV core with coin intelligence.
- CPU capacity remains institutionally governed because even a session's thread placement begins with IRIA's external grant.
- CPU Profile and Digital Twin outputs remain fresh descriptive views and training records, not replacement authority databases.
- IMAF continues to be the single backend-integration boundary; composition roots must establish adapter configuration/secret context before CPU-session start.
- Deterministic injected providers and clocks make the framework independently testable with no live authority dependency.

## Rejected Alternatives

- **Embed a named CPU algorithm such as RandomX:** Rejected — coin/algorithm behavior belongs to future plugins and adapter integrations.
- **Create an ICMF thread-allocation ledger:** Rejected — duplicates IRIA and risks conflicting resource ownership.
- **Cache or persist raw CPU Profile fields in ICMF:** Rejected — creates a rival source of truth for discovery, availability, thermal, power, or certification state.
- **Throttle/restart automatically on a safety detection:** Rejected — bypasses Power, Thermal, Resource, Security, and Policy ownership.
- **Instantiate or proxy `MiningAdapterFramework` inside ICMF:** Rejected — couples two frameworks and recreates adapter lifecycle ownership rather than consuming the public contract.
- **Treat optimization recommendations as applied tuning:** Rejected — recommendations must not bypass institutional governance.
