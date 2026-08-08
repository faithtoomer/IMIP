import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { MemoryEventPersistence } from '../src/persistence.js';
import { makeDefinition } from './testHelpers.js';

describe('audit + explainability (§14/§15)', () => {
  it('every audit record answers what/who/outcome/duration/subscriber-results', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Configuration Authority' }));
    bus.subscribeToEvent('E', () => {}, { subscriberAuthority: 'Dashboard' });

    const audit = await bus.publish('E', 'Configuration Authority', { foo: 'bar' }, { causationId: 'root-cause-id' });

    expect(audit).toMatchObject({
      eventType: 'E',
      publisher: 'Configuration Authority',
      causationId: 'root-cause-id',
      outcome: 'completed',
    });
    expect(audit.subscriberResults).toEqual([
      { subscriptionId: expect.any(String), subscriberAuthority: 'Dashboard', success: true, durationMs: expect.any(Number) },
    ]);
    expect(typeof audit.overallDurationMs).toBe('number');
    expect(typeof audit.timestamp).toBe('string');
  });

  it('getAuditRecord() retrieves a previously published event\'s audit by id', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    const audit = await bus.publish('E', 'Owner', {});
    const retrieved = bus.getAuditRecord(audit.eventId);
    expect(retrieved?.eventId).toBe(audit.eventId);
  });

  it('getEventHistory() exposes the persisted envelope stream, filterable by correlationId', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));

    await bus.publish('E', 'Owner', {}, { correlationId: 'chain-1' });
    await bus.publish('E', 'Owner', {}, { correlationId: 'chain-2' });

    expect(bus.getEventHistory({ correlationId: 'chain-1' })).toHaveLength(1);
  });

  it('with the default (Noop) persistence, history is empty but publish() still works', async () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    await bus.publish('E', 'Owner', {});
    expect(bus.getEventHistory()).toEqual([]);
  });

  it('getEventDefinition() / getEventDefinitions() expose the registry for explainability queries', () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', category: 'hardware', publisherAuthority: 'Owner' }));
    expect(bus.getEventDefinition('E')?.category).toBe('hardware');
    expect(bus.getEventDefinitions('hardware')).toHaveLength(1);
    expect(bus.getEventDefinitions('configuration')).toHaveLength(0);
  });

  it('getSubscriptions() exposes who is listening, for a given event or authority', () => {
    const bus = new InstitutionalEventBus();
    bus.registerEventType(makeDefinition({ name: 'E', publisherAuthority: 'Owner' }));
    bus.subscribeToEvent('E', () => {}, { subscriberAuthority: 'Dashboard' });

    expect(bus.getSubscriptions({ selector: 'E' })).toHaveLength(1);
    expect(bus.getSubscriptions({ subscriberAuthority: 'Dashboard' })).toHaveLength(1);
    expect(bus.getSubscriptions({ subscriberAuthority: 'Nobody' })).toHaveLength(0);
  });
});
