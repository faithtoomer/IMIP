import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { VersionEventBus } from '../src/events.js';
import { VERSION_EVENTS } from '../src/types.js';

describe('VersionEventBus (mirror pattern — ADR-0009 §6 / ADR-0018)', () => {
  it('delivers locally without an IEB bus', () => {
    const bus = new VersionEventBus();
    const seen: unknown[] = [];
    bus.subscribe(VERSION_EVENTS.VersionRegistered, (payload) => {
      seen.push(payload);
    });
    bus.publish(VERSION_EVENTS.VersionRegistered, { versionId: 'v1' });
    expect(seen).toEqual([{ versionId: 'v1' }]);
  });

  it('mirrors onto a supplied IEB bus without changing local delivery', async () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const bus = new VersionEventBus(ieb);

    const localSeen: unknown[] = [];
    bus.subscribe(VERSION_EVENTS.VersionRegistered, (payload) => {
      localSeen.push(payload);
    });

    const mirrorSeen: unknown[] = [];
    ieb.subscribeToEvent(
      VERSION_EVENTS.VersionRegistered,
      (envelope) => {
        mirrorSeen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test' },
    );

    bus.publish(VERSION_EVENTS.VersionRegistered, { versionId: 'v1' });
    await bus.flushMirror();

    expect(localSeen).toEqual([{ versionId: 'v1' }]);
    expect(mirrorSeen).toEqual([{ versionId: 'v1' }]);
  });

  it('registers the version-governance event catalog on the IEB idempotently, under the new "version-governance" category', () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    new VersionEventBus(ieb);
    new VersionEventBus(ieb);
    expect(ieb.getEventDefinition(VERSION_EVENTS.VersionRegistered)?.category).toBe('version-governance');
  });

  it('marks MigrationFailed as critical priority in the real registered catalog', () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    new VersionEventBus(ieb);
    expect(ieb.getEventDefinition(VERSION_EVENTS.MigrationFailed)?.priority).toBe('critical');
  });
});
