import { describe, expect, it, vi } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { HealthAuthority } from '../src/HealthAuthority.js';
import { HEALTH_EVENTS, HealthEventBus, type HealthEventName } from '../src/events.js';
import { makeObservation } from './testHelpers.js';

describe('IHIA health events', () => {
  it('publishes and unsubscribes from the local health event surface', () => {
    const bus = new HealthEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(HEALTH_EVENTS.HealthUpdated, handler);
    bus.publish(HEALTH_EVENTS.HealthUpdated, { profileId: 'p-1' });
    unsubscribe();
    bus.publish(HEALTH_EVENTS.HealthUpdated, { profileId: 'p-2' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ profileId: 'p-1' });
  });

  it('publishes all seven specified events and mirrors them under the existing health EventCategory', async () => {
    const institutional = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const authority = new HealthAuthority({ eventBus: institutional, now: () => '2026-08-08T12:00:00.000Z' });
    const handlers = Object.fromEntries(Object.values(HEALTH_EVENTS).map((event) => [event, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>;
    for (const [event, handler] of Object.entries(handlers)) authority.subscribe(event as HealthEventName, handler);

    authority.assess(makeObservation({ observedAt: '2026-08-08T12:00:00.000Z', metrics: { overallScore: 60 } }));
    authority.assess(makeObservation({ observedAt: '2026-08-08T12:01:00.000Z', metrics: { overallScore: 40 } }));
    authority.assess(makeObservation({ observedAt: '2026-08-08T12:02:00.000Z', metrics: { overallScore: 90 } }));
    await authority.events.flushMirror();

    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalled();
    expect(institutional.getEventDefinitions('health').map((definition) => definition.name)).toEqual(expect.arrayContaining(Object.values(HEALTH_EVENTS)));
    expect(institutional.getEventHistory().every((event) => event.eventType in handlers)).toBe(true);
  });
});
