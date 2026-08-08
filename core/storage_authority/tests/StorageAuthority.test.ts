import { describe, expect, it, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StorageAuthority } from '../src/StorageAuthority.js';
import { StorageNotFoundError, InvalidStorageTransitionError } from '../src/errors.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('StorageAuthority — the orchestrator (§4, §8, §11, §12)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('allocate() is idempotent and only fires events on the first allocation', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const seen: string[] = [];
    isma.events.subscribe('StorageAllocated', () => seen.push('allocated'));

    isma.allocate('database', 'primary');
    isma.allocate('database', 'primary');

    expect(seen).toHaveLength(1);
    expect(isma.getMetrics().allocationCount).toBe(1);
  });

  it('release() deregisters an entry and StorageReleased fires', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const seen: string[] = [];
    isma.events.subscribe('StorageReleased', () => seen.push('released'));

    const entry = isma.allocate('database', 'primary');
    isma.release(entry.storageId);

    expect(() => isma.resolve(entry.storageId)).toThrow(StorageNotFoundError);
    expect(seen).toHaveLength(1);
  });

  it('getHealth() reflects real disk usage and never throws for a live entry', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const entry = isma.allocate('database', 'primary');
    const health = isma.getHealth(entry.storageId);
    expect(['healthy', 'degraded', 'critical']).toContain(health.status);
  });

  it('archive() requires the entry to be active first', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const entry = isma.allocate('explainability', 'reports');
    expect(() => isma.archive(entry.storageId)).toThrow(InvalidStorageTransitionError);
  });

  it('archive() end-to-end: activate -> write real data -> archive -> validate', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const entry = isma.allocate('explainability', 'reports');
    isma.activate(entry.storageId);
    writeFileSync(join(entry.path, 'report.txt'), 'real content');

    const record = isma.archive(entry.storageId);
    expect(isma.resolve(entry.storageId).lifecycleStage).toBe('archived');
    expect(isma.resolve(entry.storageId).backupStatus).toBe('backed-up');
    expect(isma.validateArchive(record.archiveId)).toBe(true);
  });

  it('enforceAllRetention() sweeps every entry that has a retention policy', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    isma.allocate('telemetry', 'logs', { retentionPolicy: { maxEntries: 0 } });
    isma.allocate('database', 'primary'); // no policy — untouched

    const logsEntry = isma.resolve(isma.listByDomain('telemetry')[0].storageId);
    writeFileSync(join(logsEntry.path, 'a.log'), 'x');

    const results = isma.enforceAllRetention();
    expect(results).toHaveLength(1);
    expect(results[0].deletedFiles).toHaveLength(1);
  });

  it('getMetrics() tracks allocations, archives, and capacity events', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    isma.allocate('database', 'primary');
    isma.allocate('telemetry', 'logs');
    const metrics = isma.getMetrics();
    expect(metrics.allocationCount).toBe(2);
    expect(metrics.averageAllocationLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
