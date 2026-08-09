import { DuplicateProcessError, ProcessScopeError } from './errors.js';
import type { ProcessIdentity, ProcessLaunchRequest } from './types.js';
export class ProcessIdentityRegistry {
 private readonly ownerByProcess = new Map<string, string>(); private readonly activeByWorkloadAdapter = new Map<string, string>(); private readonly identities = new Map<string, Readonly<ProcessIdentity>>();
 key(request: Pick<ProcessLaunchRequest, 'parentWorkloadUuid' | 'adapterUuid'>): string { return `${request.parentWorkloadUuid}\u0000${request.adapterUuid}`; }
 claim(processUuid: string, request: ProcessLaunchRequest): void { const key = this.key(request); if (this.activeByWorkloadAdapter.has(key)) throw new DuplicateProcessError(key); this.activeByWorkloadAdapter.set(key, processUuid); this.ownerByProcess.set(processUuid, request.callerId); }
 release(processUuid: string, request: ProcessLaunchRequest): void { const key = this.key(request); if (this.activeByWorkloadAdapter.get(key) === processUuid) this.activeByWorkloadAdapter.delete(key); }
 assertProcessScope(processUuid: string, callerId: string): void { if (this.ownerByProcess.get(processUuid) !== callerId) throw new ProcessScopeError(processUuid); }
 assign(identity: ProcessIdentity): Readonly<ProcessIdentity> { const existing = this.identities.get(identity.processUuid); if (existing) return existing; const frozen = Object.freeze({ ...identity, commandIdentity: Object.freeze({ executable: identity.commandIdentity.executable, args: Object.freeze([...identity.commandIdentity.args]) }) }); this.identities.set(identity.processUuid, frozen); return frozen; }
 get(processUuid: string): Readonly<ProcessIdentity> | undefined { return this.identities.get(processUuid); }
}
export function assertProcessScope(registry: ProcessIdentityRegistry, processUuid: string, callerId: string): void { registry.assertProcessScope(processUuid, callerId); }
