import type { MiningPluginRuntimeDependencies, PluginCertificationStatusProvider, ProcessManagerHandle } from '../src/providers.js';
import type { PluginManifest, PluginPackage } from '../src/types.js';

export class FakeCertificationStatusProvider implements PluginCertificationStatusProvider {
 status: import('../src/types.js').CertificationStatus | undefined = { certified: true, level: 'production', reason: 'fixture certified' };
 getCertificationStatus() { return this.status; }
}
export class FakeProcessManager implements ProcessManagerHandle { readonly calls: unknown[]=[]; async launch(request: unknown): Promise<unknown> { this.calls.push(request); return { processUuid: `process-${this.calls.length}` }; } }
export function dependencies(certificationStatus = new FakeCertificationStatusProvider(), processManager = new FakeProcessManager()): MiningPluginRuntimeDependencies & { certificationStatus: FakeCertificationStatusProvider; processManager: FakeProcessManager; published: string[] } {
 let id=0; const published:string[]=[]; const read=(prefix:string)=>(value:string)=>({prefix,value});
 return { certificationStatus, processManager, published, createUuid:()=>`instance-${++id}`, clock:{now:()=> '2026-08-09T14:00:00.000Z'}, configuration:{has:()=>true,get:(key)=>`config:${key}`}, eventBus:{publish:(name)=>{published.push(name);}}, resources:{getResource:read('resource')}, hardwareIntelligence:{getHardwareIntelligence:read('hardware')}, power:{getPowerAssessment:read('power')}, thermal:{getThermalAssessment:read('thermal')}, health:{getHealthAssessment:read('health')}, statistics:{queryStatistics:(query)=>query}, miningFrameworks:{getFrameworkCapabilities:read('framework')}, security:{authorize:(input)=>({approved:true,...input})} };
}
export function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest { return { pluginUuid:'plugin-1', version:'1.0.0', declaredDependencies:[], declaredCapabilities:['mining'], requiredInterfaces:['configuration','eventBus','resources','hardwareIntelligence','power','thermal','health','statistics','miningFrameworks','security'], ...overrides }; }
export function pluginPackage(overrides: Partial<PluginPackage> = {}): PluginPackage { return { packageReference:{fixture:true}, entrypoint:{}, ...overrides }; }
