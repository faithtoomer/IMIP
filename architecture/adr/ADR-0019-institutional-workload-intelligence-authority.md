# ADR-0019: Institutional Workload Intelligence Authority & Workload Digital Twin

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 19  
**Deciders:** Architectural Authority (Specification)

## Context

PHASE-18 established IRIA as the authoritative registry and governor of allocatable computational resources. A workload is different: it represents what IMIP is doing, carries lifecycle and dependency state, and needs operational intelligence without becoming a second resource registry, allocator, scheduler, mining strategist, or profitability engine.

PHASE-19 introduces IWIA as the sole authority for workload registry, classification, lifecycle, priority, history, dependency state, advisory workload placement recommendations, forecasts, events, and explainability. It must use resource intelligence without importing or instantiating another authority directly.

## Decision

- Implement IWIA at `core/workload_authority/` orchestrated by `WorkloadAuthority.ts`.
- Maintain an authoritative `WorkloadRegistry` keyed by workload UUID. Profiles include workload type, owner, state, assigned-resource references, runtime state, estimated duration, priority, dependencies, power/thermal profiles, and historical performance.
- Enforce the nine-state lifecycle: Created → Validated → Queued → Assigned → Running → Paused → Completed or Failed → Archived. Cancellation is an audited transition from a non-terminal lifecycle state to Archived, retaining `cancelled` as its outcome rather than adding a tenth lifecycle state.
- Consume IRIA's existing resource-candidate ranking only through the injectable `ResourceCandidateProvider` contract. The composition root may adapt IRIA's `rankCandidatesForWorkload` to this contract; IWIA neither imports IRIA nor reimplements its health, capacity, power, thermal, or resource scoring logic.
- Keep placement recommendations advisory. IWIA reports `place-now`, `queue`, or `defer`, informed by workload state, dependencies, priority, and provider-ranked candidates. It does not schedule, reserve, allocate, or activate resources.
- Record externally confirmed resource associations only as workload assignment evidence. Resource ownership, reservation, allocation, and capacity remain IRIA responsibilities.
- Implement an Institutional Workload Digital Twin (IWDT) as a continuously refreshed workload read model of resource usage, thermal impact, power consumption, runtime efficiency, historical performance, predicted completion, and bottlenecks.
- Publish the Phase 19 event set through an interim `WorkloadEventBus`, preserving the established authority event pattern until the institutional Event Bus is wired.
- Record lifecycle, priority, assignment, forecast, and telemetry decisions in append-only workload history and audit trails.

## Boundaries

- IWIA does **not** discover or model hardware inventory.
- IWIA does **not** own resources, resource availability, reservation, allocation, capacity, or resource-side candidate scoring.
- IWIA does **not** schedule workloads or make mining decisions; the Scheduler and Mining Authorities retain those decisions.
- IWIA does **not** calculate profitability or execute work.
- Direct authority-to-authority calls are prohibited. Dependencies cross the authority boundary only through the provider contract, events, or approved contracts.
- `core/power_authority`'s `WorkloadTelemetry` remains a power-sample annotation and is unrelated to IWIA's workload registry or lifecycle ownership.

## Consequences

- Workload lifecycle state and explainability have one institutional owner, while resources retain one owner in IRIA.
- Production composition must provide a thin adapter to IRIA's candidate-ranking API; IWIA remains testable with null, map, or injectable provider implementations.
- A recommendation identifying a resource is evidence of workload-side suitability only; it does not imply an allocation or authorize execution.
- The IWDT can advise operators and future policy/decision components using measured workload telemetry and history without becoming a control loop.
- Data Authority domains `workload-registry` and `workload-history` reserve governed persistence destinations for IWIA state and history.

## Rejected Alternatives

- **Embedding resource placement scoring in IWIA:** Rejected — duplicates IRIA's authoritative scoring and violates resource ownership.
- **Calling `ResourceAuthority` directly:** Rejected — creates compile-time authority coupling and bypasses approved contracts.
- **Giving IWIA scheduler or allocator methods:** Rejected — workload governance must not collapse scheduling and resource-allocation boundaries.
- **Adding `cancelled` as a lifecycle state:** Rejected — the approved lifecycle contains nine states; cancellation is an outcome and audited archival path.
