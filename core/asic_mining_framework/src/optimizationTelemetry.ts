import type { AsicOptimizationRecommendation, AsicPerformanceRecord, AsicProfile } from './types.js';
/** Advisory only: accepts no mutable provider and never applies power, selection, or configuration changes. */
export function recommendAsicOptimization(profile: AsicProfile, config: { algorithm: string }, latest?: AsicPerformanceRecord): AsicOptimizationRecommendation[] {
  const recommendations: AsicOptimizationRecommendation[] = [];
  if ((latest?.efficiencyHpsPerWatt ?? 1) <= 0) recommendations.push({ kind: 'power-efficiency', advisory: true, suggestedValue: 'review', rationale: 'Non-positive measured efficiency merits an authority-reviewed power-efficiency assessment.' });
  if (profile.resourceState.deviceAvailable && profile.resourceState.availableHashboardIds.length > 0) recommendations.push({ kind: 'device-selection', advisory: true, suggestedValue: profile.asicUuid, rationale: 'This independently identified ASIC is visible as available; this is not a selection or allocation.' });
  if ((latest?.rejectedShares ?? 0) > 0 || (latest?.invalidShares ?? 0) > 0) recommendations.push({ kind: 'algorithm-configuration', advisory: true, suggestedValue: config.algorithm, rationale: 'Rejected or invalid shares merit plugin/adapter configuration review; IAMF makes no configuration change.' });
  return recommendations;
}
