import { PluginScopeError } from './errors.js';
/** Identity scope is the only route to control an instance; context objects are never shared. */
export function assertPluginInstanceScope(pluginInstanceUuid: string, callerPluginInstanceUuid: string): void { if (pluginInstanceUuid !== callerPluginInstanceUuid) throw new PluginScopeError(pluginInstanceUuid); }
