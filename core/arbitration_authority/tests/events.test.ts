import { describe, expect, it, vi } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ARBITRATION_EVENTS, type ArbitrationEventName } from '../src/events.js';
import { makeAuthority, makeRequest } from './testHelpers.js';

describe('IRAA arbitration events', () => {
  it('publishes every specified event and mirrors its additive arbitration EventCategory', async () => {
    const institutional = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const authority = makeAuthority({ eventBus: institutional, starvationThresholdMs: 0, providers: { availability: { getAvailability: (_resource, request) => request.requestId === 'denied' ? { available: false, reason: 'offline' } : { available: true, availableCapacity: 3 } } } });
    const handlers = Object.fromEntries(Object.values(ARBITRATION_EVENTS).map((event) => [event, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>;
    for (const [event, handler] of Object.entries(handlers)) authority.subscribe(event as ArbitrationEventName, handler);
    authority.arbitrate([makeRequest({ requestId: 'winner', priority: 2 }), makeRequest({ requestId: 'deferred', owner: 'other', priority: 1 }), makeRequest({ requestId: 'denied', owner: 'denied', priority: 9 })]);
    expect(() => authority.arbitrate([])).toThrow();
    await authority.events.flushMirror();
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalled();
    expect(institutional.getEventDefinitions('arbitration').map((definition) => definition.name)).toEqual(expect.arrayContaining(Object.values(ARBITRATION_EVENTS)));
  });
});
