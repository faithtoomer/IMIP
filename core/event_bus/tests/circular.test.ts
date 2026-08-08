import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { makeDefinition } from './testHelpers.js';

describe('circular publication detection (§16, sync mode)', () => {
  it('a handler re-publishing the same event it is responding to is caught as a failed delivery, not an unhandled crash', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'Loop', publisherAuthority: 'Owner', deliveryMode: 'sync' }));

    bus.subscribeToEvent('Loop', async () => {
      await bus.publish('Loop', 'Owner', {});
    }, { subscriberAuthority: 'Looping Subscriber' });

    const audit = await bus.publish('Loop', 'Owner', {});

    expect(audit.outcome).toBe('failed');
    expect(audit.subscriberResults[0].error).toMatch(/circular publication/i);
  });

  it('an indirect A -> B -> A cycle is caught at the point it closes, without crashing or infinite-looping', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'A', publisherAuthority: 'Owner', deliveryMode: 'sync' }));
    bus.registerEventType(makeDefinition({ name: 'B', publisherAuthority: 'Owner', deliveryMode: 'sync' }));

    let innerAudit: Awaited<ReturnType<typeof bus.publish>> | undefined;
    bus.subscribeToEvent('A', async () => {
      innerAudit = await bus.publish('B', 'Owner', {});
    }, { subscriberAuthority: 'Sub A' });
    bus.subscribeToEvent('B', async () => {
      // This nested publish is where the cycle actually closes — it detects
      // dispatchStack already containing 'A' and fails, but that failure is
      // recorded on B's own audit, not silently re-thrown up to A's audit.
      await bus.publish('A', 'Owner', {});
    }, { subscriberAuthority: 'Sub B' });

    const outerAudit = await bus.publish('A', 'Owner', {});

    expect(outerAudit.outcome).toBe('completed'); // Sub A's handler itself didn't throw
    expect(innerAudit?.outcome).toBe('failed'); // B's dispatch shows the circular failure
    expect(innerAudit?.subscriberResults[0].error).toMatch(/circular publication/i);
  });

  it('non-circular sequential publishes of the same event type are unaffected', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner', deliveryMode: 'sync' }));

    let count = 0;
    bus.subscribeToEvent('E', () => {
      count += 1;
    }, { subscriberAuthority: 'Sub' });

    await bus.publish('E', 'Owner', {});
    await bus.publish('E', 'Owner', {}); // sequential, not nested — not circular

    expect(count).toBe(2);
  });
});
