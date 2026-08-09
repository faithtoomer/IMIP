import { requireValidCertification } from './certificationGate.js';
import { validateDeclaredDependencies } from './dependencyValidation.js';
import { PluginCertificationError, PluginDependencyValidationError, PluginManifestValidationError } from './errors.js';
import { MiningPluginRuntimeEventBus, MINING_PLUGIN_RUNTIME_EVENTS } from './events.js';
import { InstitutionalPluginExecutionGraph } from './executionGraph.js';
import { explainPluginRuntime } from './explainability.js';
import { assertPluginInstanceScope } from './isolation.js';
import { assertPluginLifecycleTransition } from './lifecycle.js';
import { validatePluginManifest } from './manifestValidation.js';
import { delegateProcessStart } from './processDelegation.js';
import type { MiningPluginRuntimeDependencies } from './providers.js';
import { PluginRuntimeRegistry } from './registry.js';
import { createPluginRuntimeContext } from './runtimeContext.js';
import { PluginRuntimeLifecycleStage, type ManagedPluginRuntime, type PluginExecutionTraceInput, type PluginLoadRequest, type PluginManifest, type PluginPackage, type PluginProcessStartRequest, type PluginValidationResult } from './types.js';

/**
 * IMPR is a mechanical execution host only. It has no scanning/discovery API,
 * no platform inventory, and no activation-authorization decision. A caller
 * must explicitly hand it each manifest/package unit to validate and host.
 */
export class MiningPluginRuntime {
 readonly registry = new PluginRuntimeRegistry();
 readonly events: MiningPluginRuntimeEventBus;
 readonly graph = new InstitutionalPluginExecutionGraph();
 private counter = 0;

 constructor(private readonly dependencies: MiningPluginRuntimeDependencies) { this.events = new MiningPluginRuntimeEventBus(dependencies.eventBus); }

 async load(manifest: PluginManifest, pluginPackage: PluginPackage, options: Omit<PluginLoadRequest, 'manifest' | 'package'> = {}): Promise<ManagedPluginRuntime> {
  const pluginInstanceUuid = options.pluginInstanceUuid ?? this.dependencies.createUuid?.() ?? `plugin-runtime-${++this.counter}`;
  const identity = Object.freeze({ pluginInstanceUuid, pluginUuid: manifest?.pluginUuid ?? 'unknown-plugin', manifestVersion: manifest?.version ?? 'unknown-version', loadedAt: this.dependencies.clock.now() });
  const instance: ManagedPluginRuntime = { identity, manifest, package: pluginPackage, stage: PluginRuntimeLifecycleStage.Discovered, lifecycle: [] };
  this.registry.add(instance); this.transition(instance, PluginRuntimeLifecycleStage.Discovered, 'Manifest and package were explicitly handed to IMPR.');
  try {
   validatePluginManifest(manifest, pluginPackage);
   validateDeclaredDependencies(manifest, this.registry.manifests().filter((candidate) => candidate !== manifest));
   await requireValidCertification(this.dependencies.certificationStatus, manifest);
   instance.validation = { valid: true, reasons: [], manifestValid: true, dependenciesValid: true, certificationValid: true };
   this.transition(instance, PluginRuntimeLifecycleStage.Validated, 'Manifest structure, declared dependencies, and certification status were accepted.');
   instance.context = createPluginRuntimeContext(pluginInstanceUuid, this.dependencies);
   this.transition(instance, PluginRuntimeLifecycleStage.Loaded, 'Isolated approved-interface runtime context created.');
   this.graph.record({ pluginInstanceUuid, pluginUuid: manifest.pluginUuid, dependencies: [...new Set(manifest.declaredDependencies.flatMap((dependency) => dependency.pluginUuid ? [dependency.pluginUuid] : dependency.interfaceName ? [dependency.interfaceName] : []))], capabilities: [...manifest.declaredCapabilities], resourceIds: options.executionTrace?.resourceIds ?? [], workloadUuids: options.executionTrace?.workloadUuids ?? [], minerProcessUuids: options.executionTrace?.minerProcessUuids ?? [], statisticIds: options.executionTrace?.statisticIds ?? [] });
   this.events.publish(MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeLoaded, this.payload(instance));
   return instance;
  } catch (caught) {
   const error = caught instanceof Error ? caught : new Error(String(caught));
   instance.validation = this.rejectionValidation(error);
   this.failInternal(instance, error.message);
   throw error;
  }
 }

 async initialize(pluginInstanceUuid: string, callerPluginInstanceUuid = pluginInstanceUuid): Promise<ManagedPluginRuntime> { const instance=this.control(pluginInstanceUuid, callerPluginInstanceUuid); return this.invoke(instance, 'initialize', PluginRuntimeLifecycleStage.Initialized, MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeInitialized, 'Plugin entrypoint initialized.').then((result) => { this.transition(result, PluginRuntimeLifecycleStage.Ready, 'Plugin runtime is ready.'); this.events.publish(MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeReady, this.payload(result)); return result; }); }
 async start(pluginInstanceUuid: string, callerPluginInstanceUuid = pluginInstanceUuid): Promise<ManagedPluginRuntime> { return this.invoke(this.control(pluginInstanceUuid, callerPluginInstanceUuid), 'start', PluginRuntimeLifecycleStage.Active, MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeStarted, 'Plugin runtime started.'); }
 async pause(pluginInstanceUuid: string, callerPluginInstanceUuid = pluginInstanceUuid): Promise<ManagedPluginRuntime> { return this.invoke(this.control(pluginInstanceUuid, callerPluginInstanceUuid), 'pause', PluginRuntimeLifecycleStage.Paused, MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimePaused, 'Plugin runtime paused.'); }
 async resume(pluginInstanceUuid: string, callerPluginInstanceUuid = pluginInstanceUuid): Promise<ManagedPluginRuntime> { return this.invoke(this.control(pluginInstanceUuid, callerPluginInstanceUuid), 'resume', PluginRuntimeLifecycleStage.Active, MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeResumed, 'Plugin runtime resumed.'); }
 async stop(pluginInstanceUuid: string, callerPluginInstanceUuid = pluginInstanceUuid): Promise<ManagedPluginRuntime> { const instance=this.control(pluginInstanceUuid, callerPluginInstanceUuid); this.transition(instance, PluginRuntimeLifecycleStage.Stopping, 'Plugin stop requested.'); try { await instance.package.entrypoint.stop?.(this.context(instance)); this.transition(instance, PluginRuntimeLifecycleStage.Stopped, 'Plugin runtime stopped.'); this.events.publish(MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeStopped, this.payload(instance)); return instance; } catch (caught) { this.failInternal(instance, this.message(caught)); throw caught; } }
 async unload(pluginInstanceUuid: string, callerPluginInstanceUuid = pluginInstanceUuid): Promise<ManagedPluginRuntime> { const instance=this.control(pluginInstanceUuid, callerPluginInstanceUuid); try { await instance.package.entrypoint.unload?.(this.context(instance)); this.transition(instance, PluginRuntimeLifecycleStage.Unloaded, 'Plugin runtime unloaded.'); this.events.publish(MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeUnloaded, this.payload(instance)); this.registry.remove(pluginInstanceUuid); return instance; } catch (caught) { this.failInternal(instance, this.message(caught)); throw caught; } }
 fail(pluginInstanceUuid: string, reason: string, callerPluginInstanceUuid = pluginInstanceUuid): ManagedPluginRuntime { const instance=this.control(pluginInstanceUuid, callerPluginInstanceUuid); this.failInternal(instance, reason); return instance; }

 async requestProcessStart(input: PluginProcessStartRequest, callerPluginInstanceUuid = input.pluginInstanceUuid): Promise<unknown> { const instance=this.control(input.pluginInstanceUuid, callerPluginInstanceUuid); const result=await delegateProcessStart(this.dependencies.processManager, input.request); const processUuid=this.processUuid(result); this.graph.update(instance.identity.pluginInstanceUuid, { resourceIds: [...new Set([...(this.graph.tracePlugin(instance.identity.pluginInstanceUuid)?.resourceIds ?? []), ...(input.resourceIds ?? [])])], workloadUuids: [...new Set([...(this.graph.tracePlugin(instance.identity.pluginInstanceUuid)?.workloadUuids ?? []), ...(input.workloadUuid ? [input.workloadUuid] : [])])], minerProcessUuids: processUuid ? [...new Set([...(this.graph.tracePlugin(instance.identity.pluginInstanceUuid)?.minerProcessUuids ?? []), processUuid])] : undefined }); return result; }
 recordStatistics(pluginInstanceUuid: string, statisticIds: readonly string[], callerPluginInstanceUuid = pluginInstanceUuid): void { this.control(pluginInstanceUuid, callerPluginInstanceUuid); const trace=this.graph.tracePlugin(pluginInstanceUuid); this.graph.update(pluginInstanceUuid, { statisticIds: [...new Set([...(trace?.statisticIds ?? []), ...statisticIds])] }); }
 explain(pluginInstanceUuid: string) { return explainPluginRuntime(this.registry.require(pluginInstanceUuid)); }
 assertScope(pluginInstanceUuid: string, callerPluginInstanceUuid: string): void { assertPluginInstanceScope(pluginInstanceUuid, callerPluginInstanceUuid); }

 private async invoke(instance: ManagedPluginRuntime, method: keyof PluginPackage['entrypoint'], target: PluginRuntimeLifecycleStage, event: keyof typeof MINING_PLUGIN_RUNTIME_EVENTS, reason: string): Promise<ManagedPluginRuntime> { try { const handler=instance.package.entrypoint[method]; if (typeof handler === 'function') await handler(this.context(instance)); this.transition(instance, target, reason); this.events.publish(MINING_PLUGIN_RUNTIME_EVENTS[event], this.payload(instance)); return instance; } catch (caught) { this.failInternal(instance, this.message(caught)); throw caught; } }
 private transition(instance: ManagedPluginRuntime, to: PluginRuntimeLifecycleStage, reason: string): void { const from=instance.lifecycle.length ? instance.stage : undefined; assertPluginLifecycleTransition(from, to); instance.stage=to; instance.lifecycle.push({ pluginInstanceUuid:instance.identity.pluginInstanceUuid, from, to, at:this.dependencies.clock.now(), reason }); }
 private failInternal(instance: ManagedPluginRuntime, reason: string): void { if (instance.stage !== PluginRuntimeLifecycleStage.Failed && instance.stage !== PluginRuntimeLifecycleStage.Unloaded) { this.transition(instance, PluginRuntimeLifecycleStage.Failed, reason); instance.failureReason=reason; this.events.publish(MINING_PLUGIN_RUNTIME_EVENTS.PluginRuntimeFailed, this.payload(instance, reason)); } }
 private control(pluginInstanceUuid: string, callerPluginInstanceUuid: string): ManagedPluginRuntime { assertPluginInstanceScope(pluginInstanceUuid, callerPluginInstanceUuid); return this.registry.require(pluginInstanceUuid); }
 private context(instance: ManagedPluginRuntime) { if (!instance.context) throw new Error('Plugin runtime context was not created.'); return instance.context; }
 private payload(instance: ManagedPluginRuntime, reason?: string) { return { pluginInstanceUuid:instance.identity.pluginInstanceUuid, pluginUuid:instance.identity.pluginUuid, stage:instance.stage, reason }; }
 private message(caught: unknown): string { return caught instanceof Error ? caught.message : String(caught); }
 private processUuid(result: unknown): string | undefined { return result && typeof result === 'object' && 'processUuid' in result && typeof result.processUuid === 'string' ? result.processUuid : undefined; }
 private rejectionValidation(error: Error): PluginValidationResult { return { valid:false, reasons: error instanceof PluginManifestValidationError || error instanceof PluginDependencyValidationError ? [...error.reasons] : error instanceof PluginCertificationError ? [error.reason] : [error.message], manifestValid: !(error instanceof PluginManifestValidationError), dependenciesValid: !(error instanceof PluginDependencyValidationError), certificationValid: !(error instanceof PluginCertificationError) }; }
}
