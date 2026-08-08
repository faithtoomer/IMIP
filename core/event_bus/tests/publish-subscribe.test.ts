import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import {
  PayloadValidationError,
  PublisherOwnershipViolationError,
  SubscriberNotAllowedError,
  UnregisteredEventError,
} from '../src/errors.js';
import { makeDefinition } from './testHelpers.js';

describe('publish/subscribe fundamentals', () => {
  it('publish() delivers to a matching event-name subscription', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'ConfigurationChanged', publisherAuthority: 'Configuration Authority' }));

    let received: unknown;
    bus.subscribeToEvent('ConfigurationChanged', (envelope) => {
      received = envelope.payload;
    }, { subscriberAuthority: 'Dashboard' });

    await bus.publish('ConfigurationChanged', 'Configuration Authority', { key: 'platform.locale' });
    expect(received).toEqual({ key: 'platform.locale' });
  });

  it('publish() to an unregistered event throws UnregisteredEventError', async () => {
    const bus = new InstitutionalEventBus();
    await expect(bus.publish('Nope', 'Anyone', {})).rejects.toThrow(UnregisteredEventError);
  });

  it('subscribeToEvent() to an unregistered event throws UnregisteredEventError', () => {
    const bus = new InstitutionalEventBus();
    expect(() => bus.subscribeToEvent('Nope', () => {}, { subscriberAuthority: 'X' })).toThrow(UnregisteredEventError);
  });

  it('Law 2 — only the owning authority may publish an event type', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'ConfigurationChanged', publisherAuthority: 'Configuration Authority' }));
    await expect(bus.publish('ConfigurationChanged', 'Impostor Authority', {})).rejects.toThrow(PublisherOwnershipViolationError);
  });

  it('payload validation rejects an invalid payload before dispatch', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(
      makeDefinition({
        name: 'ConfigurationChanged',
        publisherAuthority: 'Configuration Authority',
        payloadValidator: (payload) => (typeof (payload as { key?: unknown })?.key === 'string' ? null : ['payload.key must be a string']),
      }),
    );
    await expect(bus.publish('ConfigurationChanged', 'Configuration Authority', {})).rejects.toThrow(PayloadValidationError);
  });

  it('allowedSubscribers restricts who may subscribe to an event', () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Restricted', publisherAuthority: 'Owner', allowedSubscribers: ['Approved Subscriber'] }));

    expect(() => bus.subscribeToEvent('Restricted', () => {}, { subscriberAuthority: 'Unapproved Subscriber' })).toThrow(
      SubscriberNotAllowedError,
    );
    expect(() => bus.subscribeToEvent('Restricted', () => {}, { subscriberAuthority: 'Approved Subscriber' })).not.toThrow();
  });

  it('unsubscribe stops further delivery', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    let count = 0;
    const unsubscribe = bus.subscribeToEvent('E', () => {
      count += 1;
    }, { subscriberAuthority: 'Sub' });

    await bus.publish('E', 'Owner', {});
    unsubscribe();
    await bus.publish('E', 'Owner', {});

    expect(count).toBe(1);
  });

  it('category subscriptions receive every event published under that category', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'A', category: 'hardware', publisherAuthority: 'Owner' }));
    bus.registerEventType(makeDefinition({ name: 'B', category: 'hardware', publisherAuthority: 'Owner' }));
    bus.registerEventType(makeDefinition({ name: 'C', category: 'configuration', publisherAuthority: 'Owner' }));

    const seen: string[] = [];
    bus.subscribeToCategory('hardware', (envelope) => { seen.push(envelope.eventType); }, { subscriberAuthority: 'Watcher' });

    await bus.publish('A', 'Owner', {});
    await bus.publish('B', 'Owner', {});
    await bus.publish('C', 'Owner', {});

    expect(seen).toEqual(['A', 'B']);
  });

  it('filtered subscriptions only receive matching envelopes', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    const seen: unknown[] = [];
    bus.subscribeToEvent(
      'E',
      (envelope) => { seen.push(envelope.payload); },
      { subscriberAuthority: 'Sub', filter: (envelope) => (envelope.payload as { urgent?: boolean }).urgent === true },
    );

    await bus.publish('E', 'Owner', { urgent: false });
    await bus.publish('E', 'Owner', { urgent: true });

    expect(seen).toEqual([{ urgent: true }]);
  });
});
