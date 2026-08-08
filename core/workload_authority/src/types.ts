/** Workload classes governed by IWIA (§4). */
export type WorkloadType =
  | 'cpu-mining'
  | 'gpu-mining'
  | 'asic-mining'
  | 'benchmarking'
  | 'ai-training'
  | 'ai-inference'
  | 'diagnostics'
  | 'maintenance'
  | 'data-processing'
  | 'future';

/** The nine approved workload lifecycle states (§5). */
export type WorkloadState =
  | 'created'
  | 'validated'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'archived';

export type WorkloadRuntimeState =
  | 'not-started'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'archived';

export type WorkloadOutcome = 'completed' | 'failed' | 'cancelled';

/**
 * Workload-declared requirements are sent to a ResourceCandidateProvider. They do
 * not allocate capacity; IRIA remains the owner of resource-side interpretation.
 */
export interface WorkloadResourceRequirements {
  resourceType?: string;
  requestedCapacity?: number;
  capabilityRefs?: string[];
}

export interface WorkloadPowerProfile {
  expectedWatts?: number;
  maximumWatts?: number;
  reference?: string;
}

export interface WorkloadThermalProfile {
  expectedCelsius?: number;
  maximumCelsius?: number;
  reference?: string;
}

export interface WorkloadHistoricalPerformance {
  completedRuns: number;
  failedRuns: number;
  successRate: number;
  averageDurationMs?: number;
  averageThroughput?: number;
  lastCompletedAt?: string;
  lastFailedAt?: string;
}

/** An externally confirmed resource relationship; never a resource allocation. */
export interface AssignedResource {
  resourceId: string;
  confirmedAt: string;
  confirmedBy: string;
  providerRank?: number;
  providerExplanation?: string[];
}

/** §6 — the authoritative workload profile kept by the Workload Registry. */
export interface WorkloadProfile {
  workloadId: string;
  type: WorkloadType;
  owner: string;
  state: WorkloadState;
  assignedResources: AssignedResource[];
  runtimeState: WorkloadRuntimeState;
  estimatedDurationMs: number;
  priority: number;
  priorityReason: string;
  dependencies: string[];
  resourceRequirements: WorkloadResourceRequirements;
  powerProfile: WorkloadPowerProfile;
  thermalProfile: WorkloadThermalProfile;
  historicalPerformance: WorkloadHistoricalPerformance;
  createdReason: string;
  createdAt: string;
  lastUpdated: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  failedAt?: string;
  archivedAt?: string;
  outcome?: WorkloadOutcome;
}

export interface WorkloadCreateRequest {
  workloadId?: string;
  type: WorkloadType;
  owner: string;
  estimatedDurationMs: number;
  priority?: number;
  priorityReason?: string;
  dependencies?: string[];
  resourceRequirements?: WorkloadResourceRequirements;
  powerProfile?: WorkloadPowerProfile;
  thermalProfile?: WorkloadThermalProfile;
  createdReason: string;
}

/** A measured workload sample, independent of Power Authority's WorkloadTelemetry. */
export interface WorkloadTelemetrySample {
  workloadId: string;
  recordedAt: string;
  resourceUsage: {
    cpuPercent?: number;
    gpuPercent?: number;
    memoryMb?: number;
    storageMb?: number;
    assignedResourceUtilizationPercent?: number;
  };
  thermalCelsius?: number;
  powerWatts?: number;
  throughput?: number;
  idle?: boolean;
}

export interface WorkloadForecast {
  workloadId: string;
  forecastedAt: string;
  predictedCompletionAt?: string;
  estimatedRemainingMs?: number;
  queueDelayMs?: number;
  confidence: number;
  basis: string[];
}

/** The minimal read contract IWIA consumes from IRIA through composition wiring. */
export interface ResourceCandidate {
  resourceId: string;
  score: number;
  explanation: string[];
}

export interface ResourceCandidateRequest {
  workloadId: string;
  workloadType: WorkloadType;
  priority: number;
  estimatedDurationMs: number;
  resourceRequirements: WorkloadResourceRequirements;
}

export interface ResourceCandidateProvider {
  rankCandidatesForWorkload(request: ResourceCandidateRequest): ResourceCandidate[];
}

export type WorkloadPlacementAction = 'place-now' | 'queue' | 'defer';

/** Advisory workload-side result; it has no allocation or scheduling effect. */
export interface WorkloadPlacementRecommendation {
  workloadId: string;
  action: WorkloadPlacementAction;
  priority: number;
  selectedCandidate?: ResourceCandidate;
  candidates: ResourceCandidate[];
  reasons: string[];
  recommendedAt: string;
}

export interface WorkloadBalanceRecommendation {
  workloadId: string;
  priority: number;
  position: number;
  placement: WorkloadPlacementRecommendation;
  reasons: string[];
}

export interface WorkloadBottleneck {
  kind: 'dependency-wait' | 'queue-delay' | 'resource-contention' | 'thermal-pressure' | 'idle-runtime' | 'no-throughput';
  severity: 'info' | 'warning' | 'critical';
  explanation: string;
}

/** §11 — the Institutional Workload Digital Twin. */
export interface WorkloadDigitalTwin {
  workloadId: string;
  profile: WorkloadProfile;
  resourceUsage: WorkloadTelemetrySample['resourceUsage'];
  thermalImpact: {
    currentCelsius?: number;
    peakCelsius?: number;
    status: 'unknown' | 'normal' | 'elevated' | 'critical';
  };
  powerConsumption: {
    currentWatts?: number;
    averageWatts?: number;
    peakWatts?: number;
  };
  runtimeEfficiency: {
    averageThroughput?: number;
    throughputPerWatt?: number;
    idlePercent: number;
  };
  historicalPerformance: WorkloadHistoricalPerformance;
  forecast: WorkloadForecast;
  bottlenecks: WorkloadBottleneck[];
  updatedAt: string;
}

export interface WorkloadHistoryEntry {
  timestamp: string;
  workloadId: string;
  kind: 'lifecycle' | 'assignment' | 'priority' | 'telemetry' | 'forecast' | 'recommendation';
  action: string;
  details: Record<string, unknown>;
  reason?: string;
  initiatingAuthority?: string;
}

export interface WorkloadAuditRecord {
  timestamp: string;
  workloadId: string;
  kind:
    | 'created'
    | 'validated'
    | 'queued'
    | 'assigned'
    | 'started'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'archived'
    | 'priority-updated'
    | 'telemetry-recorded'
    | 'forecast-updated'
    | 'placement-recommended';
  details: Record<string, unknown>;
  reason?: string;
  initiatingAuthority?: string;
}

export interface WorkloadExplanation {
  workloadId: string;
  created: string;
  assigned: string;
  resource: string;
  priority: string;
  completed: string;
  failed: string;
  evidence: WorkloadAuditRecord[];
}
