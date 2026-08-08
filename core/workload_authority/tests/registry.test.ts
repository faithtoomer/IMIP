import { describe, expect, it } from 'vitest';
import { WorkloadRegistry } from '../src/registry.js';
import { WorkloadNotFoundError } from '../src/errors.js';
import { makeAuthority, makeRequest } from './testHelpers.js';

const profile = (id = 'workload-001', overrides: Record<string, unknown> = {}) => ({
  workloadId: id,
  type: 'ai-inference' as const,
  owner: 'owner',
  state: 'created' as const,
  assignedResources: [],
  runtimeState: 'not-started' as const,
  estimatedDurationMs: 1_000,
  priority: 50,
  priorityReason: 'test',
  dependencies: [],
  resourceRequirements: {},
  powerProfile: {},
  thermalProfile: {},
  historicalPerformance: { completedRuns: 0, failedRuns: 0, successRate: 0 },
  createdReason: 'test',
  createdAt: '2026-08-08T12:00:00.000Z',
  lastUpdated: '2026-08-08T12:00:00.000Z',
  ...overrides,
});

describe('WorkloadRegistry', () => {
  it('upsert() registers a workload and keeps UUID ordering', () => {
    const registry = new WorkloadRegistry();
    registry.upsert(profile('z-workload'));
    registry.upsert(profile('a-workload'));
    expect(registry.ids()).toEqual(['a-workload', 'z-workload']);
  });

  it('upsert() updates rather than duplicates', () => {
    const registry = new WorkloadRegistry();
    registry.upsert(profile());
    registry.upsert(profile('workload-001', { state: 'queued' }));
    expect(registry.all()).toHaveLength(1);
    expect(registry.require('workload-001').state).toBe('queued');
  });

  it('require() rejects an unknown workload', () => {
    expect(() => new WorkloadRegistry().require('absent')).toThrow(WorkloadNotFoundError);
  });

  it('filters by type, state, owner, and dependency', () => {
    const registry = new WorkloadRegistry();
    registry.upsert(profile('a', { type: 'gpu-mining', owner: 'alice', dependencies: ['base'] }));
    registry.upsert(profile('b', { type: 'diagnostics', owner: 'bob', state: 'queued' }));
    expect(registry.byType('gpu-mining').map((item) => item.workloadId)).toEqual(['a']);
    expect(registry.byState('queued').map((item) => item.workloadId)).toEqual(['b']);
    expect(registry.byOwner('alice').map((item) => item.workloadId)).toEqual(['a']);
    expect(registry.dependentOn('base').map((item) => item.workloadId)).toEqual(['a']);
  });

  it('removes workload records', () => {
    const registry = new WorkloadRegistry();
    registry.upsert(profile());
    expect(registry.remove('workload-001')).toBe(true);
    expect(registry.all()).toEqual([]);
  });
});

describe('Workload Authority registry ownership', () => {
  it('creates an authoritative workload profile with all registry fields', () => {
    const authority = makeAuthority();
    const workload = authority.createWorkload(makeRequest());
    expect(authority.getWorkload(workload.workloadId)).toMatchObject({
      workloadId: 'workload-001',
      state: 'created',
      type: 'ai-inference',
      owner: 'institutional-operator',
      priority: 70,
      runtimeState: 'not-started',
      assignedResources: [],
    });
    expect(workload.resourceRequirements.capabilityRefs).toEqual(['ai-inference']);
    expect(workload.powerProfile.reference).toBe('power-profile-1');
    expect(workload.thermalProfile.reference).toBe('thermal-profile-1');
  });

  it('generates a UUID when one is not supplied', () => {
    const authority = makeAuthority();
    const workload = authority.createWorkload(makeRequest({ workloadId: undefined }));
    expect(workload.workloadId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects duplicate UUIDs and invalid registry inputs', () => {
    const authority = makeAuthority();
    authority.createWorkload(makeRequest());
    expect(() => authority.createWorkload(makeRequest())).toThrow(/already exists/);
    expect(() => authority.createWorkload(makeRequest({ owner: '', workloadId: 'other' }))).toThrow(/owner/);
    expect(() => authority.createWorkload(makeRequest({ estimatedDurationMs: 0, workloadId: 'other-2' }))).toThrow(/duration/);
  });
});
