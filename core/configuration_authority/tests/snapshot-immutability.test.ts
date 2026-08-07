import { describe, expect, it } from 'vitest';
import { createSnapshot } from '../src/snapshot.js';

describe('createSnapshot', () => {
  it('freezes the top-level snapshot object', () => {
    const snapshot = createSnapshot({ 'platform.name': 'IMIP' }, 1);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as unknown as { version: number }).version = 99;
    }).toThrow();
  });

  it('deep-freezes nested values', () => {
    const snapshot = createSnapshot({ 'pools.endpoints': [{ url: 'stratum+tcp://pool:3333' }] }, 1);
    const endpoints = snapshot.values['pools.endpoints'] as Array<{ url: string }>;
    expect(Object.isFrozen(endpoints)).toBe(true);
    expect(Object.isFrozen(endpoints[0])).toBe(true);
    expect(() => {
      endpoints[0].url = 'mutated';
    }).toThrow();
  });

  it('is a structural clone, isolated from the source object', () => {
    const source = { 'platform.name': 'IMIP' };
    const snapshot = createSnapshot(source, 1);
    source['platform.name'] = 'mutated-after-snapshot';
    expect(snapshot.values['platform.name']).toBe('IMIP');
  });

  it('increments version per call as supplied by the caller', () => {
    const s1 = createSnapshot({}, 1);
    const s2 = createSnapshot({}, 2);
    expect(s2.version).toBe(s1.version + 1);
  });
});
