# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 31

# Institutional Mining Plugin Certification Authority (IMPCA)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Classification:** Institutional Authority

> IMPCA is the authoritative source of evidence-based trust decisions for mining plugins/software. It is a new, standalone authority and is not a hardware-certification component.

---

# 1. Mission Statement

The Institutional Mining Plugin Certification Authority (IMPCA) establishes whether a concrete plugin UUID and version has supplied sufficient independently produced validation and test evidence to be trusted. It owns certification decisions only. It neither discovers plugins, inventories platform capabilities, loads plugins, nor controls mining workloads.

# 2. Architectural Position and Certification Pipeline

```text
Plugin Created
  → Static Validation → Dependency Validation → Security Validation
  → Functional Testing → Compatibility Testing → Performance Testing → Runtime Testing
  → IMPCA Certification Decision
  → [downstream] Plugin Registry / Capability Registry
  → [downstream] Plugin Runtime
```

IMPCA owns and executes every stage through **Certification Decision**. Pipeline providers are injected contracts; every stage calls its provider, creates immutable evidence, and stops immediately at the first failure. The later Plugin Registry and Plugin Runtime stages are downstream consumers, not services IMPCA implements or calls.

# 3. Relationship to IHCA / IMPR / Capability Registry (ICR)

**IHCA:** IMPCA is a self-contained new authority for plugin/software trust, distinct in name, scope, data, lifecycle, evidence, and source module from IHCA, which certifies hardware. IMPCA does not import, subclass, modify, or extend IHCA.

**IMPR:** `getCertificationStatus({ pluginUuid, version, manifest? })` returns exactly `{ certified: boolean; level: string; reason: string }`. This is intentionally structurally compatible with Phase 30 IMPR's `PluginCertificationStatusProvider` / `CertificationStatus` seam, enabling a future composition root to inject an adapter around IMPCA with no direct code coupling or import between the authorities.

**Capability Registry / ICR:** ICR is confirmed unimplemented and remains a reserved placeholder. The original Cursor Implementation Contract's registry handoff is resolved through an optional injected `CapabilityRegistrationNotifier`. IMPCA calls it only after a successful active certification and functions correctly when it is omitted. IMPCA does not create `core/capability_registry/`, build a registry, or treat its own authoritative certification record store as the platform-wide inventory.

# 4. Certification Levels and Deterministic Assignment

Levels are ordered ascending:

1. `Experimental`
2. `Development`
3. `Qualified`
4. `Production`
5. `InstitutionalCritical`

All seven stages must pass before even `Experimental` is possible. Provider evidence contains a deterministic `qualityScore`. All scores at least 60 produce `Development`; 75 produce `Qualified`; 85 with no degraded evidence, including passing Performance and Runtime testing, produces `Production`; and 95 with no degradation plus explicit provider-produced `institutionalCritical: true` evidence produces `InstitutionalCritical`. Any provider evidence carrying `certificationBlocked: true` deterministically fails review. A performance failure produces no certification and therefore cannot reach Production or Institutional Critical. There is no manual level override.

# 5. Lifecycle and Failure Paths

The nominal lifecycle is:

```text
Submitted → Validated → Testing → EvidenceCollected → Reviewed → Certified → Active
```

`Submitted` and `Validated` may become `Rejected`; `Validated`, `Testing`, `EvidenceCollected`, and `Reviewed` may become `Failed`. An active certificate may be `Suspended` or `Revoked`; a suspension may be revoked or enter full recertification. A revoked record can only enter `Recertified`, then `Submitted`, for a fresh full seven-stage run. It cannot reactivate directly. All state changes are guarded and timestamped via an injected clock.

# 6. Evidence and Trust Rules

The append-only evidence ledger deep-clones and deep-freezes every provider output at creation time. An `EvidenceRecord` is timestamped and includes certification ID, plugin/version, stage, type, payload, rationale, pass status, and degradation status. Decisions retain evidence references and are queryable later.

The following are enforced by code and dedicated tests:

- A manifest `selfDeclaredCertificationLevel`, `certificationLevel`, `certified`, or `selfCertified` assertion is rejected. Plugins cannot self-certify.
- `certify()` cannot reach Certified or Active without a populated evidence trail and a completed all-stage pipeline.
- IMPCA has no “successful loading” input, method, or decision rule. Runtime outcomes are not certification.
- A Revoked record always returns `certified: false`; only `recertify()` can perform a complete provider-backed pipeline rerun.
- No stage is a placeholder. Static, dependency, security, functional, compatibility, performance, and runtime evaluation each invoke their injected provider and honor its failure.

# 7. Events, Explainability, and Trust Graph

IMPCA publishes under Event Bus category `mining-plugin-certification`:

1. `PluginCertificationRequested`
2. `PluginCertificationStarted`
3. `PluginCertificationPassed`
4. `PluginCertificationFailed`
5. `PluginCertified`
6. `PluginCertificationSuspended`
7. `PluginCertificationRevoked`
8. `PluginRecertificationRequired`
9. `PluginRecertified`

Explainability reports the plugin/version, stage and level, immutable evidence evaluated, passed and failed tests, lifecycle history, and decision rationale.

The queryable Institutional Plugin Trust Graph copies only IMPCA-held evidence into this lineage:

```text
Plugin → Version → Certification → Dependencies → Adapters → Algorithms
→ Hardware → Runtime → Historical Performance → Security Evidence
```

It provides traceability without querying or owning the linked external entities.

# 8. Boundaries, Data, and Determinism

IMPCA's `PluginCertificationRegistry` is its authoritative certification-decision store, not the future Plugin Registry Authority or Capability Registry. Its logical data domain is `mining-plugin-certification-registry`.

No real authority/framework implementation is imported or instantiated: all integration is through injected pipeline providers, Event Bus, clock, UUID supplier, and optional notifier. Given identical provider outputs, submitted manifest, clock, and UUID supplier, pipeline outcomes, levels, lifecycle records, evidence, and status outputs are deterministic. There are no timers, sleeps, or wall-clock calls in test paths.

# 9. Acceptance and Test Posture

Tests prove ordered stage execution and short-circuiting, no placeholder stage paths, immutable evidence, deterministic multi-level assignment and performance failure behavior, nominal/rejection/failure lifecycle paths, all five “SHALL NOT” rules, all nine events, explainability, graph lineage, IMPR status-shape compatibility, optional notifier behavior with and without injection, determinism, and no direct implementation-authority imports including IHCA.

# 10. Program IV Completion

Phase 31 completes the extended Program IV execution/runtime/trust foundation: Mining Adapter Framework, CPU/GPU/ASIC Mining Frameworks, Miner Process Manager, Mining Statistics Framework, Mining Plugin Runtime, and now IMPCA. Plugin Registry Authority, Mining Authority, and Capability Registry intentionally remain reserved/unbuilt future work.
