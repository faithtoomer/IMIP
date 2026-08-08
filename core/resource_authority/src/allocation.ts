import { randomUUID } from 'node:crypto';
import type { Allocation, AllocationMode, AllocationRequest, ResourceProfile } from './types.js';
import { evaluateAvailability, sortCandidatesByResourceId } from './availability.js';
import type { PowerConstraintProvider, ThermalConstraintProvider } from './providers.js';
import { CapacityOvercommitError, DoubleAllocationError } from './errors.js';
import type { Reservation } from './types.js';

export interface AllocationEngineContext {
  profiles: ResourceProfile[];
  reservations: Reservation[];
  allocations: Allocation[];
  powerProvider: PowerConstraintProvider;
  thermalProvider: ThermalConstraintProvider;
  now: string;
}

export class AllocationEngine {
  allocate(ctx: AllocationEngineContext, request: AllocationRequest): Allocation {
    const profile = this.resolveProfile(ctx.profiles, request);
    const existingForResource = ctx.allocations.filter(
      (a) => a.resourceId === profile.resourceId && (a.state === 'active' || a.state === 'pending'),
    );

    if (request.mode === 'exclusive' && existingForResource.some((a) => a.mode === 'exclusive')) {
      throw new DoubleAllocationError(profile.resourceId);
    }

    if (request.mode === 'exclusive' && existingForResource.length > 0) {
      throw new DoubleAllocationError(profile.resourceId, `Resource "${profile.resourceId}" has existing allocations.`);
    }

    const resourceReservations = ctx.reservations.filter((r) => r.resourceId === profile.resourceId);
    const availability = evaluateAvailability({
      profile,
      reservations: resourceReservations,
      allocations: existingForResource,
      powerProvider: ctx.powerProvider,
      thermalProvider: ctx.thermalProvider,
      requestedCapacity: request.capacity,
      now: ctx.now,
    });

    if (!availability.isAvailable) {
      const effective = profile.maximumCapacity - profile.reservedCapacity - profile.utilizedCapacity;
      throw new CapacityOvercommitError(profile.resourceId, request.capacity, effective);
    }

    if (request.mode !== 'shared' && request.mode !== 'partial') {
      if (request.capacity > profile.maximumCapacity) {
        throw new CapacityOvercommitError(profile.resourceId, request.capacity, profile.maximumCapacity);
      }
    }

    const allocation: Allocation = {
      id: randomUUID(),
      resourceId: profile.resourceId,
      owner: request.owner,
      requestingAuthority: request.requestingAuthority,
      mode: request.mode,
      capacity: request.capacity,
      leaseStart: ctx.now,
      leaseExpiration: request.leaseExpiration,
      state: request.mode === 'temporary' ? 'pending' : 'active',
    };

    if (request.mode === 'temporary') {
      allocation.state = 'pending';
    } else {
      allocation.state = 'active';
    }

    return allocation;
  }

  selectCandidate(ctx: AllocationEngineContext, request: AllocationRequest): ResourceProfile | undefined {
    let candidates = ctx.profiles.filter((p) => p.state === 'available' || p.state === 'reserved' || p.state === 'released');

    if (request.resourceId) {
      candidates = candidates.filter((p) => p.resourceId === request.resourceId);
    }
    if (request.resourceType) {
      candidates = candidates.filter((p) => p.resourceType === request.resourceType);
    }
    if (request.capabilityRefs?.length) {
      candidates = candidates.filter((p) => request.capabilityRefs!.every((ref) => p.capabilityRefs.includes(ref)));
    }

    const viable: ResourceProfile[] = [];
    for (const profile of sortCandidatesByResourceId(candidates)) {
      const resourceReservations = ctx.reservations.filter((r) => r.resourceId === profile.resourceId);
      const resourceAllocations = ctx.allocations.filter(
        (a) => a.resourceId === profile.resourceId && (a.state === 'active' || a.state === 'pending'),
      );
      const result = evaluateAvailability({
        profile,
        reservations: resourceReservations,
        allocations: resourceAllocations,
        powerProvider: ctx.powerProvider,
        thermalProvider: ctx.thermalProvider,
        requestedCapacity: request.capacity,
        now: ctx.now,
      });
      if (result.isAvailable) viable.push(profile);
    }

    return viable[0];
  }

  private resolveProfile(profiles: ResourceProfile[], request: AllocationRequest): ResourceProfile {
    if (request.resourceId) {
      const found = profiles.find((p) => p.resourceId === request.resourceId);
      if (!found) throw new CapacityOvercommitError(request.resourceId, request.capacity, 0);
      return found;
    }
    throw new CapacityOvercommitError('unknown', request.capacity, 0);
  }
}

export function applyAllocationToProfile(profile: ResourceProfile, allocation: Allocation, now: string): ResourceProfile {
  const utilizedCapacity = profile.utilizedCapacity + allocation.capacity;
  const availableCapacity = Math.max(0, profile.maximumCapacity - profile.reservedCapacity - utilizedCapacity);

  return {
    ...profile,
    utilizedCapacity,
    availableCapacity,
    currentOwner: allocation.owner,
    requestingAuthority: allocation.requestingAuthority,
    state: allocation.mode === 'exclusive' ? 'allocated' : profile.state === 'available' ? 'active' : profile.state,
    lastUpdated: now,
  };
}

export function releaseAllocationFromProfile(profile: ResourceProfile, allocation: Allocation, now: string): ResourceProfile {
  const utilizedCapacity = Math.max(0, profile.utilizedCapacity - allocation.capacity);
  const availableCapacity = Math.max(0, profile.maximumCapacity - profile.reservedCapacity - utilizedCapacity);

  return {
    ...profile,
    utilizedCapacity,
    availableCapacity,
    currentOwner: undefined,
    requestingAuthority: undefined,
    state: 'released',
    lastUpdated: now,
  };
}

export function isAllocationExpired(allocation: Allocation, now: string): boolean {
  if (!allocation.leaseExpiration) return false;
  return allocation.leaseExpiration <= now;
}

export function allocationModeAllowsSharing(mode: AllocationMode): boolean {
  return mode === 'shared' || mode === 'partial';
}
