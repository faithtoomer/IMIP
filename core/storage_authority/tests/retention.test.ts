import { describe, expect, it, afterEach } from 'vitest';
import { writeFileSync, utimesSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { StorageRegistry } from '../src/registry.js';
import { StorageAllocator } from '../src/allocator.js';
import { enforceRetention } from '../src/retention.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('enforceRetention() (§10 — real retention enforcement on disk)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('deletes files older than maxAgeMs and keeps newer ones', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('telemetry', 'logs', {
      retentionPolicy: { maxAgeMs: 1000 },
    });

    const oldFile = join(entry.path, 'old.log');
    const newFile = join(entry.path, 'new.log');
    writeFileSync(oldFile, 'old');
    writeFileSync(newFile, 'new');
    const old = new Date(Date.now() - 2000);
    utimesSync(oldFile, old, old);

    const result = enforceRetention(entry);

    expect(result.deletedFiles).toContain(oldFile);
    expect(result.deletedFiles).not.toContain(newFile);
    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(newFile)).toBe(true);
    expect(result.reclaimedBytes).toBeGreaterThan(0);
  });

  it('keeps at most maxEntries files, deleting the oldest first', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('telemetry', 'capped', {
      retentionPolicy: { maxEntries: 2 },
    });

    for (let i = 0; i < 4; i += 1) {
      const path = join(entry.path, `f${i}.log`);
      writeFileSync(path, String(i));
      const time = new Date(Date.now() - (4 - i) * 1000);
      utimesSync(path, time, time);
    }

    enforceRetention(entry);
    expect(readdirSync(entry.path)).toHaveLength(2);
    expect(existsSync(join(entry.path, 'f2.log'))).toBe(true);
    expect(existsSync(join(entry.path, 'f3.log'))).toBe(true);
  });

  it('is a no-op for an entry with no retention policy', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('telemetry', 'unmanaged');
    writeFileSync(join(entry.path, 'keep.log'), 'x');
    const result = enforceRetention(entry);
    expect(result.deletedFiles).toHaveLength(0);
  });

  it('is a no-op for a file-backed entry', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('database', 'primary', {
      filename: 'data.db',
      retentionPolicy: { maxAgeMs: 1 },
    });
    writeFileSync(entry.path, 'x');
    const result = enforceRetention(entry);
    expect(result.deletedFiles).toHaveLength(0);
  });
});
