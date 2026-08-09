# ADR-0031: Institutional Mining Plugin Certification Authority

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 31  
**Deciders:** Architectural Authority (Specification)

## Context

IMPR Phase 30 has a hard certification-status provider seam but must not implement trust decisions. Mining plugin/software trust consequently needs one bounded authority that can execute validation and testing without becoming plugin discovery, platform inventory, a runtime host, or a hardware certification extension.

## Decision

- Implement `MiningPluginCertificationAuthority` in `core/mining_plugin_certification_authority/` as a standalone IMPCA authority with pipeline, evidence, level assignment, lifecycle, trust, events, explainability, graph, and own certification record store modules.
- Add Event Bus category `mining-plugin-certification` and Data Domain `mining-plugin-certification-registry` additively.
- Expose a structurally IMPR-compatible `getCertificationStatus()` output without importing IMPR's types.
- Use only injected provider interfaces and an optional ICR notifier seam; do not import or instantiate any other authority/framework implementation.

## IMPCA Is a New Standalone Authority, Not an Extension of IHCA

IHCA certifies hardware. IMPCA certifies plugin/software artifacts through seven plugin-specific validation/test stages and maintains plugin/version evidence and lifecycle state. It does not inherit from, call, import, modify, or reuse IHCA's authority types. Similar module layout is only a local style convention.

## Certification Requires Evidence, Never Self-Declared or Inferred from Successful Loading

IMPCA rejects manifest certification claims and has no loading-success input. Each sequential stage must call its supplied provider and append a frozen evidence record. `certify()` only allows Certified/Active after the evidence-backed pipeline completed and deterministic level assignment accepted all required material. Status without evidence is false. IMPR remains a downstream consumer of that status, not an evidence source or bypass.

## No Placeholder Pass Logic in Any Pipeline Stage

Static validation, dependency validation, security validation, functional testing, compatibility testing, performance testing, and runtime testing each use a dedicated injected provider contract. The orchestration records the provider's actual pass/fail output and short-circuits after the first failure. There are no null “pass” providers and no unconditional stage result.

## Revocation Is Permanent Until Full Recertification

A revoked certificate always resolves to `{ certified: false }`. Direct `Revoked → Active` transition is prohibited. `recertify()` transitions through Recertified and a new Submitted state, clears only the active decision references, executes every provider-backed stage again, and must earn a new certification decision before becoming Active. Prior immutable evidence remains in the ledger for audit traceability.

## Optional Capability Registry Handoff

The original implementation contract referenced ICR integration, but the Capability Registry is confirmed unimplemented and reserved. Instead, IMPCA accepts optional `CapabilityRegistrationNotifier`; it is invoked only after a successful active certification and its absence does not change IMPCA correctness. IMPCA's own store is a certification decision record, not the Capability Registry or Plugin Registry Authority.

## Deterministic Trust and Traceability

Level assignment is fixed: complete passing evidence supports Experimental, quality thresholds support Development/Qualified, no-degradation Performance/Runtime evidence supports Production, and high-quality explicit critical evidence supports InstitutionalCritical. The injected clock supplies all timestamps. The Institutional Plugin Trust Graph records `Plugin → Version → Certification → Dependencies → Adapters → Algorithms → Hardware → Runtime → Historical Performance → Security Evidence` strictly from IMPCA-held evidence.

## Consequences

- IMPR can later consume an IMPCA adapter with no implementation dependency.
- Plugin trust has a durable, inspectable authority without prematurely implementing discovery/inventory authorities.
- Revocation cannot be erased by a direct control action.
- Every trust decision has immutable evidentiary provenance and a deterministic rationale.

## Rejected Alternatives

- **Add plugin certification to IHCA:** rejected; software/plugin trust is a separate domain from hardware certification.
- **Trust manifest-declared level or runtime loading success:** rejected; both permit subject self-attestation or a runtime bypass.
- **Allow a revoked record to resume Active:** rejected; it destroys the revocation safety boundary.
- **Default missing providers to pass:** rejected; it is placeholder certification logic.
- **Implement ICR as part of IMPCA:** rejected; the Capability Registry remains reserved and has independent ownership.
