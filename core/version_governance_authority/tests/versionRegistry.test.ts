import { describe, expect, it } from 'vitest';
import { VersionRegistry } from '../src/versionRegistry.js';
import { DuplicateVersionError, VersionNotFoundError } from '../src/errors.js';
import type { VersionRecord } from '../src/types.js';

function makeRecord(overrides: Partial<VersionRecord> = {}): VersionRecord {
  return {
    versionId: 'v1',
    artifactType: 'configuration-schema',
    artifactName: 'icms-configuration',
    semanticVersion: '1.0.0',
    status: 'created',
    ownerAuthority: 'X',
    certificationStatus: 'uncertified',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('VersionRegistry (§6)', () => {
  it('registers and retrieves a version', () => {
    const registry = new VersionRegistry();
    registry.register(makeRecord());
    expect(registry.get('v1')?.versionId).toBe('v1');
  });

  it('rejects a duplicate (artifactType, artifactName, semanticVersion) triple', () => {
    const registry = new VersionRegistry();
    registry.register(makeRecord());
    expect(() => registry.register(makeRecord({ versionId: 'v2' }))).toThrow(DuplicateVersionError);
  });

  it('require() throws for an unregistered version', () => {
    const registry = new VersionRegistry();
    expect(() => registry.require('missing')).toThrow(VersionNotFoundError);
  });

  it('find() locates a version by its real identity triple', () => {
    const registry = new VersionRegistry();
    registry.register(makeRecord());
    expect(registry.find('configuration-schema', 'icms-configuration', '1.0.0')?.versionId).toBe('v1');
    expect(registry.find('configuration-schema', 'icms-configuration', '2.0.0')).toBeUndefined();
  });

  it('byArtifact() filters by type and optionally by name', () => {
    const registry = new VersionRegistry();
    registry.register(makeRecord({ versionId: 'a', artifactName: 'x' }));
    registry.register(makeRecord({ versionId: 'b', artifactName: 'y', semanticVersion: '2.0.0' }));
    expect(registry.byArtifact('configuration-schema')).toHaveLength(2);
    expect(registry.byArtifact('configuration-schema', 'x')).toHaveLength(1);
  });

  it('supported() and deprecated() filter by real status', () => {
    const registry = new VersionRegistry();
    registry.register(makeRecord({ versionId: 'a', status: 'supported' }));
    registry.register(makeRecord({ versionId: 'b', status: 'deprecated', semanticVersion: '2.0.0' }));
    registry.register(makeRecord({ versionId: 'c', status: 'created', semanticVersion: '3.0.0' }));
    expect(registry.supported().map((r) => r.versionId)).toEqual(['a']);
    expect(registry.deprecated().map((r) => r.versionId)).toEqual(['b']);
  });
});
