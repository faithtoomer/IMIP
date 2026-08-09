import { PluginLifecycleError } from './errors.js';
import { PluginRuntimeLifecycleStage } from './types.js';
export const PLUGIN_RUNTIME_NOMINAL_LIFECYCLE: readonly PluginRuntimeLifecycleStage[] = Object.freeze([PluginRuntimeLifecycleStage.Discovered, PluginRuntimeLifecycleStage.Validated, PluginRuntimeLifecycleStage.Loaded, PluginRuntimeLifecycleStage.Initialized, PluginRuntimeLifecycleStage.Ready, PluginRuntimeLifecycleStage.Active, PluginRuntimeLifecycleStage.Paused, PluginRuntimeLifecycleStage.Stopping, PluginRuntimeLifecycleStage.Stopped, PluginRuntimeLifecycleStage.Unloaded]);
export const PLUGIN_RUNTIME_LIFECYCLE_TRANSITIONS: Readonly<Record<PluginRuntimeLifecycleStage, readonly PluginRuntimeLifecycleStage[]>> = Object.freeze({
 [PluginRuntimeLifecycleStage.Discovered]: [PluginRuntimeLifecycleStage.Validated, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Validated]: [PluginRuntimeLifecycleStage.Loaded, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Loaded]: [PluginRuntimeLifecycleStage.Initialized, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Initialized]: [PluginRuntimeLifecycleStage.Ready, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Ready]: [PluginRuntimeLifecycleStage.Active, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Active]: [PluginRuntimeLifecycleStage.Paused, PluginRuntimeLifecycleStage.Stopping, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Paused]: [PluginRuntimeLifecycleStage.Active, PluginRuntimeLifecycleStage.Stopping, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Stopping]: [PluginRuntimeLifecycleStage.Stopped, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Stopped]: [PluginRuntimeLifecycleStage.Unloaded, PluginRuntimeLifecycleStage.Failed],
 [PluginRuntimeLifecycleStage.Unloaded]: [],
 [PluginRuntimeLifecycleStage.Failed]: [],
});
export function assertPluginLifecycleTransition(from: PluginRuntimeLifecycleStage | undefined, to: PluginRuntimeLifecycleStage): void { if (from === undefined && to === PluginRuntimeLifecycleStage.Discovered) return; if (from !== undefined && PLUGIN_RUNTIME_LIFECYCLE_TRANSITIONS[from].includes(to)) return; throw new PluginLifecycleError(from, to); }
