import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { MissingTargetAuthoritiesError } from '../src/errors.js';
import { makeDefinition } from './testHelpers.js';

describe('delivery modes (§10)', () => {
  it('sync delivery completes before publish() resolves', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Sync', publisherAuthority: 'Owner', deliveryMode: 'sync' }));

    let handled = false;
    bus.subscribeToEvent('Sync', () => {
      handled = true;
    }, { subscriberAuthority: 'Sub' });

    const audit = await bus.publish('Sync', 'Owner', {});
    expect(handled).toBe(true);
    expect(audit.outcome).toBe('completed');
  });

  it('async delivery also resolves once dispatch completes, via the priority queue', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Async', publisherAuthority: 'Owner', deliveryMode: 'async' }));

    let handled = false;
    bus.subscribeToEvent('Async', () => {
      handled = true;
    }, { subscriberAuthority: 'Sub' });

    const audit = await bus.publish('Async', 'Owner', {});
    expect(handled).toBe(true);
    expect(audit.outcome).toBe('completed');
  });

  it('async events dispatch in priority order across concurrently pending publishes', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Low', publisherAuthority: 'Owner', deliveryMode: 'async', priority: 'low' }));
    bus.registerEventType(makeDefinition({ name: 'Critical', publisherAuthority: 'Owner', deliveryMode: 'async', priority: 'critical' }));

    const order: string[] = [];
    bus.subscribeToEvent('Low', (e) => { order.push(e.eventType); }, { subscriberAuthority: 'Sub' });
    bus.subscribeToEvent('Critical', (e) => { order.push(e.eventType); }, { subscriberAuthority: 'Sub' });

    // Fire both without awaiting individually so they queue together before draining.
    const p1 = bus.publish('Low', 'Owner', {});
    const p2 = bus.publish('Critical', 'Owner', {});
    await Promise.all([p1, p2]);

    expect(order).toEqual(['Critical', 'Low']);
  });

  it('broadcast targeting delivers to every matching subscriber', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Broadcast', publisherAuthority: 'Owner', targeting: 'broadcast' }));

    const seen: string[] = [];
    bus.subscribeToEvent('Broadcast', () => { seen.push('A'); }, { subscriberAuthority: 'A' });
    bus.subscribeToEvent('Broadcast', () => { seen.push('B'); }, { subscriberAuthority: 'B' });

    await bus.publish('Broadcast', 'Owner', {});
    expect(seen.sort()).toEqual(['A', 'B']);
  });

  it('directed targeting delivers only to listed target authorities', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Directed', publisherAuthority: 'Owner', targeting: 'directed' }));

    const seen: string[] = [];
    bus.subscribeToEvent('Directed', () => { seen.push('A'); }, { subscriberAuthority: 'A' });
    bus.subscribeToEvent('Directed', () => { seen.push('B'); }, { subscriberAuthority: 'B' });

    await bus.publish('Directed', 'Owner', {}, { targetAuthorities: ['B'] });
    expect(seen).toEqual(['B']);
  });

  it('directed events require at least one target authority', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Directed', publisherAuthority: 'Owner', targeting: 'directed' }));
    await expect(bus.publish('Directed', 'Owner', {})).rejects.toThrow(MissingTargetAuthoritiesError);
  });

  it('an event with zero subscribers still completes with outcome "no-subscribers"', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Lonely', publisherAuthority: 'Owner' }));
    const audit = await bus.publish('Lonely', 'Owner', {});
    expect(audit.outcome).toBe('no-subscribers');
    expect(audit.subscriberResults).toEqual([]);
  });
});
