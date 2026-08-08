import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ConfigurationAuthority } from '../src/ConfigurationAuthority.js';
import { CONFIG_EVENTS } from '../src/events.js';

describe('ICMS <-> IEB mirror (PHASE-05, ADR-0009)', () => {
  it('without an eventBus option, behaves exactly as before — no IEB interaction, no errors', () => {
    const authority = new ConfigurationAuthority({ argv: [], env: {} });
    expect(() => authority.load()).not.toThrow();

    let received: unknown;
    authority.events.subscribe(CONFIG_EVENTS.Loaded, (payload) => {
      received = payload;
    });
    authority.reload();
    expect(received).toBeDefined();
  });

  it('registers the full ICMS event catalog on the shared IEB, owned by Configuration Authority', () => {
    const bus = new InstitutionalEventBus();
    new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });

    const definitions = bus.getEventDefinitions('configuration');
    expect(definitions.length).toBe(Object.keys(CONFIG_EVENTS).length);
    expect(definitions.every((d) => d.publisherAuthority === 'Configuration Authority')).toBe(true);
  });

  it('local synchronous delivery is completely unaffected by mirroring', () => {
    const bus = new InstitutionalEventBus();
    const authority = new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });

    let localReceived = false;
    authority.events.subscribe(CONFIG_EVENTS.Loaded, () => {
      localReceived = true;
    });

    authority.load(); // still fully synchronous — no await anywhere
    expect(localReceived).toBe(true);
  });

  it('mirrors a published event onto the IEB, queryable via getEventHistory()', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const authority = new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });

    authority.load();
    await authority.events.flushMirror();

    const history = bus.getEventHistory({ eventType: CONFIG_EVENTS.Loaded });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].publisher).toBe('Configuration Authority');
  });

  it('two ConfigurationAuthority instances sharing one bus do not collide on event registration', () => {
    const bus = new InstitutionalEventBus();
    expect(() => {
      new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });
      new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });
    }).not.toThrow();
    expect(bus.getEventDefinitions('configuration').length).toBe(Object.keys(CONFIG_EVENTS).length);
  });

  it('a mirror failure (e.g. a saturated IEB queue) never propagates back to the local publish() call', async () => {
    // maxQueueSize: 0 guarantees every mirrored (async-mode) publish throws
    // QueueOverflowError the instant it's enqueued — a real, deterministic failure.
    const bus = new InstitutionalEventBus({ maxQueueSize: 0 });
    const authority = new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });

    let localReceived = false;
    authority.events.subscribe(CONFIG_EVENTS.Loaded, () => {
      localReceived = true;
    });

    expect(() => authority.load()).not.toThrow();
    expect(localReceived).toBe(true); // local delivery succeeded despite the mirror failing
    await expect(authority.events.flushMirror()).resolves.toBeUndefined(); // .catch() swallowed it
  });
});
