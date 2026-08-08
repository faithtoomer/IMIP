import type {
  Allocation,
  AllocationRequest,
  CapacityForecast,
  Reservation,
  ResourceDigitalTwin,
  ResourceProfile,
  UtilizationMetrics,
} from './types.js';
import { evaluateAvailability } from './availability.js';
import type { PowerConstraintProvider, ThermalConstraintProvider } from './providers.js';
import { computeCapacityForecast } from './forecast.js';
import { computeUtilization } from './utilization.js';
import type { OwnershipRecord } from './types.js';
import { sortCandidatesByResourceId } from './availability.js';

export interface DigitalTwinContext {
  profile: ResourceProfile;
  ownership: OwnershipRecord | null;
  allocations: Allocation[];
  reservations: Reservation[];
  powerProvider: PowerConstraintProvider;
  thermalProvider: ThermalConstraintProvider;
  now: string;
}

export function assembleResourceDigitalTwin(ctx: DigitalTwinContext): ResourceDigitalTwin {
  const utilization = computeUtilization(ctx.profile, ctx.allocations, ctx.reservations, ctx.now);
  const forecast = computeCapacityForecast({
    profile: ctx.profile,
    allocations: ctx.allocations,
    reservations: ctx.reservations,
    forecastedAt: ctx.now,
  });

  const powerBlocked = ctx.powerProvider.isPowerBlocking?.(ctx.profile.hardwareId) ?? false;
  const thermalBlocked = ctx.thermalProvider.isThermalBlocking?.(ctx.profile.hardwareId) ?? false;
  const healthBlocked = ctx.profile.healthStatus === 'faulted';

  return {
    resourceId: ctx.profile.resourceId,
    profile: ctx.profile,
    ownership: ctx.ownership,
    utilization,
    forecast,
    powerProfileRef: ctx.powerProvider.powerProfileRef?.(ctx.profile.hardwareId) ?? ctx.profile.powerProfileRef,
    thermalProfileRef: ctx.thermalProvider.thermalProfileRef?.(ctx.profile.hardwareId) ?? ctx.profile.thermalProfileRef,
    constraints: { powerBlocked, thermalBlocked, healthBlocked },
    activeReservations: ctx.reservations.filter((r) => r.status === 'active'),
    activeAllocations: ctx.allocations.filter((a) => a.state === 'active' || a.state === 'pending'),
  };
}

export function rankCandidatesForWorkload(
  profiles: ResourceProfile[],
  allocations: Allocation[],
  reservations: Reservation[],
  request: AllocationRequest,
  powerProvider: PowerConstraintProvider,
  thermalProvider: ThermalConstraintProvider,
  now: string,
): { resourceId: string; score: number; explanation: string[] }[] {
  let candidates = profiles.filter((p) => p.state === 'available' || p.state === 'reserved' || p.state === 'released');

  if (request.resourceType) {
    candidates = candidates.filter((p) => p.resourceType === request.resourceType);
  }
  if (request.capabilityRefs?.length) {
    candidates = candidates.filter((p) => request.capabilityRefs!.every((ref) => p.capabilityRefs.includes(ref)));
  }

  const ranked: { resourceId: string; score: number; explanation: string[] }[] = [];

  for (const profile of sortCandidatesByResourceId(candidates)) {
    const resourceAllocations = allocations.filter((a) => a.resourceId === profile.resourceId);
    const resourceReservations = reservations.filter((r) => r.resourceId === profile.resourceId);

    const availability = evaluateAvailability({
      profile,
      reservations: resourceReservations,
      allocations: resourceAllocations,
      powerProvider,
      thermalProvider,
      requestedCapacity: request.capacity,
      now,
    });

    if (!availability.isAvailable) continue;

    const healthScore = profile.healthStatus === 'healthy' ? 1 : profile.healthStatus === 'degraded' ? 0.5 : 0.25;
    const spareRatio =
      profile.maximumCapacity > 0
        ? (profile.maximumCapacity - profile.utilizedCapacity - profile.reservedCapacity) / profile.maximumCapacity
        : 0;
    const score = (healthScore + spareRatio) / 2;

    ranked.push({
      resourceId: profile.resourceId,
      score,
      explanation: [
        ...availability.reasons,
        `Composite score: ${score.toFixed(3)} (health ${healthScore}, spare ${spareRatio.toFixed(3)}).`,
      ],
    });
  }

  return ranked.sort((a, b) => b.score - a.score || a.resourceId.localeCompare(b.resourceId));
}

export function underutilizedHealthy(
  twins: ResourceDigitalTwin[],
  thresholdPercent = 25,
): ResourceDigitalTwin[] {
  return sortCandidatesByResourceId(
    twins
      .filter((t) => t.profile.healthStatus === 'healthy' && t.utilization.utilizationPercent < thresholdPercent)
      .map((t) => t),
  );
}

export function explainUnavailability(twin: ResourceDigitalTwin): string[] {
  const explanations: string[] = [];

  if (twin.constraints.healthBlocked) {
    explanations.push('Health status is faulted.');
  }
  if (twin.constraints.powerBlocked) {
    explanations.push('Power constraint is blocking allocation.');
  }
  if (twin.constraints.thermalBlocked) {
    explanations.push('Thermal constraint is blocking allocation.');
  }
  if (twin.profile.state === 'unavailable' || twin.profile.state === 'retired') {
    explanations.push(`Resource state is "${twin.profile.state}".`);
  }
  if (twin.forecast.conflicts.length > 0) {
    explanations.push(...twin.forecast.conflicts.map((c) => `Conflict: ${c}`));
  }
  if (twin.forecast.availableCapacity === 0 && twin.profile.state !== 'retired') {
    explanations.push('No available capacity remains.');
  }

  if (explanations.length === 0) {
    explanations.push('Resource appears available for allocation.');
  }

  return explanations;
}

export function projectedImpactOfAllocation(
  twin: ResourceDigitalTwin,
  requestedCapacity: number,
): { projectedUtilizationPercent: number; projectedAvailableCapacity: number; wouldOvercommit: boolean } {
  const projectedUtilized = twin.utilization.utilizedCapacity + requestedCapacity;
  const projectedAvailable = Math.max(0, twin.profile.maximumCapacity - twin.utilization.reservedCapacity - projectedUtilized);
  const projectedUtilizationPercent =
    twin.profile.maximumCapacity > 0 ? (projectedUtilized / twin.profile.maximumCapacity) * 100 : 0;
  const wouldOvercommit = projectedUtilized + twin.utilization.reservedCapacity > twin.profile.maximumCapacity;

  return { projectedUtilizationPercent, projectedAvailableCapacity: projectedAvailable, wouldOvercommit };
}

export type { CapacityForecast, UtilizationMetrics };
