import { describe, expect, it } from 'vitest';
import { ArbitrationRegistry } from '../src/registry.js';
import { ArbitrationNotFoundError } from '../src/errors.js';
import { makeAuthority, makeRequest } from './testHelpers.js';

describe('IRAA Arbitration Registry', () => {
  it('records UUID-shaped arbitration evidence, decision details, and history by contested resource', () => {
    const authority = makeAuthority();
    const decision = authority.arbitrate([makeRequest(), makeRequest({ requestId: 'request-b', owner: 'owner-b', priority: 2 })]);
    const record = authority.registry.require(decision.arbitrationId);
    expect(record.arbitrationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(record).toMatchObject({ contestedResource: 'gpu-001', winningRequestId: 'request-b', decisionScore: expect.any(Number), stage: 'history-archived' });
    expect(record.competingRequests).toHaveLength(2);
    expect(record.policiesApplied).toHaveLength(8);
    expect(authority.registry.forResource('gpu-001')).toHaveLength(1);
    expect(authority.getDecision(decision.arbitrationId)).toEqual(decision);
  });
  it('supports upsert, ordered reads, and missing-record validation', () => {
    const registry = new ArbitrationRegistry();
    registry.upsert({ arbitrationId: 'b', timestamp: '2026-08-08T20:01:00.000Z', contestedResource: 'gpu', competingRequests: [], stage: 'request-received', deferredRequests: [], policiesApplied: [] });
    registry.upsert({ arbitrationId: 'a', timestamp: '2026-08-08T20:00:00.000Z', contestedResource: 'cpu', competingRequests: [], stage: 'request-received', deferredRequests: [], policiesApplied: [] });
    expect(registry.all().map((record) => record.arbitrationId)).toEqual(['a', 'b']);
    expect(registry.remove('b')).toBe(true);
    expect(registry.get('b')).toBeUndefined();
    expect(() => registry.require('missing')).toThrow(ArbitrationNotFoundError);
  });
});
