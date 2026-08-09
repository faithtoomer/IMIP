import type { CpuPerformanceRecord, CpuProfile, CpuThreadPlacement, OptimizationRecommendation } from './types.js';
/** Advisory-only recommendation generator. It has no provider references and cannot apply a change. */
export function recommendCpuOptimization(profile: CpuProfile, placement: CpuThreadPlacement, latest?: CpuPerformanceRecord): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  if ((latest?.utilizationPercent ?? profile.currentUtilizationPercent ?? 0) > 90) recommendations.push({ kind: 'thread-count', advisory: true, suggestedValue: Math.max(1, placement.threadIds.length - 1), rationale: 'High utilization suggests an authority-reviewed lower thread allocation.' });
  if (placement.smtUsed) recommendations.push({ kind: 'affinity', advisory: true, suggestedValue: 'physical-cores-first', rationale: 'SMT is in use; evaluate physical-core affinity through IRIA-approved resources.' });
  if (placement.numaNodes.length > 1) recommendations.push({ kind: 'numa-placement', advisory: true, suggestedValue: placement.numaNodes.map(String), rationale: 'Threads span NUMA nodes; evaluate locality using approved placement.' });
  if (latest?.hashratePerWatt !== undefined && latest.hashratePerWatt <= 0) recommendations.push({ kind: 'performance-mode', advisory: true, suggestedValue: 'balanced', rationale: 'No positive efficiency was observed; review mode with Power/Thermal/Policy authorities.' });
  if (profile.availableThreads > placement.threadIds.length) recommendations.push({ kind: 'resource-utilization', advisory: true, suggestedValue: profile.availableThreads, rationale: 'Additional capacity exists but must be requested from IRIA; this is not an allocation.' });
  return recommendations;
}
