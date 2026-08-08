import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { DEAD_SUBSCRIBER_THRESHOLD } from '../src/subscriptions.js';
import { makeDefinition } from './testHelpers.js';

describe('subscriber failure isolation (§16 — the bus remains operational)', () => {
  it('a throwing subscriber does not prevent other subscribers from receiving the event', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    bus.subscribeToEvent('E', () => {
      throw new Error('boom');
    }, { subscriberAuthority: 'Failing Subscriber' });

    let received = false;
    bus.subscribeToEvent('E', () => {
      received = true;
    }, { subscriberAuthority: 'Healthy Subscriber' });

    const audit = await bus.publish('E', 'Owner', {});
    expect(received).toBe(true);
    expect(audit.outcome).toBe('partial');
  });

  it('a throwing subscriber does not reject publish() or crash the bus', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    bus.subscribeToEvent('E', () => {
      throw new Error('boom');
    }, { subscriberAuthority: 'Failing Subscriber' });

    await expect(bus.publish('E', 'Owner', {})).resolves.toBeDefined();
  });

  it('outcome is "failed" when every subscriber fails', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    bus.subscribeToEvent('E', () => {
      throw new Error('boom');
    }, { subscriberAuthority: 'A' });
    bus.subscribeToEvent('E', () => {
      throw new Error('boom');
    }, { subscriberAuthority: 'B' });

    const audit = await bus.publish('E', 'Owner', {});
    expect(audit.outcome).toBe('failed');
    expect(audit.subscriberResults.every((r) => !r.success)).toBe(true);
  });

  it('an async-rejecting handler is treated the same as a throwing one', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    bus.subscribeToEvent('E', async () => {
      throw new Error('async boom');
    }, { subscriberAuthority: 'A' });

    const audit = await bus.publish('E', 'Owner', {});
    expect(audit.subscriberResults[0].success).toBe(false);
    expect(audit.subscriberResults[0].error).toMatch(/async boom/);
  });

  it('marks a subscriber dead after consecutive failures and stops delivering to it', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    let callCount = 0;
    bus.subscribeToEvent('E', () => {
      callCount += 1;
      throw new Error('boom');
    }, { subscriberAuthority: 'A' });

    for (let i = 0; i < DEAD_SUBSCRIBER_THRESHOLD + 2; i += 1) {
      await bus.publish('E', 'Owner', {});
    }

    expect(callCount).toBe(DEAD_SUBSCRIBER_THRESHOLD); // no longer invoked once dead
    expect(bus.getMetrics().deadSubscriptions).toBe(1);
  });
});
