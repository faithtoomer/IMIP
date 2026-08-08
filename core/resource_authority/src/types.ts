export type ResourceType =
  | 'cpu'
  | 'cpu-core'
  | 'cpu-pool'
  | 'gpu'
  | 'gpu-memory'
  | 'gpu-queue'
  | 'asic'
  | 'asic-hashboard'
  | 'memory'
  | 'storage'
  | 'cloud'
  | 'remote-worker'
  | 'cluster-node'
  | 'fleet';

export type ResourceState =
  | 'discovered'
  | 'registered'
  | 'available'
  | 'reserved'
  | 'allocated'
  | 'active'
  | 'released'
  | 'unavailable'
  | 'retired';

export type HealthStatus = 'healthy' | 'degraded' | 'faulted' | 'unknown';

export type AllocationMode = 'exclusive' | 'shared' | 'partial' | 'priority' | 'temporary';

export type ReservationStatus = 'pending' | 'active' | 'expired' | 'released' | 'cancelled';

export type AllocationState = 'pending' | 'active' | 'released' | 'expired';

/**
 * Abstract capacity units — dimensionless governance units representing allocatable
 * computational capacity. One unit may represent one core, one GB of memory, one
 * hashboard slot, etc., depending on resource type; IRIA treats all as comparable
 * within a single resource profile.
 */
export interface Capacity {
  /** Numeric capacity in abstract capacity units. */
  units: number;
}

export interface ResourceProfile {
  resourceId: string;
  resourceType: ResourceType;
  hardwareId: string;
  currentOwner?: string;
  requestingAuthority?: string;
  state: ResourceState;
  availableCapacity: number;
  reservedCapacity: number;
  utilizedCapacity: number;
  maximumCapacity: number;
  capabilityRefs: string[];
  healthStatus: HealthStatus;
  powerProfileRef?: string;
  thermalProfileRef?: string;
  lastUpdated: string;
}

export interface Reservation {
  id: string;
  resourceId: string;
  owner: string;
  requestingAuthority: string;
  capacity: number;
  startsAt: string;
  expiresAt?: string;
  priority: number;
  status: ReservationStatus;
}

export interface Allocation {
  id: string;
  resourceId: string;
  owner: string;
  requestingAuthority: string;
  mode: AllocationMode;
  capacity: number;
  leaseStart: string;
  leaseExpiration?: string;
  state: AllocationState;
}

export interface OwnershipRecord {
  resourceId: string;
  owner: string;
  acquiredAt: string;
  leaseExpiration?: string;
  renewalHistory: { renewedAt: string; newExpiration?: string; reason: string }[];
  releaseHistory: { releasedAt: string; reason: string; releasedBy: string }[];
}

export interface UtilizationMetrics {
  resourceId: string;
  utilizedCapacity: number;
  availableCapacity: number;
  reservedCapacity: number;
  maximumCapacity: number;
  utilizationPercent: number;
  recordedAt: string;
}

export interface CapacityForecast {
  resourceId: string;
  projectedExhaustionAt?: string;
  availableCapacity: number;
  reservedCapacity: number;
  utilizedCapacity: number;
  maximumCapacity: number;
  conflicts: string[];
  idleOpportunities: string[];
  forecastedAt: string;
}

export interface ResourceRecommendation {
  resourceId: string;
  kind: 'best-candidate' | 'underutilized' | 'capacity-warning' | 'conflict-risk';
  score: number;
  explanation: string[];
}

export interface ResourceAssessment {
  resourceId: string;
  isAvailable: boolean;
  availabilityReasons: string[];
  constraintViolations: string[];
  assessedAt: string;
}

export interface ResourceAuditRecord {
  timestamp: string;
  resourceId: string;
  kind:
    | 'registered'
    | 'state-transition'
    | 'reservation-created'
    | 'reservation-expired'
    | 'reservation-released'
    | 'allocation-created'
    | 'allocation-activated'
    | 'allocation-released'
    | 'ownership-changed'
    | 'capacity-updated'
    | 'sync-from-inventory';
  details: Record<string, unknown>;
  reason?: string;
  initiatingAuthority?: string;
}

export interface ResourceMetrics {
  totalResources: number;
  byState: Record<ResourceState, number>;
  byType: Record<ResourceType, number>;
  totalAllocatedCapacity: number;
  totalReservedCapacity: number;
  totalAvailableCapacity: number;
  collectedAt: string;
}

export interface ResourceDigitalTwin {
  resourceId: string;
  profile: ResourceProfile;
  ownership: OwnershipRecord | null;
  utilization: UtilizationMetrics;
  forecast: CapacityForecast;
  powerProfileRef?: string;
  thermalProfileRef?: string;
  constraints: {
    powerBlocked: boolean;
    thermalBlocked: boolean;
    healthBlocked: boolean;
  };
  activeReservations: Reservation[];
  activeAllocations: Allocation[];
}

export interface AllocationRequest {
  resourceId?: string;
  resourceType?: ResourceType;
  owner: string;
  requestingAuthority: string;
  mode: AllocationMode;
  capacity: number;
  leaseExpiration?: string;
  capabilityRefs?: string[];
}

export interface ReservationRequest {
  resourceId?: string;
  resourceType?: ResourceType;
  owner: string;
  requestingAuthority: string;
  capacity: number;
  startsAt?: string;
  expiresAt?: string;
  priority?: number;
  capabilityRefs?: string[];
}

export interface ResourceHistoryEntry {
  timestamp: string;
  resourceId: string;
  kind: 'reservation' | 'allocation' | 'ownership';
  action: string;
  details: Record<string, unknown>;
}
