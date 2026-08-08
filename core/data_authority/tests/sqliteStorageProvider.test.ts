import { describe, expect, it } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteStorageProvider } from '../src/sqliteStorageProvider.js';
import { InvalidQueryFieldError } from '../src/errors.js';
import { WIDGET_SCHEMA } from './testHelpers.js';
import type { DataRecord } from '../src/types.js';

function makeRecord(overrides: Partial<DataRecord> = {}): DataRecord {
  const now = new Date().toISOString();
  return {
    id: 'r1',
    domain: 'benchmark-results',
    data: { name: 'a', value: 1 },
    version: 1,
    revision: 1,
    lifecycleStage: 'persisted',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SqliteStorageProvider (§7 — the real, default backend)', () => {
  it('creates a domain table and round-trips a record via insert/get', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord());

    const record = storage.get('benchmark-results', 'r1');
    expect(record?.data).toEqual({ name: 'a', value: 1 });
    storage.close();
  });

  it('update() replaces data and returns it on the next get()', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord());
    storage.update('benchmark-results', 'r1', makeRecord({ data: { name: 'a', value: 99 } }));
    expect(storage.get('benchmark-results', 'r1')?.data.value).toBe(99);
    storage.close();
  });

  it('delete() removes the record', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord());
    storage.delete('benchmark-results', 'r1');
    expect(storage.exists('benchmark-results', 'r1')).toBe(false);
    storage.close();
  });

  it('find() filters on JSON-nested fields via json_extract, including booleans', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord({ id: 'a', data: { name: 'a', value: 5, active: true } }));
    storage.insert('benchmark-results', makeRecord({ id: 'b', data: { name: 'b', value: 10, active: false } }));

    expect(storage.find('benchmark-results', { filters: [{ field: 'value', op: 'gt', value: 7 }] }).map((r) => r.id)).toEqual(['b']);
    expect(storage.find('benchmark-results', { filters: [{ field: 'active', op: 'eq', value: true }] }).map((r) => r.id)).toEqual(['a']);
    storage.close();
  });

  it('find() supports sort, limit, and offset', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord({ id: 'a', data: { name: 'a', value: 3 } }));
    storage.insert('benchmark-results', makeRecord({ id: 'b', data: { name: 'b', value: 1 } }));
    storage.insert('benchmark-results', makeRecord({ id: 'c', data: { name: 'c', value: 2 } }));

    const sorted = storage.find('benchmark-results', { sortBy: 'value', sortDirection: 'asc' });
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);

    const page = storage.find('benchmark-results', { sortBy: 'value', sortDirection: 'asc', limit: 1, offset: 1 });
    expect(page.map((r) => r.id)).toEqual(['c']);
    storage.close();
  });

  it('rejects a query field name that is not a safe identifier', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    expect(() => storage.find('benchmark-results', { filters: [{ field: "value'; DROP TABLE t; --", op: 'eq', value: 1 }] })).toThrow(
      InvalidQueryFieldError,
    );
    storage.close();
  });

  it('count() respects filters', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord({ id: 'a', data: { name: 'a', value: 1 } }));
    storage.insert('benchmark-results', makeRecord({ id: 'b', data: { name: 'b', value: 2 } }));
    expect(storage.count('benchmark-results')).toBe(2);
    expect(storage.count('benchmark-results', { filters: [{ field: 'value', op: 'eq', value: 2 }] })).toBe(1);
    storage.close();
  });

  it('transactions: a rolled-back transaction leaves no trace', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.beginTransaction();
    storage.insert('benchmark-results', makeRecord());
    storage.rollbackTransaction();
    expect(storage.exists('benchmark-results', 'r1')).toBe(false);
    storage.close();
  });

  it('savepoints: an inner rollback-to-savepoint preserves outer work', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.beginTransaction();
    storage.insert('benchmark-results', makeRecord({ id: 'outer' }));
    storage.savepoint('sp1');
    storage.insert('benchmark-results', makeRecord({ id: 'inner' }));
    storage.rollbackToSavepoint('sp1');
    storage.commitTransaction();

    expect(storage.exists('benchmark-results', 'outer')).toBe(true);
    expect(storage.exists('benchmark-results', 'inner')).toBe(false);
    storage.close();
  });

  it('backup() produces a real, restorable SQLite file (VACUUM INTO)', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureDomainTable(WIDGET_SCHEMA);
    storage.insert('benchmark-results', makeRecord());

    const backupPath = join(tmpdir(), `imip-ida-backup-${Date.now()}.db`);
    try {
      storage.backup(backupPath);
      expect(existsSync(backupPath)).toBe(true);
      expect(storage.validateBackup(backupPath)).toEqual({ valid: true, reasons: [] });

      const restored = new SqliteStorageProvider(backupPath);
      expect(restored.get('benchmark-results', 'r1')?.data).toEqual({ name: 'a', value: 1 });
      restored.close();
    } finally {
      storage.close();
      if (existsSync(backupPath)) unlinkSync(backupPath);
    }
  });

  it('validateBackup() reports invalid for a missing file', () => {
    const storage = new SqliteStorageProvider();
    const result = storage.validateBackup(join(tmpdir(), 'imip-ida-does-not-exist.db'));
    expect(result.valid).toBe(false);
    storage.close();
  });

  it('relationships: insert and query bidirectionally', () => {
    const storage = new SqliteStorageProvider();
    storage.ensureRelationshipsTable();
    storage.insertRelationship({
      relationshipId: 'rel1',
      fromDomain: 'hardware-inventory',
      fromId: 'gpu-1',
      relationshipType: 'has-capability',
      toDomain: 'capability-registry',
      toId: 'gpu-mining',
      createdAt: new Date().toISOString(),
    });

    expect(storage.findRelationshipsFrom('hardware-inventory', 'gpu-1')).toHaveLength(1);
    expect(storage.findRelationshipsTo('capability-registry', 'gpu-mining')).toHaveLength(1);
    expect(storage.findRelationshipsFrom('hardware-inventory', 'gpu-1', 'has-capability')).toHaveLength(1);
    expect(storage.findRelationshipsFrom('hardware-inventory', 'gpu-1', 'unrelated-type')).toHaveLength(0);
    storage.close();
  });
});
