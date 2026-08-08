import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { makeDefinition } from './testHelpers.js';

/** §19/§20 — lightweight performance smoke test, not a benchmarking suite. */
describe('performance smoke tests', () => {
  it('dispatches 500 sequential sync events well under 1s', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner', deliveryMode: 'sync' }));
    bus.subscribeToEvent('E', () => {}, { subscriberAuthority: 'Sub' });

    const start = performance.now();
    for (let i = 0; i < 500; i += 1) {
      await bus.publish('E', 'Owner', { i });
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('fans out to 50 concurrent subscribers without serializing them', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    for (let i = 0; i < 50; i += 1) {
      bus.subscribeToEvent('E', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }, { subscriberAuthority: `Sub-${i}` });
    }

    const start = performance.now();
    const audit = await bus.publish('E', 'Owner', {});
    const elapsed = performance.now() - start;

    expect(audit.subscriberResults).toHaveLength(50);
    expect(elapsed).toBeLessThan(150); // concurrent, not 50 * 5ms serialized
  });
});
