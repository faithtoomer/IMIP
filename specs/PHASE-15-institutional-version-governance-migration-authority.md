# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 15 (Final Phase of Program II)

# Institutional Version Governance & Migration Authority (IVGMA)

**Version:** 1.0
**Status:** APPROVED FOR IMPLEMENTATION
**Implementation Authority:** Cursor
**Architectural Authority:** Institutional Engineering Specification
**Classification:** Core Infrastructure Authority

> Not a "Version & Migration Authority" — those are two different concerns. Versioning is governance: what version is this, is it certified, is it compatible with what depends on it. Migration is controlled evolution: how the platform moves safely from one version to another. IVGMA owns both, as one authority, because a migration is only ever safe insofar as version governance already knows what's compatible with what. See ADR-0018.

---

# 1. Mission Statement

IVGMA is the sole authority for artifact version governance, compatibility management, and migration orchestration across the platform. No authority independently tracks version state, decides compatibility, or executes a migration outside IVGMA's governance.

---

# 2. Mission Objectives

Version registration and certification, cross-artifact-type compatibility tracking, migration planning, migration execution orchestration, rollback orchestration, migration auditing, deprecation lifecycle management, version explainability, a real evolution graph answering lineage/compatibility/upgrade-safety questions, real extension points for artifact types not yet real elsewhere (plugin manifests, capability definitions, policy definitions).

---

# 3. Institutional Laws

1. **Law 1 — Orchestration, Not Reimplementation.** IVGMA never implements the mechanics of a migration or a rollback. Every migration executor wraps an already-real, already-certified authority's own method (ICMS's `reload()`/`rollback()`, IDA's migration-on-read, optionally IBRRA's `requestRecovery()`).
2. **Law 2 — Real, Not Fabricated Version Data.** Every version source reads an already-real, already-versioned field on an already-certified authority (ICMS's `getVersionInfo()`, IDA's `DomainSchema.version`, IEB's `EventDefinition.version`). Artifact types with no real producer yet (plugins, capabilities, policies) are honest, empty extension points, never invented data.
3. **Law 3 — Compatibility Before Migration.** A migration may not proceed past compatibility verification without a recorded, verified-compatible relationship. No record means not verified — fail-closed, never assumed safe.
4. **Law 4 — Migration Is Transactional.** A migration either reaches `certified`, or is rolled back to `rolled-back`, or — when rollback itself genuinely fails — reaches the honest terminal `failed` state. No migration is left partially applied.

---

# 4. Responsibilities

IVGMA owns: the Version Registry, artifact type governance, compatibility relationship tracking, migration planning, migration execution orchestration, rollback orchestration, migration auditing, deprecation/retirement lifecycle, version and migration explainability, the Institutional Evolution Graph. IVGMA does **not** own: schema migration mechanics, configuration snapshot/rollback mechanics, database restore mechanics, runtime lifecycle, mining, business logic, or scheduling policy.

**Reflexive Law 1 compliance**: IVGMA never re-implements the migration/rollback mechanics it orchestrates. Every migration executor wraps an already-real, already-certified authority's own methods — ICMS's `reload()`/`rollback()` (Phase 02), IDA's migration-on-read via `DataMigrationRunner` (Phase 08), and optionally IBRRA's `requestRecovery()` (Phase 14) for database-domain rollback. See ADR-0018 for the full pre-implementation review that established this.

---

# 5. Runtime Architecture

```text
Authorities (ICMS, IDA, IEB, IBRRA)
        │
        ▼
Institutional Version Governance & Migration Authority
        │
        ├──────── Artifact Type Registry
        ├──────── Version Registry
        ├──────── Artifact Compatibility Registry
        ├──────── Migration Registry (immutable)
        ├──────── Version Sources (real, per artifact type)
        ├──────── Migration Executors (real, per artifact type)
        ├──────── Institutional Evolution Graph (§24)
        └──────── Audit Manager
                    │
                    ▼
        Institutional Configuration Authority / Institutional Data Authority
        (+ Event Bus, Resilience Authority, when supplied)
```

---

# 6. Artifact Types & Version Registry

A real, runtime-extensible `ArtifactTypeRegistry` (matching IOLA's/INCA's/IBRRA's category-registry pattern) seeded with 9 default artifact types: `configuration-schema`, `database-schema`, `plugin-manifest`, `plugin-interface`, `capability-definition`, `event-schema`, `runtime-contract`, `api-contract`, `policy-definition`. Three (`configuration-schema`, `database-schema`, `event-schema`) map to real, already-versioned data via `ArtifactVersionSource`s. The rest remain real, honest, zero-producer extension points until their owning authorities exist (ADR-0002/ADR-0014).

The `VersionRegistry` is the authoritative catalog of every governed version, keyed by a real UUID, uniquely identified by `(artifactType, artifactName, semanticVersion)`.

---

# 7. Compatibility

`ArtifactCompatibilityRegistry` tracks real, queryable compatibility relationships between two artifact versions, possibly across artifact types (e.g. "is plugin-manifest 1.0.0 compatible with runtime-contract 3.0.0"). Named distinctly from ICMS's own, narrower `CompatibilityRegistry` (a config-value-level checker registry) to avoid a real naming collision — see ADR-0018. `check()` returns `undefined`, never a guessed default, when no relationship has been recorded.

---

# 8. Migration Registry & Plans

The `MigrationRegistry` is immutable: once a migration record is registered, subsequent state changes are recorded as new snapshots via `update()`, never destructive rewrites. A `MigrationPlan` names its artifact type, source/target semantic versions, scope, preconditions, verification requirements, and rollback strategy — all real strings referencing real registered versions, not opaque identifiers.

---

# 9. Version Lifecycle

`created → registered → certified | rejected → released → supported → deprecated → retired`. `rejected` extends the spec's literal 7-node diagram: certification is a real gate, not an assumed pass. `registerVersion()` auto-transitions `created → registered` — a version identified with real source data is, by construction, already registered.

---

# 10. Migration Lifecycle

`planned → validated → compatibility-verified → executed → verified → certified`, with a `rollback` branch reachable from any in-progress stage (`validated`, `compatibility-verified`, `executed`, `verified`) resolving to `rolled-back` or the honest terminal `failed`. `failed` extends the spec's literal diagram: Law 4 guarantees migration is transactional, not that rollback itself always succeeds.

---

# 11. Migration Execution (Law 3 / Law 4)

`executeMigration()` orchestrates the full pipeline: validate → check compatibility (fail-closed, Law 3) → execute via the registered `MigrationExecutor` → verify → certify. Any real failure at any stage — no verified-compatible relationship, `execute()` failure, `verify()` failure — routes to `rollbackMigration()`, which calls the executor's real `rollback()` and resolves to `rolled-back` on success or `failed` on genuine rollback failure (Law 4).

---

# 12. Real Version Sources

`createConfigurationVersionSource` wraps ICMS's real `getVersionInfo()`. `createDatabaseVersionSource` wraps IDA's real, per-domain `DomainSchema.version`. `createEventSchemaVersionSource` wraps IEB's real, per-event `EventDefinition.version`. `createNoopVersionSource` is an honest, empty extension point for artifact types with no real producer yet.

---

# 13. Real Migration Executors

`createConfigurationMigrationExecutor` wraps ICMS's real `reload()` (execute), `getVersionInfo()` (verify), and real `rollback(snapshotVersion, reason, initiatingAuthority)` (rollback) — tracking the pre-migration snapshot version internally, since ICMS's rollback takes a snapshot version number, not a semantic-version string. `createDataAuthorityMigrationExecutor` wraps IDA's real migration-on-read; rollback is honestly unsupported by default. `withResilienceRollback()` composably wraps any executor's `rollback()` to delegate to IBRRA's real, certified `requestRecovery()`.

---

# 14. Audit & Explainability

`VersionAuditTrail` and `MigrationRegistry` are both structurally immutable — no update-in-place-without-audit or delete method exists. `explainVersion(versionId)` returns the current record plus its full transition history. `explainMigration(migrationId)` returns the current migration record, including every real step recorded along the way.

---

# 15. Events

10 named events published on `VersionEventBus`, bridged onto the real Institutional Event Bus (ADR-0009 §6 mirror pattern), under a new, additive `'version-governance'` `EventCategory`: `VersionRegistered`, `VersionReleased`, `VersionDeprecated`, `MigrationPlanned`, `MigrationStarted`, `MigrationCompleted`, `MigrationFailed`, `RollbackStarted`, `RollbackCompleted`, `CompatibilityVerified`. `MigrationFailed` is registered at `critical` priority.

---

# 16. Metrics

`getMetrics()` reports real migration count, migration failure count, rollback count, rollback failure count, average migration/verification/rollback durations, active supported version count, and deprecated artifact count — all derived from real counters incremented during actual orchestration, never estimated.

---

# 17. Public Interface

`registerVersionSource()`, `registerMigrationExecutor()`, `registerVersion()`, `syncVersions()`, `certifyVersion()`, `releaseVersion()`, `markSupported()`, `deprecateVersion()`, `retireVersion()`, `recordCompatibility()`, `planMigration()` (migration planning), `executeMigration()` (migration execution request, given an already-planned migration ID), `requestMigration()` (convenience: plan then execute), `explainVersion()`, `explainMigration()`, `getMetrics()`.

---

# 18. Integration

Real, optional constructor-supplied integration with an `InstitutionalEventBus` (mirror pattern) and an `ObservabilityAuthority` (per-event log schema registration, `'version-governance'` category). Neither is required — IVGMA's core governance and orchestration logic works standalone.

---

# 19. Testing

12 test files, 74 tests: artifact type registry, version registry, artifact compatibility registry, migration registry, version/migration lifecycle transition tables, real version sources (ICMS/IDA/IEB), real migration executors (ICMS round-trip, IDA migration-on-read, `withResilienceRollback()` composed with a real IBRRA recovery), the Institutional Evolution Graph, audit trail immutability, the event mirror pattern, the full orchestrator (happy path, both certification branches, the full release/support/deprecate/retire lifecycle, Law 3's fail-closed path, execute/verify failure rollback paths, the rollback-itself-fails path, real IEB/IOLA integration), and a performance smoke test.

---

# 20. Acceptance Criteria

| Criterion | Required |
|---|---|
| All version/migration operations flow through IVGMA | Yes |
| Version Registry authoritative | Yes |
| Compatibility relationships real, never assumed | Yes |
| Migration transactional (certified or rolled back/failed) | Yes |
| Migration fail-closed on unverified compatibility | Yes |
| Migration events published | Yes |
| Explainability complete | Yes |
| Tests pass | Yes |
| Documentation complete | Yes |

---

# 21. Institutional Completion Standard

No placeholder or incomplete implementations. Pre-coding spec review performed as explicitly requested, findings documented in ADR-0018. No independent migration/rollback mechanism duplicated — Law 1 applied reflexively to IVGMA's own design. Real bugs or design defects found during implementation are fixed before certification, not deferred.

---

# 22. Deferred / Out of Scope

Fleet-wide version rollout orchestration, cross-node version consensus, and automated compatibility-relationship inference are explicitly out of scope for this phase — `recordCompatibility()` records relationships as real decisions made by an operator or a future policy authority, never inferred.

---

# 23. Architect's Enhancement — Institutional Evolution Graph (IEG)

Built in full, per the same "build now" pattern confirmed unanimously for every prior Architect's Enhancement (Phases 10–14). Models the real lineage of every governed artifact from data already tracked elsewhere in this module — real `VersionRecord`s, real `MigrationRecord`s, real `CompatibilityRelationship`s — not a separate data source. Answers: "what changed between version X and Y" (`diff()`), "which migrations are required to reach a target version" (`migrationPath()`, a real BFS over certified migrations, honestly empty when no path exists), "which versions are compatible with this one" (`compatibleWith()`), "which deprecated capabilities still have active dependents" (`deprecatedWithActiveDependents()`), and "can the platform safely upgrade without breaking certified interfaces" (`canUpgradeSafely()`, fail-closed).

---

# 24. Cursor Implementation Contract

Implement IVGMA at `core/version_governance_authority/` exactly per §5–§18, with the Institutional Evolution Graph built in full per §23. No placeholder logic. Every migration executor and version source must wrap a real, already-existing method on an already-certified authority. Full test coverage, full documentation, full verification pipeline (type-check, tests, build) before certification.
