import type { EvidenceRecord, PluginTrustGraphTrace } from './types.js';
export interface PluginTrustGraphNode { kind: 'plugin' | 'version' | 'certification' | 'dependency' | 'adapter' | 'algorithm' | 'hardware' | 'runtime' | 'historical-performance' | 'security-evidence'; identifier: string; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
/** Queryable trust lineage; observations are copied from IMPCA evidence rather than queried from any other authority. */
export class InstitutionalPluginTrustGraph {
  private readonly traces = new Map<string, Readonly<PluginTrustGraphTrace>>();
  record(certificationId: string, pluginUuid: string, version: string, evidence: readonly EvidenceRecord[]): void {
    const values = (key: string) => [...new Set(evidence.flatMap((entry) => strings(entry.payload[key])))];
    const trace: PluginTrustGraphTrace = { pluginUuid, version, certificationId, dependencies: values('dependencies'), adapters: values('adapters'), algorithms: values('algorithms'), hardware: values('hardware'), runtime: values('runtime'), historicalPerformance: values('historicalPerformance'), securityEvidence: [...new Set([...values('securityEvidence'), ...evidence.filter((entry) => entry.stage === 'SecurityValidation').map((entry) => entry.evidenceId)])] };
    this.traces.set(certificationId, Object.freeze(trace));
  }
  trace(certificationId: string): Readonly<PluginTrustGraphTrace> | undefined { return this.traces.get(certificationId); }
  chain(certificationId: string): PluginTrustGraphNode[] { const trace=this.traces.get(certificationId); if (!trace) return []; return [{ kind:'plugin', identifier:trace.pluginUuid }, { kind:'version', identifier:trace.version }, { kind:'certification', identifier:trace.certificationId }, ...trace.dependencies.map(identifier => ({kind:'dependency' as const,identifier})), ...trace.adapters.map(identifier => ({kind:'adapter' as const,identifier})), ...trace.algorithms.map(identifier => ({kind:'algorithm' as const,identifier})), ...trace.hardware.map(identifier => ({kind:'hardware' as const,identifier})), ...trace.runtime.map(identifier => ({kind:'runtime' as const,identifier})), ...trace.historicalPerformance.map(identifier => ({kind:'historical-performance' as const,identifier})), ...trace.securityEvidence.map(identifier => ({kind:'security-evidence' as const,identifier}))]; }
}
