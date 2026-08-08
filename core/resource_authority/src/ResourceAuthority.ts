import { ResourceRegistry } from './registry.js';
import { AllocationEngine, applyAllocationToProfile, releaseAllocationFromProfile } from './allocation.js';
import {
  ReservationManager,
  applyReservationToProfile,
  releaseReservationFromProfile,
} from './reservation.js';
import { OwnershipManager } from './ownership.js';
import { ResourceHistoryStore } from './history.js';
import { RESOURCE_EVENTS, ResourceEventBus, type ResourceEventName } from './events.js';
import { ResourceAuditTrail } from './explainability.js';
import { MetricsCollector } from './metrics.js';
import { assertResourceStateTransition } from './lifecycle.js';
import { evaluateAvailability } from './availability.js';
import { computeUtilization, computeFleetUtilization } from './utilization.js';
import { computeCapacityForecast, computeFleetForecast } from './forecast.js';
import { generateRecommendations } from './recommendations.js';
import {
  assembleResourceDigitalTwin,
  rankCandidatesForWorkload,
  explainUnavailability,
  projectedImpactOfAllocation,
} from './digitalTwin.js';
import {
  NullHardwareInventoryProvider,
  NullPowerConstraintProvider,
  NullThermalConstraintProvider,
  type HardwareInventoryProvider,
  type PowerConstraintProvider,
  type ThermalConstraintProvider,
} from './providers.js';
import { ResourceNotFoundError } from './errors.js';
import type {
  Allocation,
  AllocationRequest,
  CapacityForecast,
  Reservation,
  ReservationRequest,
  ResourceAssessment,
  ResourceDigitalTwin,
  ResourceHistoryEntry,
  ResourceMetrics,
  ResourceProfile,
  ResourceRecommendation,
  ResourceState,
  UtilizationMetrics,
} from './types.js';

export interface ResourceAuthorityOptions {
  hardwareInventoryProvider?: HardwareInventoryProvider;
  powerConstraintProvider?: PowerConstraintProvider;
  thermalConstraintProvider?: ThermalConstraintProvider;
  now?: () => string;
}

/**
 * IRIA — Institutional Resource Intelligence Authority (PHASE-18).
 *
 * Pipeline: hardware inventory sync → registry → availability → reservation/allocation
 * → ownership → utilization/forecast → event publication. Every resource is
 * additionally assembled into an Institutional Resource Digital Twin (IRDT).
 */
export class ResourceAuthority {
  readonly registry = new ResourceRegistry();
  readonly events = new ResourceEventBus();
  readonly audit = new ResourceAuditTrail();
  readonly ownership = new OwnershipManager();
  readonly history = new ResourceHistoryStore();
  readonly metrics = new MetricsCollector();

  private readonly allocationEngine = new AllocationEngine();
  private readonly reservationManager = new ReservationManager();
  private readonly hardwareInventory: HardwareInventoryProvider;
  private readonly powerProvider: PowerConstraintProvider;
  private readonly thermalProvider: ThermalConstraintProvider;
  private readonly nowFn: () => string;

  private reservations: Reservation[] = [];
  private allocations: Allocation[] = [];

  constructor(options: ResourceAuthorityOptions = {}) {
    this.hardwareInventory = options.hardwareInventoryProvider ?? new NullHardwareInventoryProvider();
    this.powerProvider = options.powerConstraintProvider ?? new NullPowerConstraintProvider();
    this.thermalProvider = options.thermalConstraintProvider ?? new NullThermalConstraintProvider();
    this.nowFn = options.now ?? (() => new Date().toISOString());
  }

  private now(): string {
    return this.nowFn();
  }

  private engineCtx() {
    return {
      profiles: this.registry.all(),
      reservations: this.reservations,
      allocations: this.allocations,
      powerProvider: this.powerProvider,
      thermalProvider: this.thermalProvider,
      now: this.now(),
    };
  }

  /** Sync allocatable units from hardware inventory into the resource registry. */
  async syncFromHardwareInventory(): Promise<ResourceProfile[]> {
    const units = await this.hardwareInventory.listAllocatableUnits();
    const now = this.now();
    const synced: ResourceProfile[] = [];

    for (const unit of [...units].sort((a, b) => a.hardwareId.localeCompare(b.hardwareId))) {
      const resourceId = `${unit.hardwareId}:${unit.resourceType}`;
      const existing = this.registry.get(resourceId);
      const powerRef = this.powerProvider.powerProfileRef?.(unit.hardwareId);
      const thermalRef = this.thermalProvider.thermalProfileRef?.(unit.hardwareId);

      const profile: ResourceProfile = {
        resourceId,
        resourceType: unit.resourceType,
        hardwareId: unit.hardwareId,
        currentOwner: existing?.currentOwner,
        requestingAuthority: existing?.requestingAuthority,
        state: existing?.state ?? 'discovered',
        availableCapacity: existing?.availableCapacity ?? unit.maximumCapacity,
        reservedCapacity: existing?.reservedCapacity ?? 0,
        utilizedCapacity: existing?.utilizedCapacity ?? 0,
        maximumCapacity: unit.maximumCapacity,
        capabilityRefs: [...unit.capabilityRefs].sort(),
        healthStatus: unit.healthStatus,
        powerProfileRef: powerRef ?? existing?.powerProfileRef,
        thermalProfileRef: thermalRef ?? existing?.thermalProfileRef,
        lastUpdated: now,
      };

      if (!existing) {
        let current = this.transitionState(profile, 'registered', 'sync-from-inventory', 'Resource Authority');
        current = this.transitionState(current, 'available', 'inventory-registered', 'Resource Authority');
        this.events.publish(RESOURCE_EVENTS.ResourceRegistered, { resourceId });
        this.events.publish(RESOURCE_EVENTS.ResourceAvailable, { resourceId });
        this.audit.record({
          timestamp: now,
          resourceId,
          kind: 'sync-from-inventory',
          details: { hardwareId: unit.hardwareId, resourceType: unit.resourceType },
          initiatingAuthority: 'Resource Authority',
        });
        synced.push(current);
      } else {
        const updated: ResourceProfile = {
          ...existing,
          maximumCapacity: unit.maximumCapacity,
          capabilityRefs: [...unit.capabilityRefs].sort(),
          healthStatus: unit.healthStatus,
          powerProfileRef: powerRef ?? existing.powerProfileRef,
          thermalProfileRef: thermalRef ?? existing.thermalProfileRef,
          availableCapacity: Math.max(
            0,
            unit.maximumCapacity - existing.reservedCapacity - existing.utilizedCapacity,
          ),
          lastUpdated: now,
        };
        this.registry.upsert(updated);
        synced.push(updated);
        this.audit.record({
          timestamp: now,
          resourceId,
          kind: 'capacity-updated',
          details: { maximumCapacity: unit.maximumCapacity },
          initiatingAuthority: 'Resource Authority',
        });
      }
    }

    return synced;
  }

  requestReservation(request: ReservationRequest): Reservation {
    const now = this.now();
    const ctx = { ...this.engineCtx(), now };

    let resolvedRequest = { ...request };
    if (!request.resourceId) {
      const candidate = this.reservationManager.selectCandidate(ctx, request);
      if (!candidate) throw new Error('No viable resource for reservation.');
      resolvedRequest = { ...request, resourceId: candidate.resourceId };
    }

    const reservation = this.reservationManager.create(ctx, resolvedRequest);
    this.reservations.push(reservation);

    const profile = this.registry.require(reservation.resourceId);
    const updated = applyReservationToProfile(profile, reservation, now);
    this.registry.upsert(updated);

    this.history.append({
      timestamp: now,
      resourceId: reservation.resourceId,
      kind: 'reservation',
      action: 'created',
      details: { reservationId: reservation.id, capacity: reservation.capacity, owner: reservation.owner },
    });

    this.audit.record({
      timestamp: now,
      resourceId: reservation.resourceId,
      kind: 'reservation-created',
      details: { reservationId: reservation.id },
      initiatingAuthority: request.requestingAuthority,
    });

    this.events.publish(RESOURCE_EVENTS.ResourceReserved, {
      resourceId: reservation.resourceId,
      reservationId: reservation.id,
    });

    this.publishUtilizationUpdate(reservation.resourceId, now);
    return reservation;
  }

  requestAllocation(request: AllocationRequest): Allocation {
    const now = this.now();
    const ctx = { ...this.engineCtx(), now };

    let resolvedRequest = { ...request };
    if (!request.resourceId) {
      const candidate = this.allocationEngine.selectCandidate(ctx, request);
      if (!candidate) throw new Error('No viable resource for allocation.');
      resolvedRequest = { ...request, resourceId: candidate.resourceId };
    }

    const allocation = this.allocationEngine.allocate(ctx, resolvedRequest);
    this.allocations.push(allocation);

    const profile = this.registry.require(allocation.resourceId);
    const updated = applyAllocationToProfile(profile, allocation, now);
    this.registry.upsert(updated);

    this.ownership.establish(allocation.resourceId, allocation.owner, now, allocation.leaseExpiration);

    this.history.append({
      timestamp: now,
      resourceId: allocation.resourceId,
      kind: 'allocation',
      action: 'created',
      details: { allocationId: allocation.id, mode: allocation.mode, capacity: allocation.capacity },
    });

    this.audit.record({
      timestamp: now,
      resourceId: allocation.resourceId,
      kind: 'allocation-created',
      details: { allocationId: allocation.id, mode: allocation.mode },
      initiatingAuthority: request.requestingAuthority,
    });

    this.events.publish(RESOURCE_EVENTS.ResourceAllocated, {
      resourceId: allocation.resourceId,
      allocationId: allocation.id,
    });

    this.events.publish(RESOURCE_EVENTS.ResourceOwnershipChanged, {
      resourceId: allocation.resourceId,
      owner: allocation.owner,
    });

    this.publishUtilizationUpdate(allocation.resourceId, now);
    return allocation;
  }

  activate(allocationId: string, initiatingAuthority: string): Allocation {
    const now = this.now();
    const allocation = this.allocations.find((a) => a.id === allocationId);
    if (!allocation) throw new ResourceNotFoundError(allocationId);

    allocation.state = 'active';
    const profile = this.registry.require(allocation.resourceId);
    this.transitionState(profile, 'active', 'allocation-activated', initiatingAuthority);

    this.audit.record({
      timestamp: now,
      resourceId: allocation.resourceId,
      kind: 'allocation-activated',
      details: { allocationId },
      initiatingAuthority,
    });

    this.publishUtilizationUpdate(allocation.resourceId, now);
    return allocation;
  }

  release(
    resourceId: string,
    options: { allocationId?: string; reservationId?: string; reason: string; initiatingAuthority: string },
  ): void {
    const now = this.now();
    const profile = this.registry.require(resourceId);

    if (options.allocationId) {
      const idx = this.allocations.findIndex((a) => a.id === options.allocationId);
      if (idx === -1) throw new ResourceNotFoundError(options.allocationId);
      const allocation = this.allocations[idx]!;
      allocation.state = 'released';

      const updated = releaseAllocationFromProfile(profile, allocation, now);
      this.registry.upsert(updated);
      this.transitionState(this.registry.require(resourceId), 'released', options.reason, options.initiatingAuthority);

      this.ownership.release(resourceId, now, options.reason, options.initiatingAuthority);

      this.history.append({
        timestamp: now,
        resourceId,
        kind: 'allocation',
        action: 'released',
        details: { allocationId: allocation.id, reason: options.reason },
      });

      this.audit.record({
        timestamp: now,
        resourceId,
        kind: 'allocation-released',
        details: { allocationId: allocation.id },
        reason: options.reason,
        initiatingAuthority: options.initiatingAuthority,
      });

      this.events.publish(RESOURCE_EVENTS.ResourceReleased, { resourceId, allocationId: allocation.id });
      this.events.publish(RESOURCE_EVENTS.ResourceOwnershipChanged, { resourceId, owner: null });
    }

    if (options.reservationId) {
      const reservation = this.reservations.find((r) => r.id === options.reservationId);
      if (!reservation) throw new ResourceNotFoundError(options.reservationId);
      reservation.status = 'released';

      const updated = releaseReservationFromProfile(profile, reservation, now);
      this.registry.upsert(updated);
      if (updated.state !== profile.state) {
        this.audit.record({
          timestamp: now,
          resourceId,
          kind: 'state-transition',
          details: { from: profile.state, to: updated.state },
          reason: options.reason,
          initiatingAuthority: options.initiatingAuthority,
        });
      }

      this.history.append({
        timestamp: now,
        resourceId,
        kind: 'reservation',
        action: 'released',
        details: { reservationId: reservation.id, reason: options.reason },
      });

      this.audit.record({
        timestamp: now,
        resourceId,
        kind: 'reservation-released',
        details: { reservationId: reservation.id },
        reason: options.reason,
        initiatingAuthority: options.initiatingAuthority,
      });
    }

    const current = this.registry.require(resourceId);
    if (current.state === 'released') {
      this.transitionState(current, 'available', 'post-release-available', options.initiatingAuthority);
      this.registry.upsert(this.registry.require(resourceId));
      this.events.publish(RESOURCE_EVENTS.ResourceAvailable, { resourceId });
    }

    this.publishUtilizationUpdate(resourceId, now);
  }

  expireReservations(): Reservation[] {
    const now = this.now();
    const expired = this.reservationManager.expireReservations(this.reservations, now);
    const expiredIds = new Set(expired.map((r) => r.id));

    for (const reservation of this.reservations) {
      if (!expiredIds.has(reservation.id)) continue;
      reservation.status = 'expired';

      const profile = this.registry.require(reservation.resourceId);
      const updated = releaseReservationFromProfile(profile, reservation, now);
      this.registry.upsert(updated);

      this.audit.record({
        timestamp: now,
        resourceId: reservation.resourceId,
        kind: 'reservation-expired',
        details: { reservationId: reservation.id },
      });

      this.events.publish(RESOURCE_EVENTS.ResourceReservationExpired, {
        resourceId: reservation.resourceId,
        reservationId: reservation.id,
      });

      this.history.append({
        timestamp: now,
        resourceId: reservation.resourceId,
        kind: 'reservation',
        action: 'expired',
        details: { reservationId: reservation.id },
      });
    }

    return expired;
  }

  getResource(resourceId: string): ResourceProfile {
    return this.registry.require(resourceId);
  }

  getUtilization(resourceId?: string): UtilizationMetrics | UtilizationMetrics[] {
    const now = this.now();
    if (resourceId) {
      const profile = this.registry.require(resourceId);
      return computeUtilization(
        profile,
        this.allocations.filter((a) => a.resourceId === resourceId),
        this.reservations.filter((r) => r.resourceId === resourceId),
        now,
      );
    }
    return computeFleetUtilization(this.registry.all(), this.allocations, this.reservations, now);
  }

  getForecast(resourceId?: string): CapacityForecast | CapacityForecast[] {
    const now = this.now();
    if (resourceId) {
      const profile = this.registry.require(resourceId);
      return computeCapacityForecast({
        profile,
        allocations: this.allocations.filter((a) => a.resourceId === resourceId),
        reservations: this.reservations.filter((r) => r.resourceId === resourceId),
        forecastedAt: now,
      });
    }
    return computeFleetForecast(this.registry.all(), this.allocations, this.reservations, now);
  }

  getAssessment(resourceId: string): ResourceAssessment {
    const now = this.now();
    const profile = this.registry.require(resourceId);
    const result = evaluateAvailability({
      profile,
      reservations: this.reservations.filter((r) => r.resourceId === resourceId),
      allocations: this.allocations.filter((a) => a.resourceId === resourceId),
      powerProvider: this.powerProvider,
      thermalProvider: this.thermalProvider,
      now,
    });

    return {
      resourceId,
      isAvailable: result.isAvailable,
      availabilityReasons: result.reasons,
      constraintViolations: result.constraintViolations,
      assessedAt: now,
    };
  }

  getDigitalTwin(resourceId: string): ResourceDigitalTwin {
    const profile = this.registry.require(resourceId);
    return assembleResourceDigitalTwin({
      profile,
      ownership: this.ownership.get(resourceId) ?? null,
      allocations: this.allocations.filter((a) => a.resourceId === resourceId),
      reservations: this.reservations.filter((r) => r.resourceId === resourceId),
      powerProvider: this.powerProvider,
      thermalProvider: this.thermalProvider,
      now: this.now(),
    });
  }

  getHistory(resourceId?: string): ResourceHistoryEntry[] {
    if (resourceId) return this.history.forResource(resourceId);
    return [...this.history.all()];
  }

  getRecommendations(options?: {
    requestedCapacity?: number;
    capabilityRefs?: string[];
  }): ResourceRecommendation[] {
    const now = this.now();
    const profiles = this.registry.all();
    const utilization = computeFleetUtilization(profiles, this.allocations, this.reservations, now);
    const forecasts = computeFleetForecast(profiles, this.allocations, this.reservations, now);

    return generateRecommendations({
      profiles,
      allocations: this.allocations,
      reservations: this.reservations,
      utilization,
      forecasts,
      requestedCapacity: options?.requestedCapacity,
      capabilityRefs: options?.capabilityRefs,
    });
  }

  getMetrics(): ResourceMetrics {
    return this.metrics.collect(this.registry.all(), this.now());
  }

  rankCandidatesForWorkload(request: AllocationRequest) {
    return rankCandidatesForWorkload(
      this.registry.all(),
      this.allocations,
      this.reservations,
      request,
      this.powerProvider,
      this.thermalProvider,
      this.now(),
    );
  }

  explainUnavailability(resourceId: string): string[] {
    return explainUnavailability(this.getDigitalTwin(resourceId));
  }

  projectedImpactOfAllocation(resourceId: string, requestedCapacity: number) {
    return projectedImpactOfAllocation(this.getDigitalTwin(resourceId), requestedCapacity);
  }

  subscribe(event: ResourceEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  private transitionState(
    profile: ResourceProfile,
    to: ResourceState,
    reason: string,
    initiatingAuthority: string,
  ): ResourceProfile {
    const from = profile.state;
    assertResourceStateTransition(from, to);
    const now = this.now();
    const updated: ResourceProfile = { ...profile, state: to, lastUpdated: now };
    this.registry.upsert(updated);

    this.audit.record({
      timestamp: now,
      resourceId: profile.resourceId,
      kind: 'state-transition',
      details: { from, to },
      reason,
      initiatingAuthority,
    });

    if (to === 'unavailable') {
      this.events.publish(RESOURCE_EVENTS.ResourceUnavailable, { resourceId: profile.resourceId });
    }

    return updated;
  }

  private publishUtilizationUpdate(resourceId: string, now: string): void {
    const utilization = computeUtilization(
      this.registry.require(resourceId),
      this.allocations.filter((a) => a.resourceId === resourceId),
      this.reservations.filter((r) => r.resourceId === resourceId),
      now,
    );
    this.events.publish(RESOURCE_EVENTS.ResourceUtilizationUpdated, { resourceId, utilization });

    const forecast = computeCapacityForecast({
      profile: this.registry.require(resourceId),
      allocations: this.allocations.filter((a) => a.resourceId === resourceId),
      reservations: this.reservations.filter((r) => r.resourceId === resourceId),
      forecastedAt: now,
    });
    this.events.publish(RESOURCE_EVENTS.ResourceForecastUpdated, { resourceId, forecast });
  }
}
