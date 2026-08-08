# ADR-0018: Institutional Version Governance & Migration Authority

**Status:** Accepted
**Date:** 2026-08-08
**Phase:** 15 (Program II, final phase)
**Deciders:** Architectural Authority (Specification), User (naming/scope framing)

## Context

The user reframed Phase 15 before it was specified: not a "Version & Migration Authority," because versioning and migration are two different concerns — versioning is governance (what version is this, is it certified, is it compatible), migration is controlled evolution (how does the platform move from one version to another safely). The name became the Institutional Version Governance & Migration Authority (IVGMA), and the spec was built around that split from the outset.

Per the user's now-standing instruction ("review the following for duplication, redundancies, conflicts and contradictions" before writing code), the spec was checked against every authority that already tracks a version number:

1. ICMS (Phase 02) already has a real `getVersionInfo()` returning `schemaVersion`/`runtimeVersion`/`compatibilityVersion`/`migrationVersion`, plus a real `MigrationRunner` and a real `rollback(version, reason, initiatingAuthority)`.
2. IDA (Phase 08) already has real per-domain `DomainSchema.version` numbers and a real `DataMigrationRunner` performing migration-on-read.
3. IEB (Phase 01) already has real per-event `EventDefinition.version` strings.
4. IBRRA (Phase 14) already has a real `requestRecovery()` — a genuine, certified rollback mechanism for the database domain.

This is the same shape of finding as Phase 14's review of IBRRA against IDA/ICMS/ISMA/IRBLM: the mechanics IVGMA's spec describes are already real elsewhere. IVGMA's own Law 1 ("no authority shall independently implement or perform version tracking, compatibility checking, or migration execution outside IVGMA's governance") was applied reflexively to IVGMA's own design, exactly as it was for IBRRA in ADR-0017: IVGMA governs and orchestrates: it never reimplements the migration or rollback mechanics of the authorities it governs.

A second, narrower finding: ICMS's `core/configuration_authority/src/compatibility.ts` already exports a class named `CompatibilityRegistry` — a config-value-level checker registry, a different and narrower concept from IVGMA's cross-artifact-type version compatibility tracking. Naming IVGMA's own class `CompatibilityRegistry` would have created a real naming collision between two unrelated concepts in the same codebase.

§24's Architect's Enhancement ("recommend building into the architecture from the outset") was answered the same way as every prior phase's enhancement (Phase 10 through 14): built in full, not deferred.

## Decisions

1. **Every migration executor wraps an already-real mechanism.** `createConfigurationMigrationExecutor` calls ICMS's real `reload()` (execute), `getVersionInfo()` (verify), and real `rollback(priorSnapshotVersion, reason, 'IVGMA')` (rollback) — tracking a `preMigrationSnapshotVersion` map keyed by migration ID, captured before `reload()` runs, since ICMS's `rollback()` takes a snapshot version *number*, not a semantic-version string. `createDataAuthorityMigrationExecutor` calls IDA's real `find()` to force migration-on-read (execute) and inspects the resulting real `DomainSchema.version` (verify). IVGMA contains zero migration-mechanics or rollback-mechanics of its own for these two artifact types.
2. **Database-domain rollback is honestly unsupported by default, with a real, composable escape hatch.** IDA has no in-place migration-undo primitive, so `createDataAuthorityMigrationExecutor`'s `rollback()` honestly returns `{ success: false }` rather than fabricating one. `withResilienceRollback(executor, resilienceAuthority, backupId)` wraps any executor, overriding only `rollback()` to call IBRRA's real, already-certified `requestRecovery()` — a genuine cross-phase reuse between the two most recently built authorities, not a second invented database-rollback mechanism.
3. **The cross-artifact-type compatibility registry is named `ArtifactCompatibilityRegistry`, not `CompatibilityRegistry`**, to avoid colliding with ICMS's own, narrower, already-existing class of that exact name. See `core/version_governance_authority/src/artifactCompatibilityRegistry.ts`.
4. **Migration is fail-closed on compatibility (Law 3, "Compatibility Before Migration").** `executeMigration()` checks `ArtifactCompatibilityRegistry.check()` before proceeding to execution; no recorded, verified-compatible relationship means compatibility is treated as **not verified**, never silently assumed safe — this routes straight to rollback rather than proceeding.
5. **Migration is transactional (Law 4).** Every migration either reaches `certified` or is routed through `rollbackMigration()` to `rolled-back` or the honest terminal `failed` state (when rollback itself fails) — there is no code path that leaves a migration in a partially-applied, unresolved state.
6. **`VersionStatus` gained `rejected`** and **`MigrationStatus` gained `failed`**, beyond the spec's literal state diagrams — certification can fail (a version can be reviewed and rejected, not just certified), and rollback itself can fail (Law 4 guarantees migration is transactional, not that rollback always succeeds).
7. **A new, additive `'version-governance'` `EventCategory` was added** (the same precedent as ISMA's `'storage'`, ADR-0012, and IBRRA's `'resilience'`, ADR-0017) — no existing category fit.
8. **The Institutional Evolution Graph (§24) was built in full**, not deferred — `diff()`, a real BFS `migrationPath()` over certified migrations (honestly returning `[]` when no path exists), `compatibleWith()`, `deprecatedWithActiveDependents()`, and a fail-closed `canUpgradeSafely()`.
9. **A design defect was self-caught before it reached a test.** An early draft of `transitionVersion()` called `logOnly()` with ad-hoc operation-name strings (e.g. `'version-certified'`) that were never registered as IOLA log schemas in the constructor — every call would have silently no-op'd via the existing try/catch, forever. Removed; the meaningful, externally-visible transitions are already published through the named `VERSION_EVENTS`.

## Consequences

- ICMS and IDA remain the sole owners of their respective migration/rollback mechanics — IVGMA adds a governance and orchestration layer on top, never a competing implementation.
- Database-domain migration rollback can genuinely delegate to IBRRA's recovery mechanism via `withResilienceRollback()` — the first real functional composition between two Program II authorities built back-to-back.
- Adding a new governed artifact type (Plugin Registry, Capability Registry, Policy Definitions — all real, reserved extension points per ADR-0002/ADR-0014) is a `registerVersionSource()`/`registerMigrationExecutor()` call, not a change to IVGMA's core.
- Program II is complete as of this phase: eight authorities (ICMS extension work aside, counting from Phase 08) built across Phases 08–15, each governed by the same reflexive-Law-1 orchestration discipline established in Phase 14 and carried through to Phase 15.
