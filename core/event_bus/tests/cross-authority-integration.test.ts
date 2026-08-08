import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../src/InstitutionalEventBus.js';
import { MemoryEventPersistence } from '../src/persistence.js';
import { ConfigurationAuthority } from '../../configuration_authority/src/ConfigurationAuthority.js';
import { HardwareAuthority } from '../../hardware_authority/src/HardwareAuthority.js';
import { FakeDiscoveryProvider } from '../../hardware_authority/tests/testHelpers.js';

/**
 * The actual payoff of ADR-0009's mirror bridge: a consumer that only holds a
 * reference to the shared IEB — not to either authority instance — observes
 * both ICMS's and IHIS's real events. This is Law 3 (loose coupling) actually
 * working, not just declared.
 */
describe('cross-authority observability through the shared IEB', () => {
  it('an independent subscriber with no reference to either authority observes both event streams', async () => {
    const bus = new InstitutionalEventBus();
    const icms = new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });
    const ihis = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });

    const seen: string[] = [];
    bus.subscribeToCategory('configuration', (envelope) => { seen.push(envelope.eventType); }, { subscriberAuthority: 'Independent Observer' });
    bus.subscribeToCategory('hardware', (envelope) => { seen.push(envelope.eventType); }, { subscriberAuthority: 'Independent Observer' });

    icms.load();
    await icms.events.flushMirror();
    await ihis.discover();
    await ihis.events.flushMirror();

    expect(seen).toContain('ConfigurationLoaded');
    expect(seen).toContain('HardwareDiscovered');
  });

  it('the IEB audit trail records both authorities as the correct publisher, never conflated', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const icms = new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });
    const ihis = new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });

    icms.load();
    await icms.events.flushMirror();
    await ihis.discover();
    await ihis.events.flushMirror();

    const configHistory = bus.getEventHistory({ publisher: 'Configuration Authority' });
    const hardwareHistory = bus.getEventHistory({ publisher: 'Hardware Authority' });

    expect(configHistory.every((e) => e.publisher === 'Configuration Authority')).toBe(true);
    expect(hardwareHistory.every((e) => e.publisher === 'Hardware Authority')).toBe(true);
    expect(configHistory.length).toBeGreaterThan(0);
    expect(hardwareHistory.length).toBeGreaterThan(0);
  });

  it('the combined event catalog on one bus contains both authorities\' definitions with no collisions', () => {
    const bus = new InstitutionalEventBus();
    new ConfigurationAuthority({ argv: [], env: {}, eventBus: bus });
    new HardwareAuthority({ discoveryProvider: new FakeDiscoveryProvider(), eventBus: bus });

    const all = bus.getEventDefinitions();
    const names = new Set(all.map((d) => d.name));
    expect(names.size).toBe(all.length); // no duplicate names across the two catalogs
  });
});
