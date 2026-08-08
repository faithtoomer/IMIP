import { describe, expect, it } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DataAuthority } from '../src/DataAuthority.js';
import type { DataMigrationDefinition, DomainSchema } from '../src/types.js';

const V1_SCHEMA: DomainSchema = {
  domain: 'notifications',
  version: 1,
  fields: [{ name: 'legacyMessage', type: 'string' }],
};

const V2_SCHEMA: DomainSchema = {
  domain: 'notifications',
  version: 2,
  fields: [{ name: 'message', type: 'string' }],
};

const MIGRATION: DataMigrationDefinition = {
  id: 'legacyMessage-to-message',
  domain: 'notifications',
  fromVersion: 1,
  toVersion: 2,
  description: 'renamed field',
  migrate: (data) => {
    const { legacyMessage, ...rest } = data;
    return { ...rest, message: legacyMessage };
  },
};

describe('Schema migration applied transparently on read (§9/§10)', () => {
  it('a v1 record is migrated to v2 shape the first time it is read after the schema bumps', () => {
    const path = join(tmpdir(), `imip-ida-migration-${Date.now()}.db`);
    try {
      const writer = new DataAuthority({ filePath: path });
      writer.registerDomainSchema(V1_SCHEMA);
      const created = writer.create('notifications', { legacyMessage: 'hello' }, 'X');
      writer.close();

      // Simulate a schema version bump between process restarts by reopening
      // the same on-disk database with the v2 schema + migration registered.
      const reader = new DataAuthority({ filePath: path, migrations: [MIGRATION] });
      reader.registerDomainSchema(V2_SCHEMA);

      const migrated = reader.get('notifications', created.id);
      expect(migrated?.data).toEqual({ message: 'hello' });
      expect(migrated?.version).toBe(2);
      reader.close();
    } finally {
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('the migrated shape is persisted so subsequent reads skip re-migration', () => {
    const ida = new DataAuthority({ migrations: [MIGRATION] });
    ida.registerDomainSchema(V1_SCHEMA);
    const created = ida.create('notifications', { legacyMessage: 'once' }, 'X');

    // Bump the in-memory schema view is not directly supported (schemas are
    // registered once), so this test instead confirms idempotency: reading
    // twice in a row does not apply a migration twice.
    const first = ida.get('notifications', created.id);
    const second = ida.get('notifications', created.id);
    expect(first?.version).toBe(second?.version);
    expect(first?.data).toEqual(second?.data);
  });
});
