import { describe, expect, it, vi } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { CERTIFICATION_EVENTS, type CertificationEventName } from '../src/events.js';
import { fullEvidence, makeAuthority, makeClock, makeRequest, providersFromEvidence } from './testHelpers.js';

describe('IHCA certification events', () => {
  it('publishes every specified event and mirrors its additive certification EventCategory', async () => {
    const clock = makeClock();
    let evidence = fullEvidence(100, '1');
    const institutional = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const authority = makeAuthority({
      eventBus: institutional,
      now: clock.now,
      providers: providersFromEvidence(() => evidence),
    });
    const handlers = Object.fromEntries(Object.values(CERTIFICATION_EVENTS)
      .map((event) => [event, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>;
    for (const [event, handler] of Object.entries(handlers)) authority.subscribe(event as CertificationEventName, handler);

    const passing = authority.start(makeRequest({ expirationDate: '2026-08-08T20:00:00.000Z', recertificationIntervalDays: 1 }));
    authority.evaluate(passing.certificationId);
    authority.qualify(passing.certificationId);
    authority.certify(passing.certificationId);
    authority.approveProduction(passing.certificationId);
    authority.recordRecertificationRequired(passing.certificationId, '2026-08-09T20:00:00.000Z');
    authority.expire(passing.certificationId);
    authority.revoke(passing.certificationId, 'external operational degradation');

    evidence = fullEvidence(0, '2');
    const failing = authority.start(makeRequest({ hardwareUuid: 'hardware-002' }));
    authority.evaluate(failing.certificationId);
    await authority.events.flushMirror();

    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalled();
    expect(institutional.getEventDefinitions('certification').map((definition) => definition.name))
      .toEqual(expect.arrayContaining(Object.values(CERTIFICATION_EVENTS)));
  });
});
