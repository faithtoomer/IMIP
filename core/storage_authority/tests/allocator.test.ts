import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { StorageRegistry } from '../src/registry.js';
import { StorageAllocator } from '../src/allocator.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('StorageAllocator (§8 — storage allocation)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('creates a real directory on disk for a directory allocation', () => {
    root = makeTempRoot();
    const allocator = new StorageAllocator(new StorageRegistry(), root);
    const entry = allocator.allocate('database', 'primary');

    expect(entry.isFile).toBe(false);
    expect(existsSync(entry.path)).toBe(true);
    expect(statSync(entry.path).isDirectory()).toBe(true);
    expect(entry.path).toBe(join(root, 'database', 'primary'));
  });

  it('allocates a file path inside a real managed directory when filename is given', () => {
    root = makeTempRoot();
    const allocator = new StorageAllocator(new StorageRegistry(), root);
    const entry = allocator.allocate('database', 'primary', { filename: 'data.db' });

    expect(entry.isFile).toBe(true);
    expect(entry.path).toBe(join(root, 'database', 'primary', 'data.db'));
    expect(existsSync(join(root, 'database', 'primary'))).toBe(true);
  });

  it('is idempotent: re-allocating the same (domain, purpose) returns the same entry', () => {
    root = makeTempRoot();
    const registry = new StorageRegistry();
    const allocator = new StorageAllocator(registry, root);
    const first = allocator.allocate('database', 'primary');
    const second = allocator.allocate('database', 'primary');

    expect(second.storageId).toBe(first.storageId);
    expect(registry.all()).toHaveLength(1);
  });

  it('different purposes within the same domain get distinct entries', () => {
    root = makeTempRoot();
    const allocator = new StorageAllocator(new StorageRegistry(), root);
    const a = allocator.allocate('database', 'primary');
    const b = allocator.allocate('database', 'secondary');
    expect(a.storageId).not.toBe(b.storageId);
  });
});
