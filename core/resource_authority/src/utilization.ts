import type { Allocation, Reservation, ResourceProfile, UtilizationMetrics } from './types.js';

export function computeUtilization(
  profile: ResourceProfile,
  allocations: Allocation[],
  reservations: Reservation[],
  recordedAt: string,
): UtilizationMetrics {
  const activeAllocations = allocations.filter((a) => a.state === 'active' || a.state === 'pending');
  const activeReservations = reservations.filter((r) => r.status === 'active');

  const utilizedCapacity = activeAllocations.reduce((sum, a) => sum + a.capacity, 0);
  const reservedCapacity = activeReservations.reduce((sum, r) => sum + r.capacity, 0);
  const maximumCapacity = profile.maximumCapacity;
  const availableCapacity = Math.max(0, maximumCapacity - reservedCapacity - utilizedCapacity);
  const utilizationPercent = maximumCapacity > 0 ? (utilizedCapacity / maximumCapacity) * 100 : 0;

  return {
    resourceId: profile.resourceId,
    utilizedCapacity,
    availableCapacity,
    reservedCapacity,
    maximumCapacity,
    utilizationPercent,
    recordedAt,
  };
}

export function computeFleetUtilization(
  profiles: ResourceProfile[],
  allocations: Allocation[],
  reservations: Reservation[],
  recordedAt: string,
): UtilizationMetrics[] {
  return profiles.map((profile) => {
    const resourceAllocations = allocations.filter((a) => a.resourceId === profile.resourceId);
    const resourceReservations = reservations.filter((r) => r.resourceId === profile.resourceId);
    return computeUtilization(profile, resourceAllocations, resourceReservations, recordedAt);
  });
}

export function averageUtilizationPercent(metrics: UtilizationMetrics[]): number {
  if (metrics.length === 0) return 0;
  const total = metrics.reduce((sum, m) => sum + m.utilizationPercent, 0);
  return total / metrics.length;
}
