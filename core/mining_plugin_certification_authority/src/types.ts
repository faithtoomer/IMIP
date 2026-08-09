/** IMPCA vocabulary is self-contained and deliberately not shared with hardware certification. */
export enum CertificationLevel {
  Experimental = 'Experimental',
  Development = 'Development',
  Qualified = 'Qualified',
  Production = 'Production',
  InstitutionalCritical = 'InstitutionalCritical',
}

export enum CertificationLifecycleStage {
  Submitted = 'Submitted',
  Validated = 'Validated',
  Testing = 'Testing',
  EvidenceCollected = 'EvidenceCollected',
  Reviewed = 'Reviewed',
  Certified = 'Certified',
  Active = 'Active',
  Suspended = 'Suspended',
  Revoked = 'Revoked',
  Recertified = 'Recertified',
  Rejected = 'Rejected',
  Failed = 'Failed',
}

export type PluginCertificationPipelineStage =
  | 'StaticValidation'
  | 'DependencyValidation'
  | 'SecurityValidation'
  | 'FunctionalTesting'
  | 'CompatibilityTesting'
  | 'PerformanceTesting'
  | 'RuntimeTesting';

export interface PluginCertificationManifest {
  pluginUuid?: string;
  version?: string;
  declaredDependencies?: ReadonlyArray<{ pluginUuid?: string; version?: string; interfaceName?: string; required?: boolean }>;
  declaredCapabilities?: ReadonlyArray<string>;
  requiredInterfaces?: ReadonlyArray<string>;
  /** Other manifest data is opaque to IMPCA. Self-certification assertions are refused. */
  [key: string]: unknown;
}

export interface PipelineProviderResult {
  passed: boolean;
  evidenceType: string;
  payload: Record<string, unknown>;
  rationale: string;
  /** A passed but degraded observation may support lower levels, never Production. */
  degraded?: boolean;
}

export interface PipelineStageResult {
  stage: PluginCertificationPipelineStage;
  passed: boolean;
  evidenceReference: string;
  rationale: string;
  degraded: boolean;
}

export interface EvidenceRecord {
  evidenceId: string;
  pluginUuid: string;
  version: string;
  certificationId: string;
  stage: PluginCertificationPipelineStage;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  observedAt: string;
  providerRationale: string;
  passed: boolean;
  degraded: boolean;
}

export interface PluginCertificationLifecycleRecord {
  from: CertificationLifecycleStage | undefined;
  to: CertificationLifecycleStage;
  at: string;
  reason: string;
}

/** Structurally compatible with Phase 30 IMPR's CertificationStatus seam. */
export interface PluginCertificationStatusOutput {
  certified: boolean;
  level: string;
  reason: string;
}

export interface PluginCertificationRecord {
  certificationId: string;
  pluginUuid: string;
  version: string;
  certificationLevel?: CertificationLevel;
  lifecycleStage: CertificationLifecycleStage;
  evidenceReferences: readonly string[];
  pipelineResults: readonly PipelineStageResult[];
  lifecycle: readonly PluginCertificationLifecycleRecord[];
  submittedAt: string;
  updatedAt: string;
  decisionReason?: string;
  recertificationAttempts: number;
}

export interface PluginCertificationSubmission {
  pluginUuid: string;
  version: string;
  manifest?: PluginCertificationManifest;
}

export interface PluginCertificationProviderInput {
  pluginUuid: string;
  version: string;
  manifest?: PluginCertificationManifest;
  certificationId: string;
}

export interface PluginTrustGraphTrace {
  pluginUuid: string;
  version: string;
  certificationId: string;
  dependencies: readonly string[];
  adapters: readonly string[];
  algorithms: readonly string[];
  hardware: readonly string[];
  runtime: readonly string[];
  historicalPerformance: readonly string[];
  securityEvidence: readonly string[];
}
