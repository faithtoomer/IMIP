import type { MiningPluginRuntimeDependencies } from './providers.js';
import type { PluginRuntimeContext } from './types.js';
/** Builds a fresh, frozen ten-slot context; no registry, process manager, filesystem, or other plugin state crosses this boundary. */
export function createPluginRuntimeContext(_pluginInstanceUuid: string, dependencies: MiningPluginRuntimeDependencies): PluginRuntimeContext {
  return Object.freeze({ configuration: dependencies.configuration, eventBus: dependencies.eventBus, resources: dependencies.resources, hardwareIntelligence: dependencies.hardwareIntelligence, power: dependencies.power, thermal: dependencies.thermal, health: dependencies.health, statistics: dependencies.statistics, miningFrameworks: dependencies.miningFrameworks, security: dependencies.security });
}
