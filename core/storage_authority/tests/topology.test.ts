import { describe, expect, it, afterEach } from 'vitest';
import { StorageAuthority } from '../src/StorageAuthority.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('StorageTopology (§22 — the Institutional Storage Topology)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('describe() maps every registered entry into its domain group with capacity + health', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    isma.allocate('database', 'primary');
    isma.allocate('telemetry', 'logs');

    const snapshot = isma.topology.describe();
    expect(Object.keys(snapshot.domains).sort()).toEqual(['database', 'telemetry']);
    expect(snapshot.domains.database[0].capacity?.totalBytes).toBeGreaterThan(0);
    expect(snapshot.domains.database[0].health?.status).toBeDefined();
  });

  it('byDomain() filters correctly', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    isma.allocate('database', 'primary');
    isma.allocate('database', 'secondary');
    isma.allocate('ai', 'models');

    expect(isma.topology.byDomain('database')).toHaveLength(2);
    expect(isma.topology.byDomain('ai')).toHaveLength(1);
    expect(isma.topology.byDomain('plugins')).toHaveLength(0);
  });

  it('whyDegraded() returns an explanatory message for an unknown storageId', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    expect(isma.topology.whyDegraded('nonexistent')[0]).toMatch(/No storage entry/);
  });

  it('whyDegraded() is empty for a healthy entry', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    const entry = isma.allocate('database', 'primary');
    expect(isma.topology.whyDegraded(entry.storageId)).toEqual([]);
  });

  it('capacitySummary() sums distinct-volume capacity without throwing', () => {
    root = makeTempRoot();
    const isma = new StorageAuthority({ rootPath: root });
    isma.allocate('database', 'primary');
    isma.allocate('telemetry', 'logs');

    const summary = isma.topology.capacitySummary();
    expect(summary.totalBytes).toBeGreaterThan(0);
  });
});
