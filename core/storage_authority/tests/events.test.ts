import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { StorageEventBus } from '../src/events.js';
import { STORAGE_EVENTS } from '../src/types.js';

describe('StorageEventBus (mirror pattern — ADR-0009 §6 / ADR-0012)', () => {
  it('delivers locally without an IEB bus', () => {
    const bus = new StorageEventBus();
    const seen: unknown[] = [];
    bus.subscribe(STORAGE_EVENTS.StorageAllocated, (payload) => {
      seen.push(payload);
    });
    bus.publish(STORAGE_EVENTS.StorageAllocated, { storageId: 'x' });
    expect(seen).toEqual([{ storageId: 'x' }]);
  });

  it('mirrors onto a supplied IEB bus without changing local delivery', async () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const bus = new StorageEventBus(ieb);

    const localSeen: unknown[] = [];
    bus.subscribe(STORAGE_EVENTS.StorageAllocated, (payload) => {
      localSeen.push(payload);
    });

    const mirrorSeen: unknown[] = [];
    ieb.subscribeToEvent(
      STORAGE_EVENTS.StorageAllocated,
      (envelope) => {
        mirrorSeen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test Subscriber' },
    );

    bus.publish(STORAGE_EVENTS.StorageAllocated, { storageId: 'x' });
    await bus.flushMirror();

    expect(localSeen).toEqual([{ storageId: 'x' }]);
    expect(mirrorSeen).toEqual([{ storageId: 'x' }]);
  });

  it('registers the storage event catalog on the IEB idempotently', () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    new StorageEventBus(ieb);
    new StorageEventBus(ieb); // constructing twice must not throw a duplicate-registration error
    expect(ieb.getEventDefinition(STORAGE_EVENTS.StorageAllocated)?.category).toBe('storage');
  });
});
