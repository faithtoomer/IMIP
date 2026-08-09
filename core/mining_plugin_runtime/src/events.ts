import { EventEmitter } from 'node:events';
import type { PluginEventBusProvider } from './providers.js';
import type { PluginRuntimeLifecycleStage } from './types.js';
export const MINING_PLUGIN_RUNTIME_EVENTS = { PluginRuntimeLoaded:'PluginRuntimeLoaded', PluginRuntimeInitialized:'PluginRuntimeInitialized', PluginRuntimeReady:'PluginRuntimeReady', PluginRuntimeStarted:'PluginRuntimeStarted', PluginRuntimePaused:'PluginRuntimePaused', PluginRuntimeResumed:'PluginRuntimeResumed', PluginRuntimeStopped:'PluginRuntimeStopped', PluginRuntimeFailed:'PluginRuntimeFailed', PluginRuntimeUnloaded:'PluginRuntimeUnloaded' } as const;
export type MiningPluginRuntimeEventName = (typeof MINING_PLUGIN_RUNTIME_EVENTS)[keyof typeof MINING_PLUGIN_RUNTIME_EVENTS];
export interface PluginRuntimeEventPayload { pluginInstanceUuid: string; pluginUuid: string; stage: PluginRuntimeLifecycleStage; reason?: string; }
const PUBLISHER = 'Institutional Mining Plugin Runtime';
export class MiningPluginRuntimeEventBus {
 private readonly emitter = new EventEmitter();
 constructor(private readonly institutional: PluginEventBusProvider) {
  for (const name of Object.values(MINING_PLUGIN_RUNTIME_EVENTS)) {
   if (!institutional.getEventDefinition?.(name)) institutional.registerEventType?.({ id:`mining-plugin-runtime.${name}`, name, category:'mining-plugin-runtime', description:`IMPR event: ${name}`, publisherAuthority:PUBLISHER, priority:name === MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeFailed ? 'high' : 'normal', deliveryMode:'sync', targeting:'broadcast', version:'1.0.0' });
  }
 }
 publish(event: MiningPluginRuntimeEventName, payload: PluginRuntimeEventPayload): void { this.emitter.emit(event, payload); void Promise.resolve(this.institutional.publish(event, PUBLISHER, payload)).catch(() => undefined); }
 subscribe(event: MiningPluginRuntimeEventName, handler: (payload: PluginRuntimeEventPayload) => void): () => void { this.emitter.on(event, handler); return () => this.emitter.off(event, handler); }
}
