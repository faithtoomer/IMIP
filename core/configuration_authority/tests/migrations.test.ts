import { describe, expect, it } from 'vitest';
import { MigrationRunner, DEFAULT_MIGRATIONS } from '../src/migrations.js';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import type { MigrationDefinition } from '../src/types.js';

describe('MigrationRunner (§15 framework)', () => {
  it('ships with zero default migrations for the current schema (no value-shape changes since 1.0.0)', () => {
    expect(DEFAULT_MIGRATIONS).toEqual([]);
  });

  it('applies a single migration and reports it', () => {
    const migration: MigrationDefinition = {
      id: 'rename-legacy-locale',
      fromSchemaVersion: '0.9.0',
      toSchemaVersion: '1.0.0',
      description: 'legacy.locale -> platform.locale',
      migrate: (values) => {
        if (!('legacy.locale' in values)) return values;
        const { 'legacy.locale': legacy, ...rest } = values;
        return { ...rest, 'platform.locale': legacy };
      },
    };
    const runner = new MigrationRunner([migration]);
    const result = runner.run({ 'legacy.locale': 'fr-FR' }, '0.9.0');

    expect(result.values).toEqual({ 'platform.locale': 'fr-FR' });
    expect(result.finalSchemaVersion).toBe('1.0.0');
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]).toMatchObject({
      migrationId: 'rename-legacy-locale',
      fromSchemaVersion: '0.9.0',
      toSchemaVersion: '1.0.0',
    });
    expect(result.applied[0].affectedKeys).toContain('platform.locale');
  });

  it('chains multiple migrations automatically', () => {
    const migrations: MigrationDefinition[] = [
      {
        id: 'v0-to-v1',
        fromSchemaVersion: '0.0.0',
        toSchemaVersion: '1.0.0',
        description: 'step 1',
        migrate: (values) => ({ ...values, step1: true }),
      },
      {
        id: 'v1-to-v2',
        fromSchemaVersion: '1.0.0',
        toSchemaVersion: '2.0.0',
        description: 'step 2',
        migrate: (values) => ({ ...values, step2: true }),
      },
    ];
    const runner = new MigrationRunner(migrations);
    const result = runner.run({}, '0.0.0');

    expect(result.values).toEqual({ step1: true, step2: true });
    expect(result.finalSchemaVersion).toBe('2.0.0');
    expect(result.applied.map((r) => r.migrationId)).toEqual(['v0-to-v1', 'v1-to-v2']);
  });

  it('is a no-op when no migration applies from the given version', () => {
    const runner = new MigrationRunner([]);
    const result = runner.run({ a: 1 }, '2.0.0');
    expect(result.values).toEqual({ a: 1 });
    expect(result.applied).toEqual([]);
    expect(result.finalSchemaVersion).toBe('2.0.0');
  });
});

describe('ConfigurationAuthority migration integration', () => {
  it('publishes ConfigurationMigrated and updates provenance migrationHistory when a migration applies', () => {
    const migration: MigrationDefinition = {
      id: 'force-debug-on',
      fromSchemaVersion: '2.0.0',
      toSchemaVersion: '2.0.0-patched',
      description: 'demonstration migration for the live registry',
      migrate: (values) => ({ ...values, 'platform.debugMode': true }),
    };
    const authority = new ConfigurationAuthority({ argv: [], env: {}, migrations: [migration] });

    let migratedPayload: unknown;
    authority.events.subscribe('ConfigurationMigrated', (payload) => {
      migratedPayload = payload;
    });

    authority.load();

    expect(migratedPayload).toBeDefined();
    const provenance = authority.getProvenance('platform.debugMode');
    expect(provenance?.migrationHistory).toHaveLength(1);
    expect(provenance?.migrationHistory[0].migrationId).toBe('force-debug-on');
  });

  it('getVersionInfo reflects the last applied migration id', () => {
    const migration: MigrationDefinition = {
      id: 'noop-migration',
      fromSchemaVersion: '2.0.0',
      toSchemaVersion: '2.0.0-patched',
      description: 'no-op',
      migrate: (values) => values,
    };
    const authority = new ConfigurationAuthority({ argv: [], env: {}, migrations: [migration] });
    authority.load();
    expect(authority.getVersionInfo().migrationVersion).toBe('noop-migration');
  });
});
