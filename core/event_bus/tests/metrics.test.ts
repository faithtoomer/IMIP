import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { makeDefinition } from './testHelpers.js';

describe('getMetrics() (§19 — Telemetry Authority read surface)', () => {
  it('tracks totalPublished and totalDispatched', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    await bus.publish('E', 'Owner', {});
    await bus.publish('E', 'Owner', {});

    const metrics = bus.getMetrics();
    expect(metrics.totalPublished).toBe(2);
    expect(metrics.totalDispatched).toBe(2);
  });

  it('tracks totalFailedDeliveries across subscriber failures', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    bus.subscribeToEvent('E', () => {
      throw new Error('boom');
    }, { subscriberAuthority: 'Failing' });

    await bus.publish('E', 'Owner', {});
    expect(bus.getMetrics().totalFailedDeliveries).toBe(1);
  });

  it('queueDepth reflects pending async events', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner', deliveryMode: 'async' }));
    expect(bus.getMetrics().queueDepth).toBe(0);
    await bus.publish('E', 'Owner', {});
    expect(bus.getMetrics().queueDepth).toBe(0); // drained by the time publish() resolves
  });

  it('averageDispatchMs is a non-negative number once at least one event has dispatched', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    expect(bus.getMetrics().averageDispatchMs).toBe(0);
    await bus.publish('E', 'Owner', {});
    expect(bus.getMetrics().averageDispatchMs).toBeGreaterThanOrEqual(0);
  });
});
