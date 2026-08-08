import type { Allocation, CapacityForecast, Reservation, ResourceProfile } from './types.js';

export interface ForecastContext {
  profile: ResourceProfile;
  allocations: Allocation[];
  reservations: Reservation[];
  forecastedAt: string;
}

export function computeCapacityForecast(ctx: ForecastContext): CapacityForecast {
  const { profile, allocations, reservations, forecastedAt } = ctx;

  const activeAllocations = allocations.filter((a) => a.state === 'active' || a.state === 'pending');
  const activeReservations = reservations.filter((r) => r.status === 'active');

  const utilizedCapacity = activeAllocations.reduce((sum, a) => sum + a.capacity, 0);
  const reservedCapacity = activeReservations.reduce((sum, r) => sum + r.capacity, 0);
  const availableCapacity = Math.max(0, profile.maximumCapacity - reservedCapacity - utilizedCapacity);

  const conflicts: string[] = [];
  const idleOpportunities: string[] = [];

  if (reservedCapacity + utilizedCapacity > profile.maximumCapacity) {
    conflicts.push('Total reserved + utilized capacity exceeds maximum.');
  }

  const exclusiveAllocations = activeAllocations.filter((a) => a.mode === 'exclusive');
  if (exclusiveAllocations.length > 1) {
    conflicts.push('Multiple exclusive allocations detected.');
  }

  for (const reservation of activeReservations) {
    for (const allocation of activeAllocations) {
      if (reservation.owner !== allocation.owner) {
        conflicts.push(`Reservation "${reservation.id}" conflicts with allocation "${allocation.id}".`);
      }
    }
  }

  const utilizationRatio = profile.maximumCapacity > 0 ? utilizedCapacity / profile.maximumCapacity : 0;
  if (utilizationRatio < 0.25 && profile.healthStatus === 'healthy' && profile.state === 'available') {
    idleOpportunities.push('Resource is underutilized and healthy — candidate for consolidation.');
  }

  if (availableCapacity > profile.maximumCapacity * 0.5 && profile.state === 'active') {
    idleOpportunities.push('Significant spare capacity available after active workloads.');
  }

  const projectedExhaustionAt = projectExhaustion(profile, activeAllocations, forecastedAt);

  return {
    resourceId: profile.resourceId,
    projectedExhaustionAt,
    availableCapacity,
    reservedCapacity,
    utilizedCapacity,
    maximumCapacity: profile.maximumCapacity,
    conflicts,
    idleOpportunities,
    forecastedAt,
  };
}

function projectExhaustion(profile: ResourceProfile, allocations: Allocation[], now: string): string | undefined {
  const active = allocations.filter((a) => a.state === 'active');
  if (active.length === 0) return undefined;

  const totalAllocated = active.reduce((sum, a) => sum + a.capacity, 0);
  if (totalAllocated >= profile.maximumCapacity) return now;

  const nearestExpiration = active
    .map((a) => a.leaseExpiration)
    .filter((e): e is string => e !== undefined)
    .sort()[0];

  return nearestExpiration;
}

export function computeFleetForecast(
  profiles: ResourceProfile[],
  allocations: Allocation[],
  reservations: Reservation[],
  forecastedAt: string,
): CapacityForecast[] {
  return profiles.map((profile) =>
    computeCapacityForecast({
      profile,
      allocations: allocations.filter((a) => a.resourceId === profile.resourceId),
      reservations: reservations.filter((r) => r.resourceId === profile.resourceId),
      forecastedAt,
    }),
  );
}
