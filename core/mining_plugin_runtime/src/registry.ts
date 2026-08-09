import { DuplicatePluginInstanceError, PluginRuntimeError } from './errors.js';
import type { ManagedPluginRuntime } from './types.js';
/** IMPR's transient working set of instances it is currently executing; this is explicitly not the platform Plugin Registry Authority or an inventory. */
export class PluginRuntimeRegistry {
 private readonly instances = new Map<string, ManagedPluginRuntime>();
 add(instance: ManagedPluginRuntime): ManagedPluginRuntime { if (this.instances.has(instance.identity.pluginInstanceUuid)) throw new DuplicatePluginInstanceError(instance.identity.pluginInstanceUuid); this.instances.set(instance.identity.pluginInstanceUuid, instance); return instance; }
 require(pluginInstanceUuid: string): ManagedPluginRuntime { const result=this.instances.get(pluginInstanceUuid); if (!result) throw new PluginRuntimeError(`No plugin instance ${pluginInstanceUuid} is actively tracked by IMPR.`); return result; }
 get(pluginInstanceUuid: string): ManagedPluginRuntime | undefined { return this.instances.get(pluginInstanceUuid); }
 all(): ManagedPluginRuntime[] { return [...this.instances.values()]; }
 manifests(): ReadonlyArray<import('./types.js').PluginManifest> { return this.all().map((instance) => instance.manifest); }
 remove(pluginInstanceUuid: string): void { this.instances.delete(pluginInstanceUuid); }
}
