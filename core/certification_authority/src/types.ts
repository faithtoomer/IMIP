/**
 * IHCA-owned certification vocabulary. These are structural contracts, not imports
 * from any evidence-producing authority.
 */
export type CertificationLevel =
  | 'experimental'
  | 'development'
  | 'qualified'
  | 'production'
  | 'mission-critical';

export type CertificationStatus =
  | 'pending'
  | 'qualified'
  | 'certified'
  | 'production-approved'
  | 'recertified'
  | 'denied'
  | 'expired'
  | 'revoked';

export type CertificationLifecycleStage =
  | 'discovered'
  | 'evaluated'
  | 'qualified'
  | 'certified'
  | 'production-approved'
  | 'recertified'
  | 'revoked';

export type CertificationEvidenceType =
  | 'hardware-capability'
  | 'benchmark'
  | 'health'
  | 'power'
  | 'thermal'
  | 'resource-utilization'
  | 'error-history'
  | 'driver-compatibility'
  | 'runtime-stability'
  | 'operational-uptime';

export type EvidenceMetric =
  | 'benchmarkScore'
  | 'healthScore'
  | 'powerEfficiencyScore'
  | 'thermalStabilityScore'
  | 'reliabilityScore'
  | 'stabilityScore'
  | 'compatibilityScore'
  | 'resourceUtilizationScore'
  | 'errorHistoryScore'
  | 'runtimeStabilityScore'
  | 'operationalUptimeScore'
  | 'capabilityScore';

/** All evidence scores use a documented 0–100 scale where higher is safer. */
export type CertificationEvidenceMetrics = Partial<Record<EvidenceMetric, number>>;

/**
 * An immutable observation supplied by a composition adapter. The provider remains
 * the owner of raw telemetry, benchmark runs, health history, and discovery state.
 */
export interface CertificationEvidence {
  evidenceId: string;
  type: CertificationEvidenceType;
  source: string;
  observedAt: string;
  metrics: CertificationEvidenceMetrics;
  references?: string[];
  passed?: boolean;
  details?: Record<string, unknown>;
}

export interface CertificationEvidenceAttachment {
  certificationId: string;
  evidence: CertificationEvidence;
  attachedAt: string;
}

export interface CertificationRequirementResult {
  requirement: string;
  passed: boolean;
  observed?: number;
  required?: number;
  evidenceTypes: CertificationEvidenceType[];
  rationale: string;
}

export interface CertificationPolicyResult {
  policyName: string;
  level: CertificationLevel;
  eligible: boolean;
  requirements: CertificationRequirementResult[];
  rationale: string[];
}

export interface CertificationDecision {
  decisionId: string;
  certificationId: string;
  hardwareUuid: string;
  level: CertificationLevel;
  determinedAt: string;
  passed: boolean;
  policyResults: CertificationPolicyResult[];
  evidenceRefs: string[];
  testsPassed: string[];
  requirementsFailed: string[];
  rationale: string;
}

export interface RevocationRecord {
  revokedAt: string;
  reason: string;
  evidenceRefs: string[];
}

/**
 * The Certification Registry owns this decision/audit record, not source
 * measurements. `nextRecertificationDue` is advisory scheduling evidence only.
 */
export interface CertificationRecord {
  certificationId: string;
  hardwareUuid: string;
  deviceType: string;
  level: CertificationLevel;
  status: CertificationStatus;
  stage: CertificationLifecycleStage;
  createdAt: string;
  updatedAt: string;
  certificationDate?: string;
  expirationDate?: string;
  nextRecertificationDue?: string;
  recertificationIntervalDays?: number;
  evidenceRefs: string[];
  auditorVersion: string;
  notes: string[];
  policiesApplied: string[];
  decision?: CertificationDecision;
  revocationHistory: RevocationRecord[];
}

export interface CertificationRequest {
  hardwareUuid: string;
  deviceType: string;
  level: CertificationLevel;
  auditorVersion: string;
  notes?: string[];
  /** Policy or caller supplied expiry; IHCA only records it. */
  expirationDate?: string;
  /** Advisory interval used only to calculate the recorded next due date. */
  recertificationIntervalDays?: number;
}

export interface CertificationLifecycleRecord {
  certificationId: string;
  from: CertificationLifecycleStage | undefined;
  to: CertificationLifecycleStage;
  at: string;
  reason: string;
}

export interface CertificationPolicyContext {
  certification: Readonly<CertificationRecord>;
  evidence: readonly CertificationEvidence[];
  aggregateMetrics: Readonly<Partial<Record<EvidenceMetric, number>>>;
}

/** A pluggable, level-specific decision contract. It cannot alter source state. */
export interface CertificationPolicy {
  readonly name: string;
  readonly level: CertificationLevel;
  evaluate(context: CertificationPolicyContext): CertificationPolicyResult;
}

export interface CertificationLevelRequirements {
  readonly minimumEvidence: number;
  readonly metricThresholds: Readonly<Partial<Record<EvidenceMetric, number>>>;
  readonly requiredEvidenceTypes?: readonly CertificationEvidenceType[];
}

export interface TrustDimension {
  evidenceType: CertificationEvidenceType;
  score?: number;
  evidenceRefs: string[];
}

export interface CertificationConfidence {
  value: number;
  evidenceCoverage: number;
  sourceCount: number;
  complete: boolean;
  rationale: string[];
}

/**
 * IHTM is a descriptive, read-only output that future decision, workload, and
 * resource-arbitration consumers may query. It never controls those authorities.
 */
export interface HardwareTrustScore {
  hardwareUuid: string;
  score: number;
  certificationConfidence: CertificationConfidence;
  dimensions: TrustDimension[];
  evidenceRefs: string[];
  updatedAt: string;
}

export interface CertificationEvidenceProvider {
  getEvidence(hardwareUuid: string): CertificationEvidence[];
}

export interface BenchmarkEvidenceProvider extends CertificationEvidenceProvider {}
export interface HealthEvidenceProvider extends CertificationEvidenceProvider {}
export interface PowerEvidenceProvider extends CertificationEvidenceProvider {}
export interface ThermalEvidenceProvider extends CertificationEvidenceProvider {}
export interface HardwareCapabilityProvider extends CertificationEvidenceProvider {}
export interface ResourceUtilizationEvidenceProvider extends CertificationEvidenceProvider {}
export interface ErrorHistoryEvidenceProvider extends CertificationEvidenceProvider {}
export interface DriverCompatibilityEvidenceProvider extends CertificationEvidenceProvider {}
export interface RuntimeStabilityEvidenceProvider extends CertificationEvidenceProvider {}
export interface OperationalUptimeEvidenceProvider extends CertificationEvidenceProvider {}

export interface CertificationProviders {
  benchmark?: BenchmarkEvidenceProvider;
  health?: HealthEvidenceProvider;
  power?: PowerEvidenceProvider;
  thermal?: ThermalEvidenceProvider;
  hardwareCapabilities?: HardwareCapabilityProvider;
  resourceUtilization?: ResourceUtilizationEvidenceProvider;
  errorHistory?: ErrorHistoryEvidenceProvider;
  driverCompatibility?: DriverCompatibilityEvidenceProvider;
  runtimeStability?: RuntimeStabilityEvidenceProvider;
  operationalUptime?: OperationalUptimeEvidenceProvider;
}
