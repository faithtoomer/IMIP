import { describe, expect, it } from 'vitest';
import { StorageRegistry } from '../src/registry.js';
import { DuplicateStorageIdError, StorageNotFoundError } from '../src/errors.js';
import type { StorageEntry } from '../src/types.js';

function makeEntry(overrides: Partial<StorageEntry> = {}): StorageEntry {
  return {
    storageId: 'id-1',
    domain: 'database',
    purpose: 'primary',
    path: '/tmp/x',
    isFile: false,
    encryptionStatus: 'none',
    backupStatus: 'none',
    lifecycleStage: 'allocated',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('StorageRegistry (§7 — the SSOT for managed storage)', () => {
  it('registers and retrieves an entry by id', () => {
    const registry = new StorageRegistry();
    registry.register(makeEntry());
    expect(registry.get('id-1')?.purpose).toBe('primary');
  });

  it('rejects a duplicate storageId', () => {
    const registry = new StorageRegistry();
    registry.register(makeEntry());
    expect(() => registry.register(makeEntry())).toThrow(DuplicateStorageIdError);
  });

  it('require() throws for an unregistered id', () => {
    const registry = new StorageRegistry();
    expect(() => registry.require('missing')).toThrow(StorageNotFoundError);
  });

  it('finds an entry by (domain, purpose)', () => {
    const registry = new StorageRegistry();
    registry.register(makeEntry());
    expect(registry.findByPurpose('database', 'primary')?.storageId).toBe('id-1');
    expect(registry.findByPurpose('database', 'other')).toBeUndefined();
  });

  it('lists entries by domain', () => {
    const registry = new StorageRegistry();
    registry.register(makeEntry({ storageId: 'a', domain: 'database', purpose: 'a' }));
    registry.register(makeEntry({ storageId: 'b', domain: 'telemetry', purpose: 'b' }));
    expect(registry.byDomain('database')).toHaveLength(1);
    expect(registry.byDomain('telemetry')).toHaveLength(1);
  });

  it('remove() deregisters both the id and the (domain, purpose) index', () => {
    const registry = new StorageRegistry();
    registry.register(makeEntry());
    registry.remove('id-1');
    expect(registry.get('id-1')).toBeUndefined();
    expect(registry.findByPurpose('database', 'primary')).toBeUndefined();
  });

  it('update() replaces an existing entry in place', () => {
    const registry = new StorageRegistry();
    registry.register(makeEntry());
    registry.update(makeEntry({ lifecycleStage: 'active' }));
    expect(registry.get('id-1')?.lifecycleStage).toBe('active');
  });
});
