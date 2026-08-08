# ADR-0023: Institutional Hardware Certification Authority & Institutional Hardware Trust Model

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 23  
**Deciders:** Architectural Authority (Specification)

## Context

IHIS, IBIA, IHIA, IPIA, ITIA, and related authorities own distinct measurements and operational state about a device: discovery/capabilities, benchmark results, health history, power efficiency, thermal stability, resource utilization, error history, driver compatibility, runtime stability, and uptime. IMIP needs one institutional determination of whether hardware is trustworthy and eligible for production without turning any source authority into an uncertified decision-maker.

Putting certification into Hardware, Benchmark, Health, Power, Thermal, Resource, Workload, Runtime, or Arbitration Authority would collapse source-measurement ownership with an independent institutional decision. Calling those authorities directly would create forbidden implementation coupling and make certification non-reproducible in isolation.

## Decision

- Implement IHCA at `core/certification_authority/`, orchestrated by `CertificationAuthority.ts`.
- Make **evidence provider, not evidence owner** the central boundary: IHCA consumes small injected structural interfaces and owns only immutable certification snapshots, policies, decisions, registry/history, lifecycle audit, reports, explainability, and IHTM.
- Maintain an IHCA-owned Certification Registry containing certification UUID, hardware UUID, device type, level, status, dates, evidence references, auditor version, notes, decisions, advisory recertification due date, and revocation history.
- Preserve immutable, append-only evidence attachments: an attached evidence ID cannot be changed or replaced; new observations require new evidence IDs.
- Implement configurable, pluggable level policies with a `CertificationPolicy` interface and `PolicyRegistry` for Experimental, Development, Qualified, Production, and Mission Critical eligibility.
- Implement the guarded lifecycle Discovered → Evaluated → Qualified → Certified → Production Approved → Recertified → Revoked. Permit revocation from Certified, Production Approved, and Recertified when operational evidence degrades. Treat denial/expiration as status and audit conditions, not extra lifecycle stages.
- Publish CertificationStarted, CertificationPassed, CertificationFailed, CertificationRevoked, RecertificationRequired, and CertificationExpired under an additive `certification` EventCategory; reserve `certification-registry` and `certification-history` Data Authority domains.
- Implement IHTM as an IHCA-owned, read-only composed model of Hardware Trust Score and Certification Confidence. It is queryable by future consumers and is not an allocation, workload, runtime, or autonomous control loop.

## Formal Evidence-Provider / Not-Evidence-Owner Boundary

- **Source authorities retain their state.** IHIS owns inventory/discovery/capability state; IBIA owns benchmark workflow/intelligence; IHIA owns health; IPIA owns power; ITIA owns thermal; IRIA owns resource state/allocation. IHCA does not duplicate any of those registries or their raw measurement stores.
- **IHCA receives observations, never authority implementations.** `BenchmarkEvidenceProvider`, `HealthEvidenceProvider`, `PowerEvidenceProvider`, `ThermalEvidenceProvider`, `HardwareCapabilityProvider`, and related provider contracts return authority-neutral evidence shapes. A composition root may adapt published source views to those contracts.
- **IHCA snapshots evidence only at decision time.** The frozen snapshot is certification audit evidence—not a claim to own or mutate the upstream observation. Fresh observations are appended as new evidence IDs for later recertification.
- **IHCA decides independently.** It evaluates supplied evidence against its own configured policy and returns a deterministic certification level/status/rationale. No source authority can silently grant certification through a provider response.
- **Downstream authorities consume, not own, certification.** Decision Intelligence, Workload Intelligence, and Resource Arbitration may query IHTM or an IHCA certification record in a future composition root. IHCA never calls them, and they cannot alter IHCA policy or certification history.

## Boundaries

- IHCA does **not** discover, register, inventory, configure, or change hardware.
- IHCA does **not** execute, validate, store, or compare benchmarks.
- IHCA does **not** monitor health, read sensors, set power/thermal budgets, or remediate hardware.
- IHCA does **not** allocate or reserve resources; production approval is a certification state, never an allocation.
- IHCA does **not** schedule workloads, manage runtime lifecycle, mine, or make downstream workload/decision selections.
- IHCA does **not** create a recertification schedule or timer; it only records an advisory due date and publishes an event when an external caller reports it due.
- Direct authority-to-authority calls are prohibited. Dependencies cross boundaries only through provider contracts, Event Bus events, or published interfaces.

## Consequences

- IMIP gains one auditable and explainable certification decision surface while evidence producers retain their certified responsibilities.
- IHCA can be exercised entirely with deterministic fake providers, giving a strong no-direct-import boundary test.
- Recertification has a durable due-date record without smuggling a Scheduler or Runtime dependency into IHCA.
- IHTM gives future decision, workload, and arbitration consumers a confidence-aware trust view without assigning them ownership of certification.
- The `certification` EventCategory and certification Data Domains keep institutional history distinct from raw hardware, health, benchmark, and resource state.

## Rejected Alternatives

- **Let Hardware Authority certify its discovered devices:** Rejected — discovery/inventory ownership is not independent readiness certification.
- **Let Benchmark or Health results automatically certify hardware:** Rejected — a single source observation cannot replace a policy-governed multi-evidence decision.
- **Import and invoke source authority classes:** Rejected — violates authority isolation, creates compile-time coupling, and prevents independent deterministic testing.
- **Keep mutable evidence on the certification record:** Rejected — would make historical decisions unverifiable and permit after-the-fact alteration.
- **Use hard-coded level branching in one decision method:** Rejected — blocks policy replacement and obscures institutional threshold governance.
- **Let IHTM trigger allocation, workload placement, or revocation autonomously:** Rejected — IHTM is a composed, read-only certification model; downstream action remains a separate authority responsibility.
