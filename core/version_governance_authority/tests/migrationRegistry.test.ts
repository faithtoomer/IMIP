import { describe, expect, it } from 'vitest';
import { MigrationRegistry } from '../src/migrationRegistry.js';
import { MigrationNotFoundError } from '../src/errors.js';
import type { MigrationRecord } from '../src/types.js';

function makeRecord(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    migrationId: 'm1',
    artifactType: 'database-schema',
    sourceVersion: '1',
    targetVersion: '2',
    scope: 'benchmark-results',
    preconditions: [],
    verificationRequirements: [],
    rollbackStrategy: 'restore-from-backup',
    status: 'planned',
    steps: [],
    requestedBy: 'X',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MigrationRegistry (§8 — immutable)', () => {
  it('registers and retrieves a migration', () => {
    const registry = new MigrationRegistry();
    registry.register(makeRecord());
    expect(registry.get('m1')?.migrationId).toBe('m1');
  });

  it('require() throws for an unregistered migration', () => {
    const registry = new MigrationRegistry();
    expect(() => registry.require('missing')).toThrow(MigrationNotFoundError);
  });

  it('byArtifactType() filters correctly', () => {
    const registry = new MigrationRegistry();
    registry.register(makeRecord({ migrationId: 'a', artifactType: 'database-schema' }));
    registry.register(makeRecord({ migrationId: 'b', artifactType: 'configuration-schema' }));
    expect(registry.byArtifactType('database-schema')).toHaveLength(1);
  });

  it('update() replaces the record in place', () => {
    const registry = new MigrationRegistry();
    registry.register(makeRecord());
    registry.update(makeRecord({ status: 'certified' }));
    expect(registry.get('m1')?.status).toBe('certified');
  });
});
