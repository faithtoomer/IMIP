# ADR-0022: Institutional Resource Arbitration Authority & Institutional Arbitration Knowledge Base

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 22  
**Deciders:** Architectural Authority (Specification)

## Context

IRIA (Phase 18) is certified as the owner of resource profiles, the Resource Registry, availability, reservations, allocation execution, ownership/leasing, utilization, and the Institutional Resource Digital Twin. Its current `requestAllocation()` path processes incoming requests independently, but it has no institutional multi-request contention/arbitration layer.

IMIP needs one accountable and explainable mechanism to determine which competing request should be submitted to IRIA first or at all. Adding that mechanism inside IRIA would blur registry/allocation ownership with cross-request policy governance; implementing it by calling IRIA directly would violate authority isolation.

## Decision

- Implement IRAA at `core/arbitration_authority/`, orchestrated by `ArbitrationAuthority.ts`.
- Maintain an IRAA-owned Arbitration Registry and guarded seven-stage lifecycle: Request Received → Contention Detected → Policy Evaluation → Constraint Evaluation → Winner Selected → Decision Published → History Archived.
- Define an IRAA-owned, allocation-shaped `ArbitrationRequest`, structurally equivalent to the relevant IRIA request fields without importing IRIA types.
- Evaluate availability, health, thermal, power, runtime, reservation, priority, fairness, and externally supplied policy evidence through small injected provider interfaces. Direct authority imports and instantiation are prohibited.
- Implement the eight named policies through an extensible `Policy` interface and `PolicyRegistry`, rather than a decision-specific if/else chain.
- Guarantee determinism: the same requests, provider data, policy registry, historical fairness state, and injected time create the same output. Exact score ties resolve lexicographically by `requestId`; AI evidence is advisory-only and has no score effect.
- Track queue wait time via an injected clock, detect starvation, priority inversion, resource monopolization, and queue imbalance, and publish evidence events.
- Publish the eight Phase 22 events under the new `arbitration` EventCategory and reserve `arbitration-registry` and `arbitration-history` Data Authority domains.
- Record outcomes, policy use, fairness metrics, and contention patterns in the descriptive IAKB.

## Formal IRIA Boundary Resolution: Decision vs. Allocation

- **IRIA allocates; IRAA decides.** IRIA remains the sole owner of Resource Registry state, allocation/reservation execution, and all resulting capacity/ownership transitions. IRAA owns only the decision over competing allocation-shaped requests.
- **IRAA never invokes IRIA.** There is no import or instantiation of `ResourceAuthority`; IRAA never calls `requestAllocation()`, `allocate()`, `selectCandidate()`, `reserve()`, `register()`, or a registry API.
- **A composition root bridges the two deliberately.** After receiving a winning `ArbitrationDecision`, an external caller may submit that separate request to IRIA. The decision contains `allocationSubmitted: false` to make this handoff explicit.
- **IRAA does not duplicate the Resource Registry.** Provider-returned availability/health/constraint information is read-only source evidence. The Arbitration Registry records decisions and lifecycle evidence, not resource state.
- **`ResourceGranted` is selection language only.** The event means an arbitration winner is approved for external IRIA submission; it is never confirmation that resource allocation occurred.

## Boundaries

- IRAA does **not** own resource identity, availability calculations, reservation state, capacity, allocation, ownership, or leasing.
- IRAA does **not** schedule workloads, decide mining operations, or manage runtime state.
- IRAA does **not** own health scoring, power budgets, thermal monitoring, or security enforcement; it evaluates injected published constraint evidence only.
- IAKB is institutional history and advisory bottleneck evidence, not an automated control loop.
- Direct authority-to-authority calls are prohibited. Dependencies cross boundaries only through provider contracts, Event Bus events, or published interfaces.

## Consequences

- IRIA stays certified and untouched while IMIP gains an explicit policy/fairness layer for competing requests.
- A composition root must supply providers and deliberately submit selected requests to IRIA; this is a visible responsibility rather than hidden inter-authority behavior.
- Decisions are reproducible and auditable, including failed lifecycle stage, exact policy results, constraints, and stable tie-breaking.
- Starvation conditions become observable institutional events and fair-share relief is testable with a simulated clock.
- IAKB can identify bottlenecks without altering decision ownership or allocation execution.

## Rejected Alternatives

- **Put contention resolution inside `ResourceAuthority.requestAllocation()`:** Rejected — combines allocation/registry ownership with cross-request policy governance and changes certified Phase 18 behavior.
- **Have IRAA call `requestAllocation()` after choosing a winner:** Rejected — IRAA would become a hidden allocator and create a direct authority dependency.
- **Import IRIA `AllocationRequest` directly:** Rejected — creates compile-time coupling; an IRAA-owned structural request preserves independent deployment and testing.
- **Use random or wall-clock tie-breaking:** Rejected — violates Law 4 and makes institutional decisions unreproducible.
- **Allow AI recommendations to influence selection:** Rejected — future AI remains advisory-only and cannot control allocation arbitration.
- **Use IAKB as an autonomous policy controller:** Rejected — it is historical/advisory evidence, not a second decision or allocation authority.
