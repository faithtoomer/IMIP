import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MiningPluginRuntime } from '../src/MiningPluginRuntime.js';
import { MINING_PLUGIN_RUNTIME_EVENTS } from '../src/events.js';
import { PluginRuntimeLifecycleStage } from '../src/types.js';
import { dependencies, FakeCertificationStatusProvider, manifest, pluginPackage } from './testHelpers.js';

describe('Institutional Mining Plugin Runtime', () => {
 it('hard-refuses malformed manifests and records an explicit failed path', async () => {
  const runtime=new MiningPluginRuntime(dependencies());
  await expect(runtime.load({ ...manifest(), pluginUuid:'' }, pluginPackage(), {pluginInstanceUuid:'bad'})).rejects.toThrow('pluginUuid is required');
  expect(runtime.registry.require('bad').stage).toBe(PluginRuntimeLifecycleStage.Failed);
  expect(runtime.explain('bad')).toMatchObject({stage:'failed', validation:{manifestValid:false}});
  await expect(runtime.load(manifest({pluginUuid:'bad-interface',requiredInterfaces:['not-approved' as never]}),pluginPackage())).rejects.toThrow('unsupported');
 });
 it('checks declared plugin dependencies against the runtime working set rather than resolving platform-wide', async () => {
  const runtime=new MiningPluginRuntime(dependencies());
  await runtime.load(manifest({pluginUuid:'base',version:'1.0.0'}),pluginPackage());
  await expect(runtime.load(manifest({pluginUuid:'dependent', declaredDependencies:[{pluginUuid:'base',version:'2.0.0'}]}),pluginPackage(),{pluginInstanceUuid:'mismatch'})).rejects.toThrow('incompatible');
  await expect(runtime.load(manifest({pluginUuid:'missing', declaredDependencies:[{pluginUuid:'not-loaded',version:'1.0.0'}]}),pluginPackage())).rejects.toThrow('unavailable');
 });
 it('uses the injected certification provider as a non-bypassable hard gate', async () => {
  const provider=new FakeCertificationStatusProvider(); provider.status=undefined;
  const runtime=new MiningPluginRuntime(dependencies(provider));
  await expect(runtime.load(manifest(),pluginPackage(),{pluginInstanceUuid:'uncertified'})).rejects.toThrow('no valid certification');
  provider.status={certified:true,level:'production',reason:'approved'};
  await expect(runtime.load(manifest({pluginUuid:'certified'}),pluginPackage())).resolves.toMatchObject({stage:'loaded'});
 });
 it('runs the guarded lifecycle and publishes all nine named events including explicit failure', async () => {
  const d=dependencies(); const runtime=new MiningPluginRuntime(d); const received:string[]=[];
  for(const event of Object.values(MINING_PLUGIN_RUNTIME_EVENTS)) runtime.events.subscribe(event,()=>received.push(event));
  const one=await runtime.load(manifest(),pluginPackage(),{pluginInstanceUuid:'one'});
  await runtime.initialize('one'); await runtime.start('one'); await runtime.pause('one'); await runtime.resume('one'); await runtime.stop('one'); await runtime.unload('one');
  expect(one.lifecycle.map((entry)=>entry.to)).toEqual([PluginRuntimeLifecycleStage.Discovered,PluginRuntimeLifecycleStage.Validated,PluginRuntimeLifecycleStage.Loaded,PluginRuntimeLifecycleStage.Initialized,PluginRuntimeLifecycleStage.Ready,PluginRuntimeLifecycleStage.Active,PluginRuntimeLifecycleStage.Paused,PluginRuntimeLifecycleStage.Active,PluginRuntimeLifecycleStage.Stopping,PluginRuntimeLifecycleStage.Stopped,PluginRuntimeLifecycleStage.Unloaded]);
  await runtime.load(manifest({pluginUuid:'failed'}),pluginPackage(),{pluginInstanceUuid:'failed'}); runtime.fail('failed','fixture failure');
  expect(new Set(received)).toEqual(new Set(Object.values(MINING_PLUGIN_RUNTIME_EVENTS)));
  expect(d.published).toEqual(expect.arrayContaining(Object.values(MINING_PLUGIN_RUNTIME_EVENTS)));
 });
 it('isolates contexts and control by Plugin Instance UUID', async () => {
  const runtime=new MiningPluginRuntime(dependencies());
  const contexts:unknown[]=[];
  await runtime.load(manifest({pluginUuid:'a'}),pluginPackage({entrypoint:{initialize:(context)=>contexts.push(context)}}),{pluginInstanceUuid:'a'});
  await runtime.load(manifest({pluginUuid:'b'}),pluginPackage(),{pluginInstanceUuid:'b'});
  await expect(runtime.initialize('a','b')).rejects.toThrow('scope violation');
  await runtime.initialize('a');
  expect(contexts).toHaveLength(1); expect(contexts[0]).not.toBe(runtime.registry.require('b').context);
  expect(()=>runtime.assertScope('a','b')).toThrow('scope violation');
 });
 it('provides each plugin exactly the ten approved runtime-context interfaces and nothing else', async () => {
  const runtime=new MiningPluginRuntime(dependencies()); const seen:Record<string,unknown>[]=[];
  await runtime.load(manifest(),pluginPackage({entrypoint:{initialize:(context)=>seen.push(context as Record<string,unknown>)}}),{pluginInstanceUuid:'context'}); await runtime.initialize('context');
  expect(Object.keys(seen[0]!).sort()).toEqual(['configuration','eventBus','hardwareIntelligence','health','miningFrameworks','power','resources','security','statistics','thermal']);
  expect(seen[0]).not.toHaveProperty('processManager'); expect(seen[0]).not.toHaveProperty('registry'); expect(Object.isFrozen(seen[0])).toBe(true);
 });
 it('delegates a plugin instance process-start request only to injected IMPM-shaped handle and traces it', async () => {
  const d=dependencies(); const runtime=new MiningPluginRuntime(d); await runtime.load(manifest(),pluginPackage(),{pluginInstanceUuid:'delegate'});
  const result=await runtime.requestProcessStart({pluginInstanceUuid:'delegate',workloadUuid:'workload-1',resourceIds:['resource-1'],request:{executable:'/delegated/miner'}});
  expect(result).toEqual({processUuid:'process-1'}); expect(d.processManager.calls).toEqual([{executable:'/delegated/miner'}]);
  expect(runtime.graph.chain('delegate').map((node)=>node.kind)).toEqual(['plugin','capability','resource','workload','miner-process']);
 });
 it('maintains the full plugin execution graph and records statistics traceability', async () => {
  const runtime=new MiningPluginRuntime(dependencies());
  await runtime.load(manifest({declaredDependencies:[{pluginUuid:'dependency',required:false}],declaredCapabilities:['capability-a']}),pluginPackage(),{pluginInstanceUuid:'trace',executionTrace:{resourceIds:['resource-a'],workloadUuids:['workload-a'],minerProcessUuids:['process-a'],statisticIds:['stat-a']}});
  runtime.recordStatistics('trace',['stat-b']);
  expect(runtime.graph.traceResource('resource-a')).toHaveLength(1);
  expect(runtime.graph.chain('trace').map((node)=>node.kind)).toEqual(['plugin','dependency','capability','resource','workload','miner-process','statistics','statistics']);
 });
 it('manages concurrent handed-in plugin instances independently', async () => {
  const runtime=new MiningPluginRuntime(dependencies());
  const instances=await Promise.all(['a','b','c'].map((suffix)=>runtime.load(manifest({pluginUuid:`plugin-${suffix}`}),pluginPackage(),{pluginInstanceUuid:`instance-${suffix}`})));
  await Promise.all(instances.map((instance)=>runtime.initialize(instance.identity.pluginInstanceUuid).then(()=>runtime.start(instance.identity.pluginInstanceUuid))));
  expect(instances.map((instance)=>instance.stage)).toEqual([PluginRuntimeLifecycleStage.Active,PluginRuntimeLifecycleStage.Active,PluginRuntimeLifecycleStage.Active]);
  await runtime.pause('instance-a'); expect(runtime.registry.require('instance-b').stage).toBe(PluginRuntimeLifecycleStage.Active);
 });
 it('has no autonomous discovery public method; loading requires a handed-in manifest and package', () => {
  const source=readFileSync(fileURLToPath(new URL('../src/MiningPluginRuntime.ts',import.meta.url)),'utf8');
  expect(source).toMatch(/async load\(manifest: PluginManifest, pluginPackage: PluginPackage/);
  expect(source).not.toMatch(/\b(?:scan|discover|discoverAll)\s*\(/);
  expect(source).not.toMatch(/\b(?:readdirSync|readdir|glob)\s*\(/);
 });
});
