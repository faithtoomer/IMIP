import type {
  Allocation,
  CapacityForecast,
  Reservation,
  ResourceProfile,
  ResourceRecommendation,
  UtilizationMetrics,
} from './types.js';
import { sortCandidatesByResourceId } from './availability.js';

export interface RecommendationContext {
  profiles: ResourceProfile[];
  allocations: Allocation[];
  reservations: Reservation[];
  utilization: UtilizationMetrics[];
  forecasts: CapacityForecast[];
  requestedCapacity?: number;
  capabilityRefs?: string[];
}

/**
 * Advisory-only recommendations — IRIA does not allocate based on these;
 * callers (future workload intelligence) decide whether to act.
 */
export function generateRecommendations(ctx: RecommendationContext): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = [];

  for (const profile of ctx.profiles) {
    const util = ctx.utilization.find((u) => u.resourceId === profile.resourceId);
    const forecast = ctx.forecasts.find((f) => f.resourceId === profile.resourceId);

    if (util && util.utilizationPercent < 25 && profile.healthStatus === 'healthy') {
      recommendations.push({
        resourceId: profile.resourceId,
        kind: 'underutilized',
        score: 1 - util.utilizationPercent / 100,
        explanation: [
          `Utilization at ${util.utilizationPercent.toFixed(1)}%.`,
          'Healthy resource with spare capacity.',
        ],
      });
    }

    if (forecast && forecast.conflicts.length > 0) {
      recommendations.push({
        resourceId: profile.resourceId,
        kind: 'conflict-risk',
        score: forecast.conflicts.length,
        explanation: forecast.conflicts,
      });
    }

    if (forecast && forecast.availableCapacity < profile.maximumCapacity * 0.1) {
      recommendations.push({
        resourceId: profile.resourceId,
        kind: 'capacity-warning',
        score: 0.9,
        explanation: [
          `Only ${forecast.availableCapacity} of ${profile.maximumCapacity} capacity units remain.`,
        ],
      });
    }
  }

  const bestCandidates = rankBestCandidates(ctx);
  for (const candidate of bestCandidates.slice(0, 3)) {
    recommendations.push({
      resourceId: candidate.resourceId,
      kind: 'best-candidate',
      score: candidate.score,
      explanation: candidate.explanation,
    });
  }

  return recommendations.sort((a, b) => b.score - a.score || a.resourceId.localeCompare(b.resourceId));
}

function rankBestCandidates(ctx: RecommendationContext): { resourceId: string; score: number; explanation: string[] }[] {
  const requested = ctx.requestedCapacity ?? 1;
  const candidates: { resourceId: string; score: number; explanation: string[] }[] = [];

  for (const profile of sortCandidatesByResourceId(
    ctx.profiles.filter((p) => p.state === 'available' || p.state === 'released'),
  )) {
    if (ctx.capabilityRefs?.length && !ctx.capabilityRefs.every((ref) => profile.capabilityRefs.includes(ref))) {
      continue;
    }

    const util = ctx.utilization.find((u) => u.resourceId === profile.resourceId);
    const forecast = ctx.forecasts.find((f) => f.resourceId === profile.resourceId);
    if (!util || !forecast) continue;
    if (forecast.availableCapacity < requested) continue;
    if (profile.healthStatus === 'faulted') continue;

    const healthScore = profile.healthStatus === 'healthy' ? 1 : profile.healthStatus === 'degraded' ? 0.5 : 0.25;
    const capacityScore = forecast.availableCapacity / profile.maximumCapacity;
    const utilizationScore = 1 - util.utilizationPercent / 100;
    const score = (healthScore + capacityScore + utilizationScore) / 3;

    candidates.push({
      resourceId: profile.resourceId,
      score,
      explanation: [
        `Health: ${profile.healthStatus} (factor ${healthScore.toFixed(2)}).`,
        `Available capacity: ${forecast.availableCapacity}/${profile.maximumCapacity} (factor ${capacityScore.toFixed(2)}).`,
        `Low utilization bonus (factor ${utilizationScore.toFixed(2)}).`,
      ],
    });
  }

  return candidates.sort((a, b) => b.score - a.score || a.resourceId.localeCompare(b.resourceId));
}

export function underutilizedHealthy(
  profiles: ResourceProfile[],
  utilization: UtilizationMetrics[],
  thresholdPercent = 25,
): ResourceProfile[] {
  return sortCandidatesByResourceId(
    profiles.filter((profile) => {
      if (profile.healthStatus !== 'healthy') return false;
      const util = utilization.find((u) => u.resourceId === profile.resourceId);
      return util !== undefined && util.utilizationPercent < thresholdPercent;
    }),
  );
}
