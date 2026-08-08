import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { NotificationEventBus } from '../src/events.js';
import { NOTIFICATION_EVENTS } from '../src/types.js';

describe('NotificationEventBus (mirror pattern — ADR-0009 §6 / ADR-0016)', () => {
  it('delivers locally without an IEB bus', () => {
    const bus = new NotificationEventBus();
    const seen: unknown[] = [];
    bus.subscribe(NOTIFICATION_EVENTS.NotificationGenerated, (payload) => {
      seen.push(payload);
    });
    bus.publish(NOTIFICATION_EVENTS.NotificationGenerated, { notificationId: 'n1' });
    expect(seen).toEqual([{ notificationId: 'n1' }]);
  });

  it('mirrors onto a supplied IEB bus without changing local delivery', async () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const bus = new NotificationEventBus(ieb);

    const localSeen: unknown[] = [];
    bus.subscribe(NOTIFICATION_EVENTS.NotificationGenerated, (payload) => {
      localSeen.push(payload);
    });

    const mirrorSeen: unknown[] = [];
    ieb.subscribeToEvent(
      NOTIFICATION_EVENTS.NotificationGenerated,
      (envelope) => {
        mirrorSeen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test' },
    );

    bus.publish(NOTIFICATION_EVENTS.NotificationGenerated, { notificationId: 'n1' });
    await bus.flushMirror();

    expect(localSeen).toEqual([{ notificationId: 'n1' }]);
    expect(mirrorSeen).toEqual([{ notificationId: 'n1' }]);
  });

  it('registers the notification event catalog on the IEB idempotently, under the reserved "notification" category', () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    new NotificationEventBus(ieb);
    new NotificationEventBus(ieb);
    expect(ieb.getEventDefinition(NOTIFICATION_EVENTS.NotificationGenerated)?.category).toBe('notification');
  });
});
