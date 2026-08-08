import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ResilienceEventBus } from '../src/events.js';
import { RESILIENCE_EVENTS } from '../src/types.js';

describe('ResilienceEventBus (mirror pattern — ADR-0009 §6 / ADR-0017)', () => {
  it('delivers locally without an IEB bus', () => {
    const bus = new ResilienceEventBus();
    const seen: unknown[] = [];
    bus.subscribe(RESILIENCE_EVENTS.BackupStarted, (payload) => {
      seen.push(payload);
    });
    bus.publish(RESILIENCE_EVENTS.BackupStarted, { backupId: 'b1' });
    expect(seen).toEqual([{ backupId: 'b1' }]);
  });

  it('mirrors onto a supplied IEB bus without changing local delivery', async () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const bus = new ResilienceEventBus(ieb);

    const localSeen: unknown[] = [];
    bus.subscribe(RESILIENCE_EVENTS.BackupStarted, (payload) => {
      localSeen.push(payload);
    });

    const mirrorSeen: unknown[] = [];
    ieb.subscribeToEvent(
      RESILIENCE_EVENTS.BackupStarted,
      (envelope) => {
        mirrorSeen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test' },
    );

    bus.publish(RESILIENCE_EVENTS.BackupStarted, { backupId: 'b1' });
    await bus.flushMirror();

    expect(localSeen).toEqual([{ backupId: 'b1' }]);
    expect(mirrorSeen).toEqual([{ backupId: 'b1' }]);
  });

  it('registers the resilience event catalog on the IEB idempotently, under the new "resilience" category', () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    new ResilienceEventBus(ieb);
    new ResilienceEventBus(ieb);
    expect(ieb.getEventDefinition(RESILIENCE_EVENTS.BackupStarted)?.category).toBe('resilience');
  });
});
