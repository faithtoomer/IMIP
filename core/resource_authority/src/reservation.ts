import { randomUUID } from 'node:crypto';
import type { Reservation, ReservationRequest, ResourceProfile } from './types.js';
import { evaluateAvailability, sortCandidatesByResourceId } from './availability.js';
import type { PowerConstraintProvider, ThermalConstraintProvider } from './providers.js';
import { ReservationConflictError, CapacityOvercommitError } from './errors.js';
import type { Allocation } from './types.js';

export interface ReservationManagerContext {
  profiles: ResourceProfile[];
  reservations: Reservation[];
  allocations: Allocation[];
  powerProvider: PowerConstraintProvider;
  thermalProvider: ThermalConstraintProvider;
  now: string;
}

export class ReservationManager {
  create(ctx: ReservationManagerContext, request: ReservationRequest): Reservation {
    const profile = this.resolveProfile(ctx, request);
    const existing = ctx.reservations.filter(
      (r) => r.resourceId === profile.resourceId && r.status === 'active',
    );

    const conflict = detectReservationConflict(existing, request, ctx.now);
    if (conflict) {
      throw new ReservationConflictError(profile.resourceId, conflict);
    }

    const resourceAllocations = ctx.allocations.filter(
      (a) => a.resourceId === profile.resourceId && (a.state === 'active' || a.state === 'pending'),
    );

    const availability = evaluateAvailability({
      profile,
      reservations: existing,
      allocations: resourceAllocations,
      powerProvider: ctx.powerProvider,
      thermalProvider: ctx.thermalProvider,
      requestedCapacity: request.capacity,
      now: ctx.now,
    });

    if (!availability.isAvailable) {
      throw new CapacityOvercommitError(profile.resourceId, request.capacity, profile.availableCapacity);
    }

    const reservation: Reservation = {
      id: randomUUID(),
      resourceId: profile.resourceId,
      owner: request.owner,
      requestingAuthority: request.requestingAuthority,
      capacity: request.capacity,
      startsAt: request.startsAt ?? ctx.now,
      expiresAt: request.expiresAt,
      priority: request.priority ?? 0,
      status: 'active',
    };

    return reservation;
  }

  selectCandidate(ctx: ReservationManagerContext, request: ReservationRequest): ResourceProfile | undefined {
    let candidates = ctx.profiles.filter((p) => p.state === 'available' || p.state === 'released');

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
      const existing = ctx.reservations.filter((r) => r.resourceId === profile.resourceId && r.status === 'active');
      const conflict = detectReservationConflict(existing, request, ctx.now);
      if (conflict) continue;

      const resourceAllocations = ctx.allocations.filter(
        (a) => a.resourceId === profile.resourceId && (a.state === 'active' || a.state === 'pending'),
      );
      const result = evaluateAvailability({
        profile,
        reservations: existing,
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

  expireReservations(reservations: Reservation[], now: string): Reservation[] {
    const expired: Reservation[] = [];
    for (const reservation of reservations) {
      if (reservation.status === 'active' && reservation.expiresAt && reservation.expiresAt <= now) {
        expired.push({ ...reservation, status: 'expired' });
      }
    }
    return expired;
  }

  private resolveProfile(ctx: ReservationManagerContext, request: ReservationRequest): ResourceProfile {
    if (request.resourceId) {
      const found = ctx.profiles.find((p) => p.resourceId === request.resourceId);
      if (!found) throw new ReservationConflictError(request.resourceId, 'Resource not found.');
      return found;
    }
    const candidate = this.selectCandidate(ctx, request);
    if (!candidate) throw new ReservationConflictError('unknown', 'No viable resource for reservation.');
    return candidate;
  }
}

export function detectReservationConflict(
  existing: Reservation[],
  request: ReservationRequest,
  now: string,
): string | null {
  const requestPriority = request.priority ?? 0;
  const requestStart = request.startsAt ?? now;
  const requestEnd = request.expiresAt;

  for (const reservation of existing) {
    if (reservation.status !== 'active') continue;

    const overlap = timeRangesOverlap(
      reservation.startsAt,
      reservation.expiresAt,
      requestStart,
      requestEnd,
    );

    if (!overlap) continue;

    if (reservation.priority > requestPriority) {
      return `Higher-priority reservation "${reservation.id}" conflicts.`;
    }

    if (reservation.priority === requestPriority && reservation.owner !== request.owner) {
      return `Equal-priority reservation "${reservation.id}" from different owner conflicts.`;
    }
  }

  return null;
}

function timeRangesOverlap(
  startA: string,
  endA: string | undefined,
  startB: string,
  endB: string | undefined,
): boolean {
  const aEnd = endA ?? '9999-12-31T23:59:59.999Z';
  const bEnd = endB ?? '9999-12-31T23:59:59.999Z';
  return startA < bEnd && startB < aEnd;
}

export function applyReservationToProfile(profile: ResourceProfile, reservation: Reservation, now: string): ResourceProfile {
  const reservedCapacity = profile.reservedCapacity + reservation.capacity;
  const availableCapacity = Math.max(0, profile.maximumCapacity - reservedCapacity - profile.utilizedCapacity);

  return {
    ...profile,
    reservedCapacity,
    availableCapacity,
    state: 'reserved',
    lastUpdated: now,
  };
}

export function releaseReservationFromProfile(
  profile: ResourceProfile,
  reservation: Reservation,
  now: string,
): ResourceProfile {
  const reservedCapacity = Math.max(0, profile.reservedCapacity - reservation.capacity);
  const availableCapacity = Math.max(0, profile.maximumCapacity - reservedCapacity - profile.utilizedCapacity);

  return {
    ...profile,
    reservedCapacity,
    availableCapacity,
    state: reservedCapacity > 0 ? 'reserved' : 'available',
    lastUpdated: now,
  };
}
