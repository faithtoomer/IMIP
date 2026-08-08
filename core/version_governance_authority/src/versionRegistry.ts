import { DuplicateVersionError, VersionNotFoundError } from './errors.js';
import type { VersionRecord } from './types.js';

/** §6 — the authoritative Version Registry. */
export class VersionRegistry {
  private versions = new Map<string, VersionRecord>();

  register(record: VersionRecord): void {
    const duplicate = this.all().find(
      (existing) => existing.artifactType === record.artifactType && existing.artifactName === record.artifactName && existing.semanticVersion === record.semanticVersion,
    );
    if (duplicate) throw new DuplicateVersionError(record.artifactType, record.artifactName, record.semanticVersion);
    this.versions.set(record.versionId, record);
  }

  update(record: VersionRecord): void {
    this.require(record.versionId);
    this.versions.set(record.versionId, record);
  }

  get(versionId: string): VersionRecord | undefined {
    return this.versions.get(versionId);
  }

  require(versionId: string): VersionRecord {
    const record = this.versions.get(versionId);
    if (!record) throw new VersionNotFoundError(versionId);
    return record;
  }

  byArtifact(artifactType: string, artifactName?: string): VersionRecord[] {
    return this.all().filter(
      (record) => record.artifactType === artifactType && (artifactName === undefined || record.artifactName === artifactName),
    );
  }

  find(artifactType: string, artifactName: string, semanticVersion: string): VersionRecord | undefined {
    return this.all().find(
      (record) => record.artifactType === artifactType && record.artifactName === artifactName && record.semanticVersion === semanticVersion,
    );
  }

  all(): VersionRecord[] {
    return [...this.versions.values()];
  }

  supported(): VersionRecord[] {
    return this.all().filter((record) => record.status === 'supported' || record.status === 'released');
  }

  deprecated(): VersionRecord[] {
    return this.all().filter((record) => record.status === 'deprecated');
  }
}
