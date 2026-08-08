import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { FakeDiscoveryProvider } from '../../hardware_authority/tests/testHelpers.js';
import {
  configurationAuthorityComponent,
  eventBusComponent,
  hardwareAuthorityComponent,
} from '../src/adapters.js';

describe('adapters wrapping the three real authorities (§9)', () => {
  it('eventBusComponent wraps an already-constructed bus without recreating it', () => {
    const bus = new InstitutionalEventBus();
    const definition = eventBusComponent(bus);
    expect(definition.create(new Map())).toBe(bus);
    expect(definition.checkReadiness(bus)).toEqual({ ready: true, reasons: [] });
  });

  it('configurationAuthorityComponent creates, initializes, and reports readiness for a real ConfigurationAuthority', async () => {
    const bus = new InstitutionalEventBus();
    const definition = configurationAuthorityComponent({ argv: [], env: {} });
    const deps = new Map([['Institutional Event Bus', bus]]);

    const instance = await definition.create(deps);
    expect(() => definition.checkReadiness(instance)).not.toThrow();
    expect(definition.checkReadiness(instance).ready).toBe(false); // not loaded yet

    await definition.initialize(instance, deps);
    expect(definition.checkReadiness(instance).ready).toBe(true);
    expect(definition.checkHealth(instance).status).toBe('healthy');
  });

  it('hardwareAuthorityComponent creates, initializes, and reports readiness for a real HardwareAuthority', async () => {
    const bus = new InstitutionalEventBus();
    const definition = hardwareAuthorityComponent({ discoveryProvider: new FakeDiscoveryProvider() });
    const deps = new Map([['Institutional Event Bus', bus]]);

    const instance = await definition.create(deps);
    expect(definition.checkReadiness(instance).ready).toBe(false); // no discovery yet

    await definition.initialize(instance, deps);
    expect(definition.checkReadiness(instance).ready).toBe(true);
    expect(definition.checkHealth(instance).status).toBe('healthy');
  });

  it('both authority adapters declare a dependency on the Institutional Event Bus', () => {
    expect(configurationAuthorityComponent().dependencies).toEqual(['Institutional Event Bus']);
    expect(hardwareAuthorityComponent().dependencies).toEqual(['Institutional Event Bus']);
  });
});
