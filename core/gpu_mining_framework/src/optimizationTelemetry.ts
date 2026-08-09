import type { GpuOptimizationRecommendation, GpuPerformanceRecord, GpuProfile } from './types.js';
/** Advisory-only; no provider reference and no mutation path, so it cannot override power or thermal policy. */
export function recommendGpuOptimization(profile: GpuProfile, config: { intensity: number; requiredVramMB: number }, latest?: GpuPerformanceRecord): GpuOptimizationRecommendation[] {
  const recommendations: GpuOptimizationRecommendation[] = [];
  if ((latest?.hashratePerWatt ?? 1) <= 0) recommendations.push({ kind: 'power-efficiency', advisory: true, suggestedValue: 'review', rationale: 'Non-positive measured efficiency merits authority-reviewed power efficiency analysis.' });
  if (profile.thermalState.state === 'warning' || profile.thermalState.state === 'critical') recommendations.push({ kind: 'workload-intensity', advisory: true, suggestedValue: Math.max(0, config.intensity - 1), rationale: 'Thermal state is reportable; evaluate a lower intensity through institutional policy owners.' });
  if (profile.vramAvailableMB > config.requiredVramMB) recommendations.push({ kind: 'memory-utilization', advisory: true, suggestedValue: profile.vramAvailableMB, rationale: 'Additional provider-reported VRAM is visible, but any use requires a new IRIA request.' });
  if (profile.availableComputeQueues > 1) recommendations.push({ kind: 'gpu-selection', advisory: true, suggestedValue: profile.gpuUuid, rationale: 'This UUID-specific GPU has available compute queues; the recommendation is not a selection or allocation.' });
  if ((latest?.rejectedShares ?? 0) > 0) recommendations.push({ kind: 'algorithm-configuration', advisory: true, suggestedValue: 'review-adapter-configuration', rationale: 'Rejected shares merit a configuration review through the adapter/plugin boundary.' });
  return recommendations;
}
