/**
 * IRAA-owned allocation-shaped input. This intentionally mirrors only the structural
 * request shape IRIA accepts and is not imported from Resource Authority.
 */
export type ArbitrationResourceType =
  | 'cpu' | 'cpu-core' | 'cpu-pool' | 'gpu' | 'gpu-memory' | 'gpu-queue'
  | 'asic' | 'asic-hashboard' | 'memory' | 'storage' | 'cloud'
  | 'remote-worker' | 'cluster-node' | 'fleet';

export type ArbitrationAllocationMode = 'exclusive' | 'shared' | 'partial' | 'priority' | 'temporary';
export type ResourceHealthStatus = 'healthy' | 'degraded' | 'faulted' | 'unknown';
export type ArbitrationLifecycleStage =
  | 'request-received' | 'contention-detected' | 'policy-evaluation'
  | 'constraint-evaluation' | 'winner-selected' | 'decision-published' | 'history-archived';
export type NamedArbitrationPolicyName =
  | 'first-come-first-served' | 'priority-based' | 'fair-share' | 'reservation-first'
  | 'exclusive-access' | 'shared-allocation' | 'emergency-override'
  | 'future-ai-recommendations-advisory-only';
/** Open string preserves plug-in extensibility beyond the eight required policies. */
export type ArbitrationPolicyName = NamedArbitrationPolicyName | (string & {});
export type DeferredDisposition = 'deferred' | 'denied';
export type StarvationKind = 'long-waiting-request' | 'priority-inversion' | 'resource-monopolization' | 'queue-imbalance';

export interface ArbitrationRequest {
  /** Stable caller-supplied identity; lexicographic ordering breaks score ties. */
  requestId: string;
  resourceId?: string;
  resourceType?: ArbitrationResourceType;
  owner: string;
  requestingAuthority: string;
  mode: ArbitrationAllocationMode;
  capacity: number;
  priority: number;
  leaseExpiration?: string;
  capabilityRefs?: string[];
  /** Reservation evidence supplied by an injected composition adapter. */
  reservationId?: string;
  /** Explicit emergency classification supplied by an external policy source. */
  emergency?: boolean;
  /** Future AI signal. The advisory policy documents it but never changes score or eligibility. */
  aiRecommendation?: string;
}

export interface ResourceAvailability {
  available: boolean;
  availableCapacity?: number;
  activeOwners?: string[];
  existingExclusiveAllocation?: boolean;
  reservationOwner?: string;
  reason?: string;
}
export interface ResourceHealth {
  status: ResourceHealthStatus;
  reason?: string;
}
export interface ThermalConstraint { permitted: boolean; reason?: string; currentCelsius?: number; maximumCelsius?: number; }
export interface PowerConstraint { permitted: boolean; reason?: string; availableWatts?: number; requiredWatts?: number; }
export interface RuntimeState { permitted: boolean; state?: string; reason?: string; }

export interface CompetingRequestProvider { getCompetingRequests(): ArbitrationRequest[]; }
export interface ResourceAvailabilityProvider { getAvailability(resourceId: string | undefined, request: ArbitrationRequest): ResourceAvailability; }
export interface ResourceHealthProvider { getHealth(resourceId: string | undefined, request: ArbitrationRequest): ResourceHealth; }
export interface ThermalConstraintProvider { getThermalConstraint(resourceId: string | undefined, request: ArbitrationRequest): ThermalConstraint; }
export interface PowerConstraintProvider { getPowerConstraint(resourceId: string | undefined, request: ArbitrationRequest): PowerConstraint; }
export interface RuntimeStateProvider { getRuntimeState(request: ArbitrationRequest): RuntimeState; }

export interface ArbitrationProviders {
  competingRequests?: CompetingRequestProvider;
  availability?: ResourceAvailabilityProvider;
  health?: ResourceHealthProvider;
  thermal?: ThermalConstraintProvider;
  power?: PowerConstraintProvider;
  runtime?: RuntimeStateProvider;
}

export interface RequestConstraintEvaluation {
  requestId: string;
  availability: ResourceAvailability;
  health: ResourceHealth;
  thermal: ThermalConstraint;
  power: PowerConstraint;
  runtime: RuntimeState;
  eligible: boolean;
  violations: string[];
}

export interface PolicyResult {
  policy: ArbitrationPolicyName;
  requestId: string;
  scoreAdjustment: number;
  eligible: boolean;
  rationale: string[];
  advisoryOnly?: true;
}

export interface PolicyContext {
  resourceKey: string;
  requests: readonly ArbitrationRequest[];
  constraints: ReadonlyMap<string, RequestConstraintEvaluation>;
  firstSeenAt: ReadonlyMap<string, string>;
  historicalGrantsByOwner: ReadonlyMap<string, number>;
  now: string;
  starvationThresholdMs: number;
}

/** Pluggable data-driven policy contract; policies cannot allocate or reserve anything. */
export interface Policy {
  readonly name: ArbitrationPolicyName;
  evaluate(context: PolicyContext): PolicyResult[];
}

export interface ArbitrationScore {
  requestId: string;
  total: number;
  policyResults: PolicyResult[];
  constraint: RequestConstraintEvaluation;
  firstSeenAt: string;
}

export interface DeferredRequest {
  requestId: string;
  disposition: DeferredDisposition;
  reason: string;
}

export interface ArbitrationExplanation {
  competingRequests: string[];
  contestedResource: string;
  scores: ArbitrationScore[];
  policies: ArbitrationPolicyName[];
  constraints: RequestConstraintEvaluation[];
  decisionRationale: string;
  fairnessEvaluation: string;
}

export interface ArbitrationDecision {
  decisionId: string;
  arbitrationId: string;
  timestamp: string;
  contestedResource: string;
  winningRequestId?: string;
  deferredRequests: DeferredRequest[];
  policiesApplied: ArbitrationPolicyName[];
  decisionScore?: number;
  explanation: ArbitrationExplanation;
  /** A decision is binding arbitration evidence, not an IRIA allocation result. */
  allocationSubmitted: false;
}

export interface ArbitrationRecord {
  arbitrationId: string;
  timestamp: string;
  contestedResource: string;
  competingRequests: ArbitrationRequest[];
  stage: ArbitrationLifecycleStage;
  winningRequestId?: string;
  deferredRequests: DeferredRequest[];
  policiesApplied: ArbitrationPolicyName[];
  decisionScore?: number;
  explainabilityRecord?: ArbitrationExplanation;
  decision?: ArbitrationDecision;
  failureReason?: string;
}

export interface ArbitrationLifecycleRecord {
  arbitrationId: string;
  from: ArbitrationLifecycleStage | undefined;
  to: ArbitrationLifecycleStage;
  at: string;
  reason: string;
}

export interface StarvationFinding {
  kind: StarvationKind;
  resourceKey: string;
  requestIds: string[];
  detectedAt: string;
  details: string;
}

export interface ArbitrationKnowledgeRecord {
  knowledgeId: string;
  arbitrationId: string;
  recordedAt: string;
  contestedResource: string;
  winnerOwner?: string;
  winnerRequestId?: string;
  policyNames: ArbitrationPolicyName[];
  deferredCount: number;
  deniedCount: number;
  fairnessMetric: { winnerHistoricalGrants: number; maximumWaitMs: number; queueDepth: number };
  contentionPattern: string;
}

export interface IAKBQuery { resourceId?: string; owner?: string; policy?: ArbitrationPolicyName; }
