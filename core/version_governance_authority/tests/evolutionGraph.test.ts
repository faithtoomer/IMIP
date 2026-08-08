import { describe, expect, it } from 'vitest';
import { InstitutionalEvolutionGraph } from '../src/evolutionGraph.js';
import type { CompatibilityRelationship, MigrationRecord, VersionRecord } from '../src/types.js';

function makeVersion(overrides: Partial<VersionRecord> = {}): VersionRecord {
  return {
    versionId: 'v1',
    artifactType: 'database-schema',
    artifactName: 'benchmark-results',
    semanticVersion: '1.0.0',
    compatibilityVersion: '1',
    migrationVersion: '1',
    status: 'released',
    ownerAuthority: 'X',
    certificationStatus: 'certified',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMigration(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    migrationId: 'm1',
    artifactType: 'database-schema',
    sourceVersion: '1.0.0',
    targetVersion: '2.0.0',
    scope: 'benchmark-results',
    preconditions: [],
    verificationRequirements: [],
    rollbackStrategy: 'restore-from-backup',
    status: 'certified',
    steps: [],
    requestedBy: 'X',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<CompatibilityRelationship> = {}): CompatibilityRelationship {
  return {
    relationshipId: 'r1',
    fromArtifactType: 'plugin-manifest',
    fromVersion: '1.0.0',
    toArtifactType: 'runtime-contract',
    toVersion: '3.0.0',
    compatible: true,
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('InstitutionalEvolutionGraph (§24 — Architect\'s Enhancement, built in full)', () => {
  it('diff() reports which real version fields actually changed', () => {
    const from = makeVersion({ versionId: 'v1', semanticVersion: '1.0.0', compatibilityVersion: '1', migrationVersion: '1' });
    const to = makeVersion({ versionId: 'v2', semanticVersion: '2.0.0', compatibilityVersion: '1', migrationVersion: '2' });
    const graph = new InstitutionalEvolutionGraph(() => [from, to], () => [], () => []);

    const diff = graph.diff('v1', 'v2');
    expect(diff.semanticVersionChanged).toBe(true);
    expect(diff.compatibilityVersionChanged).toBe(false);
    expect(diff.migrationVersionChanged).toBe(true);
  });

  it('migrationPath() finds a real multi-hop BFS chain of certified migrations', () => {
    const migrations = [
      makeMigration({ migrationId: 'm1', sourceVersion: '1.0.0', targetVersion: '2.0.0' }),
      makeMigration({ migrationId: 'm2', sourceVersion: '2.0.0', targetVersion: '3.0.0' }),
      makeMigration({ migrationId: 'm3', sourceVersion: '1.0.0', targetVersion: '9.0.0' }), // decoy dead-end
    ];
    const graph = new InstitutionalEvolutionGraph(() => [], () => migrations, () => []);

    const path = graph.migrationPath('database-schema', '1.0.0', '3.0.0');
    expect(path.map((m) => m.migrationId)).toEqual(['m1', 'm2']);
  });

  it('migrationPath() honestly returns empty when no path exists', () => {
    const migrations = [makeMigration({ migrationId: 'm1', sourceVersion: '1.0.0', targetVersion: '2.0.0' })];
    const graph = new InstitutionalEvolutionGraph(() => [], () => migrations, () => []);
    expect(graph.migrationPath('database-schema', '1.0.0', '5.0.0')).toEqual([]);
  });

  it('migrationPath() ignores non-certified migrations', () => {
    const migrations = [makeMigration({ migrationId: 'm1', sourceVersion: '1.0.0', targetVersion: '2.0.0', status: 'planned' })];
    const graph = new InstitutionalEvolutionGraph(() => [], () => migrations, () => []);
    expect(graph.migrationPath('database-schema', '1.0.0', '2.0.0')).toEqual([]);
  });

  it('compatibleWith() returns only compatible relationships targeting the given artifact/version', () => {
    const relationships = [
      makeRelationship({ relationshipId: 'r1', compatible: true }),
      makeRelationship({ relationshipId: 'r2', compatible: false }),
    ];
    const graph = new InstitutionalEvolutionGraph(() => [], () => [], () => relationships);
    const found = graph.compatibleWith('runtime-contract', '3.0.0');
    expect(found.map((r) => r.relationshipId)).toEqual(['r1']);
  });

  it('deprecatedWithActiveDependents() surfaces only deprecated versions with real recorded dependents', () => {
    const deprecatedWithDependent = makeVersion({ versionId: 'v1', artifactType: 'runtime-contract', semanticVersion: '3.0.0', status: 'deprecated' });
    const deprecatedWithoutDependent = makeVersion({ versionId: 'v2', artifactType: 'runtime-contract', semanticVersion: '4.0.0', status: 'deprecated' });
    const relationships = [makeRelationship({ toArtifactType: 'runtime-contract', toVersion: '3.0.0', compatible: true })];
    const graph = new InstitutionalEvolutionGraph(() => [deprecatedWithDependent, deprecatedWithoutDependent], () => [], () => relationships);

    const result = graph.deprecatedWithActiveDependents();
    expect(result).toHaveLength(1);
    expect(result[0].version.versionId).toBe('v1');
    expect(result[0].dependents).toHaveLength(1);
  });

  it('canUpgradeSafely() is fail-closed when no relationship is recorded — never assumes safety', () => {
    const graph = new InstitutionalEvolutionGraph(() => [], () => [], () => []);
    const result = graph.canUpgradeSafely('plugin-manifest', '1.0.0', 'runtime-contract', '3.0.0');
    expect(result.safe).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('canUpgradeSafely() reflects a real recorded incompatible relationship with its reason', () => {
    const relationships = [makeRelationship({ compatible: false, reason: 'breaking ABI change' })];
    const graph = new InstitutionalEvolutionGraph(() => [], () => [], () => relationships);
    const result = graph.canUpgradeSafely('plugin-manifest', '1.0.0', 'runtime-contract', '3.0.0');
    expect(result.safe).toBe(false);
    expect(result.reasons).toContain('breaking ABI change');
  });

  it('canUpgradeSafely() reflects a real recorded compatible relationship', () => {
    const relationships = [makeRelationship({ compatible: true })];
    const graph = new InstitutionalEvolutionGraph(() => [], () => [], () => relationships);
    const result = graph.canUpgradeSafely('plugin-manifest', '1.0.0', 'runtime-contract', '3.0.0');
    expect(result.safe).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});
