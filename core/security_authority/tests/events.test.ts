import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { SecurityEventBus } from '../src/events.js';
import { SECURITY_EVENTS } from '../src/types.js';

describe('SecurityEventBus (mirror pattern — ADR-0009 §6 / ADR-0015)', () => {
  it('delivers locally without an IEB bus', () => {
    const bus = new SecurityEventBus();
    const seen: unknown[] = [];
    bus.subscribe(SECURITY_EVENTS.TrustEstablished, (payload) => {
      seen.push(payload);
    });
    bus.publish(SECURITY_EVENTS.TrustEstablished, { componentId: 'x' });
    expect(seen).toEqual([{ componentId: 'x' }]);
  });

  it('mirrors onto a supplied IEB bus without changing local delivery', async () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const bus = new SecurityEventBus(ieb);

    const localSeen: unknown[] = [];
    bus.subscribe(SECURITY_EVENTS.TrustEstablished, (payload) => {
      localSeen.push(payload);
    });

    const mirrorSeen: unknown[] = [];
    ieb.subscribeToEvent(
      SECURITY_EVENTS.TrustEstablished,
      (envelope) => {
        mirrorSeen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test' },
    );

    bus.publish(SECURITY_EVENTS.TrustEstablished, { componentId: 'x' });
    await bus.flushMirror();

    expect(localSeen).toEqual([{ componentId: 'x' }]);
    expect(mirrorSeen).toEqual([{ componentId: 'x' }]);
  });

  it('registers the security event catalog on the IEB idempotently, under the reserved "security" category', () => {
    const ieb = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    new SecurityEventBus(ieb);
    new SecurityEventBus(ieb);
    expect(ieb.getEventDefinition(SECURITY_EVENTS.TrustEstablished)?.category).toBe('security');
  });
});
