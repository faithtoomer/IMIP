import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { HardwareAuthority } from '../src/HardwareAuthority.js';
import { HARDWARE_EVENTS } from '../src/events.js';
import { FakeDiscoveryProvider } from './testHelpers.js';

describe('IHIS <-> IEB mirror (PHASE-05, ADR-0009)', () => {
  it('without an eventBus option, behaves exactly as before — no IEB interaction, no errors', async () => {
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider() });
    await expect(authority.discover()).resolves.toBeDefined();
  });

  it('registers the full IHIS event catalog on the shared IEB, owned by Hardware Authority', () => {
    const bus = new InstitutionalEventBus();
    new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });

    const definitions = bus.getEventDefinitions('hardware');
    expect(definitions.length).toBe(Object.keys(HARDWARE_EVENTS).length);
    expect(definitions.every((d) => d.publisherAuthority === 'Hardware Authority')).toBe(true);
  });

  it('HardwareFaultDetected is registered at high priority on the IEB', () => {
    const bus = new InstitutionalEventBus();
    new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });
    expect(bus.getEventDefinition(HARDWARE_EVENTS.HardwareFaultDetected)?.priority).toBe('high');
  });

  it('local synchronous discovery is unaffected by mirroring', async () => {
    const bus = new InstitutionalEventBus();
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });

    let localReceived = false;
    authority.events.subscribe(HARDWARE_EVENTS.Discovered, () => {
      localReceived = true;
    });

    await authority.discover();
    expect(localReceived).toBe(true);
  });

  it('mirrors published events onto the IEB, queryable via getEventHistory()', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const authority = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });

    await authority.discover();
    await authority.events.flushMirror();

    const history = bus.getEventHistory({ eventType: HARDWARE_EVENTS.Discovered });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].publisher).toBe('Hardware Authority');
  });

  it('two HardwareAuthority instances sharing one bus do not collide on event registration', () => {
    const bus = new InstitutionalEventBus();
    expect(() => {
      new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });
      new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });
    }).not.toThrow();
    expect(bus.getEventDefinitions('hardware').length).toBe(Object.keys(HARDWARE_EVENTS).length);
  });
});
