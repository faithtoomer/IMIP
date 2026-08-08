import { describe, expect, it } from 'vitest';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoopEventPersistence, MemoryEventPersistence, FileEventPersistence } from '../src/persistence.js';
import { makeEnvelope } from './testHelpers.js';
import type { EventAuditRecord } from '../src/types.js';

function makeAudit(overrides: Partial<EventAuditRecord> = {}): EventAuditRecord {
  return {
    eventId: 'e1',
    eventType: 'TestEvent',
    publisher: 'Test Authority',
    timestamp: new Date().toISOString(),
    correlationId: 'e1',
    subscriberResults: [],
    overallDurationMs: 1,
    outcome: 'no-subscribers',
    ...overrides,
  };
}

describe('NoopEventPersistence (mode: none)', () => {
  it('records nothing and returns empty history', () => {
    const persistence = new NoopEventPersistence();
    persistence.record(makeEnvelope(), makeAudit());
    expect(persistence.history()).toEqual([]);
    expect(persistence.getAudit('e1')).toBeUndefined();
  });
});

describe('MemoryEventPersistence (mode: memory)', () => {
  it('records and retrieves history and audit records', () => {
    const persistence = new MemoryEventPersistence();
    const envelope = makeEnvelope({ eventId: 'e1' });
    persistence.record(envelope, makeAudit({ eventId: 'e1' }));

    expect(persistence.history()).toEqual([envelope]);
    expect(persistence.getAudit('e1')?.eventId).toBe('e1');
  });

  it('filters history by eventType, publisher, correlationId, and since', () => {
    const persistence = new MemoryEventPersistence();
    persistence.record(makeEnvelope({ eventId: 'a', eventType: 'Foo', publisher: 'X', timestamp: '2026-01-01T00:00:00.000Z' }), makeAudit({ eventId: 'a' }));
    persistence.record(makeEnvelope({ eventId: 'b', eventType: 'Bar', publisher: 'Y', timestamp: '2026-01-02T00:00:00.000Z' }), makeAudit({ eventId: 'b' }));

    expect(persistence.history({ eventType: 'Foo' }).map((e) => e.eventId)).toEqual(['a']);
    expect(persistence.history({ publisher: 'Y' }).map((e) => e.eventId)).toEqual(['b']);
    expect(persistence.history({ since: '2026-01-02T00:00:00.000Z' }).map((e) => e.eventId)).toEqual(['b']);
  });

  it('is a bounded ring buffer — oldest entries drop once maxSize is exceeded', () => {
    const persistence = new MemoryEventPersistence(2);
    persistence.record(makeEnvelope({ eventId: 'a' }), makeAudit({ eventId: 'a' }));
    persistence.record(makeEnvelope({ eventId: 'b' }), makeAudit({ eventId: 'b' }));
    persistence.record(makeEnvelope({ eventId: 'c' }), makeAudit({ eventId: 'c' }));

    expect(persistence.history().map((e) => e.eventId)).toEqual(['b', 'c']);
  });
});

describe('FileEventPersistence (mode: file)', () => {
  it('appends and reads back records', () => {
    const filePath = join(tmpdir(), `imip-events-${Date.now()}.jsonl`);
    try {
      const persistence = new FileEventPersistence(filePath);
      persistence.record(makeEnvelope({ eventId: 'a' }), makeAudit({ eventId: 'a' }));
      persistence.record(makeEnvelope({ eventId: 'b' }), makeAudit({ eventId: 'b' }));

      expect(persistence.history().map((e) => e.eventId)).toEqual(['a', 'b']);
      expect(persistence.getAudit('b')?.eventId).toBe('b');
    } finally {
      unlinkSync(filePath);
    }
  });

  it('returns empty history when the file does not exist yet', () => {
    const filePath = join(tmpdir(), `imip-events-missing-${Date.now()}.jsonl`);
    const persistence = new FileEventPersistence(filePath);
    expect(persistence.history()).toEqual([]);
  });
});
