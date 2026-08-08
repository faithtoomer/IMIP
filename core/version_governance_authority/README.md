# Institutional Version Governance & Migration Authority (IVGMA)

**Status:** IMPLEMENTED (Phase 15, Program II final phase)
**Location:** `core/version_governance_authority/`
**Authority:** PHASE-15 / ADR-0018

## Purpose

IVGMA is the sole institutional authority for version governance, compatibility management, and migration orchestration — versioning is governance, migration is controlled evolution; two distinct concerns, one authority. It never re-implements the versioning or migration mechanics it governs: every version source and migration executor wraps an already-real method on an already-certified authority (ICMS, IDA, IEB, optionally IBRRA).

## Layout

```text
core/version_governance_authority/
  src/
    types.ts                       Artifact types, VersionRecord, MigrationRecord,
                                     CompatibilityRelationship, VERSION_EVENTS (10), ...
    errors.ts                        Structured, typed error taxonomy
    artifactTypeRegistry.ts            ArtifactTypeRegistry — real, runtime-extensible (§6)
    versionRegistry.ts                   VersionRegistry — the authoritative catalog (§6)
    artifactCompatibilityRegistry.ts       ArtifactCompatibilityRegistry — distinct from
                                             ICMS's own, narrower CompatibilityRegistry (§7)
    migrationRegistry.ts                     MigrationRegistry — immutable (§8)
    lifecycle.ts                               Version + migration lifecycle transition tables
    versionSources.ts                            Real sources wrapping ICMS/IDA/IEB version data
    migrationExecutors.ts                          Real executors wrapping ICMS/IDA
                                                     migration/rollback, + withResilienceRollback()
    evolutionGraph.ts                                InstitutionalEvolutionGraph — the
                                                       Architect's Enhancement (§24)
    auditTrail.ts                                      VersionAuditTrail — structurally immutable
    events.ts                                            VersionEventBus — mirrors onto the real IEB
    VersionGovernanceAuthority.ts                          The orchestrator
    index.ts                                                 Public exports
  tests/                                                      74 tests across 12 files
```

## Usage

```ts
import { VersionGovernanceAuthority } from './core/version_governance_authority/src/index.js';
import { createConfigurationVersionSource, createDatabaseVersionSource } from './core/version_governance_authority/src/versionSources.js';
import { createConfigurationMigrationExecutor, createDataAuthorityMigrationExecutor, withResilienceRollback } from './core/version_governance_authority/src/migrationExecutors.js';

const ivgma = new VersionGovernanceAuthority({
  versionSources: [createConfigurationVersionSource(icms), createDatabaseVersionSource(ida)],
  migrationExecutors: [
    createConfigurationMigrationExecutor(icms),
    withResilienceRollback(createDataAuthorityMigrationExecutor(ida), ibrra, backupId),
  ],
  eventBus: ieb,
  observabilityAuthority: iola,
});

ivgma.syncVersions('Operator');                 // pulls real, current ICMS/IDA/IEB version data
ivgma.recordCompatibility('database-schema', '1.0.0', 'database-schema', '2.0.0', true, 'additive change');

const migration = await ivgma.requestMigration(
  { artifactType: 'database-schema', sourceVersion: '1.0.0', targetVersion: '2.0.0', scope: 'benchmark-results', preconditions: [], verificationRequirements: [], rollbackStrategy: 'ibrra-recovery' },
  'Operator',
);
// migration.status === 'certified' once validated -> compatibility-verified -> executed -> verified all pass;
// any real failure at any stage routes to 'rolled-back' or the honest terminal 'failed'.

ivgma.graph.migrationPath('database-schema', '1.0.0', '3.0.0');   // §24 — real BFS over certified migrations
ivgma.graph.canUpgradeSafely('plugin-manifest', '1.0.0', 'runtime-contract', '3.0.0');
ivgma.explainVersion(versionId);                 // record + full audit history
ivgma.explainMigration(migrationId);
```

## Scope Boundary

IVGMA owns the Version Registry, compatibility relationships, migration planning, migration execution orchestration, rollback orchestration, migration auditing, and version explainability — never the mechanics of applying a schema migration, rolling back a configuration snapshot, or restoring a database domain (§4). It never contains schema-migration logic, config-rollback logic, or database-restore logic of its own — those stay owned by ICMS, IDA, and (optionally, for database rollback) IBRRA.

## Governance

- Every version source wraps a real, already-existing accessor on an already-certified authority (ICMS's `getVersionInfo()`, IDA's `DomainSchema.version`, IEB's `EventDefinition.version`) — Law 2, "real, not fabricated version data." Plugin/Capability/Policy artifact types are real, honest, zero-producer extension points (`createNoopVersionSource`), not fabricated data.
- Every migration executor wraps a real, already-existing mechanism on an already-certified authority (ICMS's `reload()`/`rollback()`, IDA's migration-on-read) — Law 1, applied reflexively to IVGMA's own design.
- `executeMigration()` is fail-closed on compatibility (Law 3): no recorded, verified-compatible relationship means compatibility is treated as not verified, never silently assumed safe.
- Migration is transactional (Law 4): every migration reaches `certified`, or is routed to `rolled-back`, or — when rollback itself fails — the honest terminal `failed` state. No code path leaves a migration partially applied and unresolved.
- Database-domain rollback is honestly unsupported by default (`{ success: false }`); `withResilienceRollback()` is a real, composable wrapper delegating to IBRRA's own certified `requestRecovery()`, not a second invented rollback mechanism.
- `ArtifactCompatibilityRegistry` is deliberately named to avoid colliding with ICMS's own, narrower `CompatibilityRegistry` class — two distinct concepts, two distinct names.
- `VersionAuditTrail`/`MigrationRegistry` expose no update-in-place-without-audit or delete method for any reason — immutability is structural.
