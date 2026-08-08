import { randomUUID } from 'node:crypto';
import type { CompatibilityRelationship } from './types.js';

/**
 * §7 — real, queryable cross-artifact-type version compatibility. Named
 * `ArtifactCompatibilityRegistry`, deliberately not `CompatibilityRegistry`
 * — ICMS already has a class with that exact name (`core/
 * configuration_authority/src/compatibility.ts`), a narrower, config-value-
 * level checker registry (hardware/policy rules applied during
 * validation), a different concept entirely. See ADR-0018.
 */
export class ArtifactCompatibilityRegistry {
  private relationships: CompatibilityRelationship[] = [];

  record(
    fromArtifactType: string,
    fromVersion: string,
    toArtifactType: string,
    toVersion: string,
    compatible: boolean,
    reason?: string,
  ): CompatibilityRelationship {
    const relationship: CompatibilityRelationship = {
      relationshipId: randomUUID(),
      fromArtifactType,
      fromVersion,
      toArtifactType,
      toVersion,
      compatible,
      reason,
      recordedAt: new Date().toISOString(),
    };
    this.relationships.push(relationship);
    return relationship;
  }

  check(fromArtifactType: string, fromVersion: string, toArtifactType: string, toVersion: string): CompatibilityRelationship | undefined {
    return [...this.relationships]
      .reverse()
      .find(
        (r) => r.fromArtifactType === fromArtifactType && r.fromVersion === fromVersion && r.toArtifactType === toArtifactType && r.toVersion === toVersion,
      );
  }

  relationshipsFrom(artifactType: string, version: string): CompatibilityRelationship[] {
    return this.relationships.filter((r) => r.fromArtifactType === artifactType && r.fromVersion === version);
  }

  relationshipsTo(artifactType: string, version: string): CompatibilityRelationship[] {
    return this.relationships.filter((r) => r.toArtifactType === artifactType && r.toVersion === version);
  }

  all(): CompatibilityRelationship[] {
    return [...this.relationships];
  }
}
