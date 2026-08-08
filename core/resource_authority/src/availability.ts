import type { Allocation, Reservation, ResourceProfile } from './types.js';
import type { PowerConstraintProvider, ThermalConstraintProvider } from './providers.js';

export interface AvailabilityContext {
  profile: ResourceProfile;
  reservations: Reservation[];
  allocations: Allocation[];
  powerProvider: PowerConstraintProvider;
  thermalProvider: ThermalConstraintProvider;
  requestedCapacity?: number;
  now?: string;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  reasons: string[];
  constraintViolations: string[];
}

const BLOCKING_STATES = new Set<ResourceProfile['state']>(['unavailable', 'retired', 'discovered']);

export function evaluateAvailability(ctx: AvailabilityContext): AvailabilityResult {
  const { profile, reservations, allocations, powerProvider, thermalProvider } = ctx;
  const requested = ctx.requestedCapacity ?? 0;
  const reasons: string[] = [];
  const constraintViolations: string[] = [];

  if (BLOCKING_STATES.has(profile.state)) {
    constraintViolations.push(`Resource state "${profile.state}" blocks allocation.`);
  }

  if (profile.healthStatus === 'faulted') {
    constraintViolations.push('Resource health is faulted.');
  } else if (profile.healthStatus === 'degraded') {
    reasons.push('Resource health is degraded but allocatable.');
  } else if (profile.healthStatus === 'healthy') {
    reasons.push('Resource health is healthy.');
  }

  if (powerProvider.isPowerBlocking?.(profile.hardwareId)) {
    constraintViolations.push('Power constraint blocks allocation.');
  }

  if (thermalProvider.isThermalBlocking?.(profile.hardwareId)) {
    constraintViolations.push('Thermal constraint blocks allocation.');
  }

  const activeReservations = reservations.filter((r) => r.status === 'active');
  const activeAllocations = allocations.filter((a) => a.state === 'active' || a.state === 'pending');

  const exclusiveAllocation = activeAllocations.find((a) => a.mode === 'exclusive');
  if (exclusiveAllocation && requested > 0) {
    constraintViolations.push(`Exclusive allocation held by "${exclusiveAllocation.owner}".`);
  }

  const effectiveAvailable = computeEffectiveAvailable(profile, activeReservations, activeAllocations);

  if (requested > 0 && effectiveAvailable < requested) {
    constraintViolations.push(
      `Insufficient capacity: requested ${requested}, effective available ${effectiveAvailable}.`,
    );
  } else if (requested > 0) {
    reasons.push(`Effective available capacity: ${effectiveAvailable} units.`);
  }

  const isAvailable = constraintViolations.length === 0;

  return { isAvailable, reasons, constraintViolations };
}

export function computeEffectiveAvailable(
  profile: ResourceProfile,
  reservations: Reservation[],
  allocations: Allocation[],
): number {
  const reservedByOthers = reservations
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + r.capacity, 0);

  const allocated = allocations
    .filter((a) => a.state === 'active' || a.state === 'pending')
    .reduce((sum, a) => sum + a.capacity, 0);

  return Math.max(0, profile.maximumCapacity - reservedByOthers - allocated);
}

export function sortCandidatesByResourceId<T extends { resourceId: string }>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
}
