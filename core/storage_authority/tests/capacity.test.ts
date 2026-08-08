import { describe, expect, it, afterEach } from 'vitest';
import { StorageRegistry } from '../src/registry.js';
import { StorageAllocator } from '../src/allocator.js';
import { measureCapacity, evaluateHealth } from '../src/capacity.js';
import { DirectoryMissingError } from '../src/errors.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';
import type { CapacitySnapshot, StorageEntry } from '../src/types.js';

describe('capacity.ts (§9 — real capacity measurement via fs.statfsSync)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('measures real, positive capacity for an allocated directory', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('database', 'primary');
    const capacity = measureCapacity(entry);

    expect(capacity.totalBytes).toBeGreaterThan(0);
    expect(capacity.usedPercent).toBeGreaterThanOrEqual(0);
    expect(capacity.usedPercent).toBeLessThanOrEqual(100);
  });

  it('measures capacity for a file entry via its containing directory', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('database', 'primary', { filename: 'data.db' });
    expect(measureCapacity(entry).totalBytes).toBeGreaterThan(0);
  });

  it('throws DirectoryMissingError for a path that does not exist', () => {
    const entry: StorageEntry = {
      storageId: 'x',
      domain: 'database',
      purpose: 'gone',
      path: '/definitely/does/not/exist/at/all',
      isFile: false,
      encryptionStatus: 'none',
      backupStatus: 'none',
      lifecycleStage: 'allocated',
      createdAt: new Date().toISOString(),
    };
    expect(() => measureCapacity(entry)).toThrow(DirectoryMissingError);
  });

  it('evaluateHealth classifies by threshold', () => {
    const entry: StorageEntry = {
      storageId: 'x',
      domain: 'database',
      purpose: 'p',
      path: '/x',
      isFile: false,
      encryptionStatus: 'none',
      backupStatus: 'none',
      lifecycleStage: 'allocated',
      createdAt: new Date().toISOString(),
    };
    const healthy: CapacitySnapshot = { storageId: 'x', totalBytes: 100, usedBytes: 50, availableBytes: 50, usedPercent: 50, measuredAt: '' };
    const degraded: CapacitySnapshot = { storageId: 'x', totalBytes: 100, usedBytes: 90, availableBytes: 10, usedPercent: 90, measuredAt: '' };
    const critical: CapacitySnapshot = { storageId: 'x', totalBytes: 100, usedBytes: 99, availableBytes: 1, usedPercent: 99, measuredAt: '' };

    expect(evaluateHealth(entry, healthy).status).toBe('healthy');
    expect(evaluateHealth(entry, degraded).status).toBe('degraded');
    expect(evaluateHealth(entry, critical).status).toBe('critical');
    expect(evaluateHealth(entry, critical).reasons.length).toBeGreaterThan(0);
  });
});
