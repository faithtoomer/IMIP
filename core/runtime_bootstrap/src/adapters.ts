import { InstitutionalEventBus, type InstitutionalEventBusOptions } from '../../event_bus/src/index.js';
import { ConfigurationAuthority, type ConfigurationAuthorityOptions } from '../../configuration_authority/src/ConfigurationAuthority.js';
import { HardwareAuthority, type HardwareAuthorityOptions } from '../../hardware_authority/src/HardwareAuthority.js';
import type { ComponentDefinition } from './types.js';

export const EVENT_BUS_COMPONENT_NAME = 'Institutional Event Bus';
export const CONFIGURATION_AUTHORITY_COMPONENT_NAME = 'Configuration Authority';
export const HARDWARE_AUTHORITY_COMPONENT_NAME = 'Hardware Authority';

/**
 * §5/§9 — adapters wrapping the three authorities that actually exist today
 * (Phases 02/03/05) into the generic ComponentDefinition contract, without
 * modifying any of their source. Capability Registry, Plugin Registry, and
 * Policy Authority have no adapters here because there is nothing to adapt —
 * they remain reserved (ADR-0002, ADR-0004). The moment they're implemented,
 * they register the same way, in the correct dependency-resolved position,
 * with zero change to the orchestrator itself.
 */

/** Wraps an already-constructed bus (see RuntimeOrchestrator — it needs a bus
 * to publish its own events from the moment it's constructed, so the bus is
 * created by the caller, not by this component's `create`). */
export function eventBusComponent(bus: InstitutionalEventBus): ComponentDefinition<InstitutionalEventBus> {
  return {
    name: EVENT_BUS_COMPONENT_NAME,
    dependencies: [],
    create: () => bus,
    initialize: async () => {},
    checkReadiness: () => ({ ready: true, reasons: [] }),
    checkHealth: (instance) => {
      const metrics = instance.getMetrics();
      return metrics.deadSubscriptions > 0
        ? { status: 'degraded', reasons: [`${metrics.deadSubscriptions} dead subscription(s) on the bus.`] }
        : { status: 'healthy', reasons: [] };
    },
    shutdown: async () => {},
  };
}

export function configurationAuthorityComponent(
  options: Omit<ConfigurationAuthorityOptions, 'eventBus'> = {},
): ComponentDefinition<ConfigurationAuthority> {
  return {
    name: CONFIGURATION_AUTHORITY_COMPONENT_NAME,
    dependencies: [EVENT_BUS_COMPONENT_NAME],
    create: (deps) =>
      new ConfigurationAuthority({ ...options, eventBus: deps.get(EVENT_BUS_COMPONENT_NAME) as InstitutionalEventBus }),
    initialize: async (instance) => {
      instance.load();
    },
    checkReadiness: (instance) => {
      try {
        instance.getSnapshot();
        return { ready: true, reasons: [] };
      } catch {
        return { ready: false, reasons: ['Configuration Authority has not successfully loaded a snapshot.'] };
      }
    },
    checkHealth: (instance) => {
      try {
        instance.getSnapshot();
        return { status: 'healthy', reasons: [] };
      } catch {
        return { status: 'faulted', reasons: ['No active configuration snapshot.'] };
      }
    },
    shutdown: async () => {},
  };
}

export function hardwareAuthorityComponent(
  options: Omit<HardwareAuthorityOptions, 'eventBus'> = {},
): ComponentDefinition<HardwareAuthority> {
  return {
    name: HARDWARE_AUTHORITY_COMPONENT_NAME,
    dependencies: [EVENT_BUS_COMPONENT_NAME],
    create: (deps) =>
      new HardwareAuthority({ ...options, eventBus: deps.get(EVENT_BUS_COMPONENT_NAME) as InstitutionalEventBus }),
    initialize: async (instance) => {
      await instance.discover();
    },
    checkReadiness: (instance) => {
      const discovered = instance.getDiscoveryHistory().length > 0;
      return discovered ? { ready: true, reasons: [] } : { ready: false, reasons: ['No discovery has completed yet.'] };
    },
    checkHealth: (instance) => {
      const issues = instance.checkIntegrity();
      return issues.length === 0
        ? { status: 'healthy', reasons: [] }
        : { status: 'degraded', reasons: issues.map((issue) => issue.issue) };
    },
    shutdown: async () => {},
  };
}

export type { InstitutionalEventBusOptions };
