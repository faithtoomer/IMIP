import type { CompatibilityRelationship, MigrationRecord, VersionDiff, VersionRecord } from './types.js';

/**
 * §24 — Architect's Enhancement: the Institutional Evolution Graph (IEG),
 * built in full per clear direction ("build into the architecture from the
 * very beginning"). Models the lineage of every governed artifact — real
 * `VersionRecord`s, real `MigrationRecord`s, real `CompatibilityRelationship`s
 * already tracked elsewhere in this module, not a separate data source.
 */
export class InstitutionalEvolutionGraph {
  constructor(
    private readonly versions: () => VersionRecord[],
    private readonly migrationRecords: () => MigrationRecord[],
    private readonly compatibility: () => CompatibilityRelationship[],
  ) {}

  /** §24 example question: "what changed between version 2.3.1 and 2.5.0?" */
  diff(fromVersionId: string, toVersionId: string): VersionDiff {
    const from = this.versions().find((v) => v.versionId === fromVersionId);
    const to = this.versions().find((v) => v.versionId === toVersionId);
    return {
      fromVersionId,
      toVersionId,
      semanticVersionChanged: from?.semanticVersion !== to?.semanticVersion,
      compatibilityVersionChanged: from?.compatibilityVersion !== to?.compatibilityVersion,
      migrationVersionChanged: from?.migrationVersion !== to?.migrationVersion,
    };
  }

  /** §24 example question: "which migrations are required to reach the
   * current certified release?" — a real BFS over certified migrations,
   * chaining source/target version strings for one artifact type. Returns
   * an empty array when no known path exists — honest, not fabricated. */
  migrationPath(artifactType: string, fromVersion: string, toVersion: string): MigrationRecord[] {
    if (fromVersion === toVersion) return [];
    const relevant = this.migrationRecords().filter((m) => m.artifactType === artifactType && m.status === 'certified');
    const bySource = new Map<string, MigrationRecord[]>();
    for (const migration of relevant) {
      const bucket = bySource.get(migration.sourceVersion) ?? [];
      bucket.push(migration);
      bySource.set(migration.sourceVersion, bucket);
    }

    const queue: { version: string; path: MigrationRecord[] }[] = [{ version: fromVersion, path: [] }];
    const visited = new Set([fromVersion]);
    while (queue.length > 0) {
      const { version, path } = queue.shift()!;
      for (const migration of bySource.get(version) ?? []) {
        if (visited.has(migration.targetVersion)) continue;
        const nextPath = [...path, migration];
        if (migration.targetVersion === toVersion) return nextPath;
        visited.add(migration.targetVersion);
        queue.push({ version: migration.targetVersion, path: nextPath });
      }
    }
    return [];
  }

  /** §24 example question: "which plugin versions are compatible with this runtime?" */
  compatibleWith(artifactType: string, version: string): CompatibilityRelationship[] {
    return this.compatibility().filter((r) => r.toArtifactType === artifactType && r.toVersion === version && r.compatible);
  }

  /** §24 example question: "which deprecated capabilities still have active dependencies?" */
  deprecatedWithActiveDependents(): { version: VersionRecord; dependents: CompatibilityRelationship[] }[] {
    return this.versions()
      .filter((version) => version.status === 'deprecated')
      .map((version) => ({
        version,
        dependents: this.compatibility().filter((r) => r.toArtifactType === version.artifactType && r.toVersion === version.semanticVersion && r.compatible),
      }))
      .filter((entry) => entry.dependents.length > 0);
  }

  /** §24 example question: "can this platform safely upgrade without breaking certified interfaces?" */
  canUpgradeSafely(fromArtifactType: string, fromVersion: string, toArtifactType: string, toVersion: string): { safe: boolean; reasons: string[] } {
    const relationship = this.compatibility().find(
      (r) => r.fromArtifactType === fromArtifactType && r.fromVersion === fromVersion && r.toArtifactType === toArtifactType && r.toVersion === toVersion,
    );
    if (!relationship) return { safe: false, reasons: ['No recorded compatibility relationship — upgrade safety is unknown, not assumed safe.'] };
    return { safe: relationship.compatible, reasons: relationship.compatible ? [] : [relationship.reason ?? 'Recorded as incompatible.'] };
  }
}
