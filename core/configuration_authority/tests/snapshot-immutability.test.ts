import { describe, expect, it } from 'vitest';
import { createSnapshot, SnapshotStore } from '../src/snapshot.js';
import { ConfigurationRollbackError } from '../src/errors.js';

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

  it('assigns a content-addressed id (§11 "digitally identify snapshot")', () => {
    const a = createSnapshot({ 'platform.locale': 'en-US' }, 1);
    const b = createSnapshot({ 'platform.locale': 'en-US' }, 2);
    const c = createSnapshot({ 'platform.locale': 'fr-FR' }, 3);
    expect(a.id).toBe(b.id); // same values -> same content hash, regardless of version
    expect(a.id).not.toBe(c.id);
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('SnapshotStore', () => {
  it('activate() makes a snapshot current and retains it in history', () => {
    const store = new SnapshotStore();
    const s1 = createSnapshot({ v: 1 }, 1);
    const s2 = createSnapshot({ v: 2 }, 2);
    store.activate(s1);
    store.activate(s2);
    expect(store.current()).toBe(s2);
    expect(store.all()).toEqual([s1, s2]);
  });

  it('rollbackTo() moves the current pointer without deleting history', () => {
    const store = new SnapshotStore();
    const s1 = createSnapshot({ v: 1 }, 1);
    const s2 = createSnapshot({ v: 2 }, 2);
    store.activate(s1);
    store.activate(s2);

    const restored = store.rollbackTo(1);
    expect(restored).toBe(s1);
    expect(store.current()).toBe(s1);
    expect(store.all()).toHaveLength(2); // s2 still retained, not deleted
  });

  it('a later activate() after rollback appends rather than overwrites history', () => {
    const store = new SnapshotStore();
    const s1 = createSnapshot({ v: 1 }, 1);
    const s2 = createSnapshot({ v: 2 }, 2);
    const s3 = createSnapshot({ v: 3 }, 3);
    store.activate(s1);
    store.activate(s2);
    store.rollbackTo(1);
    store.activate(s3);

    expect(store.current()).toBe(s3);
    expect(store.all()).toEqual([s1, s2, s3]);
  });

  it('rollbackTo() throws for a version not present in history', () => {
    const store = new SnapshotStore();
    store.activate(createSnapshot({}, 1));
    expect(() => store.rollbackTo(99)).toThrow(ConfigurationRollbackError);
  });

  it('findByVersion() locates a snapshot by version', () => {
    const store = new SnapshotStore();
    const s1 = createSnapshot({}, 1);
    store.activate(s1);
    expect(store.findByVersion(1)).toBe(s1);
    expect(store.findByVersion(2)).toBeUndefined();
  });
});
