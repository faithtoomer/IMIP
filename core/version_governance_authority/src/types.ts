/** §6/Law 2 — a real, runtime-extensible registry (matching IOLA's/INCA's/
 * IBRRA's category-registry pattern) of governed artifact types. Some map
 * to real, already-versioned data (configuration-schema -> ICMS's
 * `getVersionInfo()`, database-schema -> IDA's `DomainSchema.version`,
 * event-schema -> IEB's `EventDefinition.version`); others (plugin,
 * capability, policy) are real, honest, zero-producer extension points —
 * those authorities remain reserved. */
export const DEFAULT_ARTIFACT_TYPES = [
  'configuration-schema',
  'database-schema',
  'plugin-manifest',
  'plugin-interface',
  'capability-definition',
  'event-schema',
  'runtime-contract',
  'api-contract',
  'policy-definition',
] as const;

export type DefaultArtifactType = (typeof DEFAULT_ARTIFACT_TYPES)[number];

/** §9, extended with `rejected` (a real, distinct terminal outcome from
 * `retired` — certification can fail) beyond the spec's literal 7-node
 * diagram. See ADR-0018. */
export type VersionStatus = 'created' | 'registered' | 'certified' | 'released' | 'supported' | 'deprecated' | 'retired' | 'rejected';

export type CertificationStatus = 'uncertified' | 'certified' | 'rejected';

export interface DeprecationInfo {
  deprecatedAt: string;
  plannedRemoval?: string;
  replacementArtifact?: string;
  migrationGuidance?: string;
  compatibilityWindowEndsAt?: string;
}

/** §6 — every field the spec requires. */
export interface VersionRecord {
  versionId: string;
  artifactType: string;
  artifactName: string;
  semanticVersion: string;
  releaseDate?: string;
  compatibilityVersion?: string;
  migrationVersion?: string;
  status: VersionStatus;
  ownerAuthority: string;
  certificationStatus: CertificationStatus;
  deprecation?: DeprecationInfo;
  createdAt: string;
}

/** §7 — a real, queryable compatibility relationship between two artifact
 * versions, possibly across artifact types. Named `ArtifactCompatibility*`
 * throughout, not `CompatibilityRegistry` — ICMS already has a class with
 * that exact name (a narrower, config-value-level checker registry, a
 * different concept). See ADR-0018. */
export interface CompatibilityRelationship {
  relationshipId: string;
  fromArtifactType: string;
  fromVersion: string;
  toArtifactType: string;
  toVersion: string;
  compatible: boolean;
  reason?: string;
  recordedAt: string;
}

/** §10, extended with `failed` — Law 4 "either completes successfully or
 * rolls back," but rollback itself can fail; `failed` is the honest
 * terminal state for that, distinct from a successful `rolled-back`. */
export type MigrationStatus =
  | 'planned'
  | 'validated'
  | 'compatibility-verified'
  | 'executed'
  | 'verified'
  | 'certified'
  | 'rollback'
  | 'rolled-back'
  | 'failed';

/** §8 — a migration plan; source/target are real version *strings*
 * (matching how ICMS's/IDA's own migration definitions already reference
 * versions), not opaque IDs. */
export interface MigrationPlan {
  migrationId: string;
  artifactType: string;
  sourceVersion: string;
  targetVersion: string;
  scope: string;
  preconditions: string[];
  verificationRequirements: string[];
  rollbackStrategy: string;
}

export type MigrationRequest = Omit<MigrationPlan, 'migrationId'>;

export interface MigrationStepRecord {
  step: MigrationStatus;
  timestamp: string;
  detail?: string;
}

export interface MigrationRecord extends MigrationPlan {
  status: MigrationStatus;
  steps: MigrationStepRecord[];
  requestedBy: string;
  startedAt: string;
  completedAt?: string;
}

export interface VersionSnapshot {
  artifactType: string;
  artifactName: string;
  semanticVersion: string;
  compatibilityVersion?: string;
  migrationVersion?: string;
  metadata?: Record<string, unknown>;
}

/** §6 — a real handler wrapping an already-versioned authority's own real
 * data (ICMS's `getVersionInfo()`, IDA's `DomainSchema.version`, IEB's
 * `EventDefinition.version`) — IVGMA never invents version numbers for
 * artifacts another authority already versions. */
export interface ArtifactVersionSource {
  readonly artifactType: string;
  currentVersions(): VersionSnapshot[];
}

export interface MigrationExecutionResult {
  success: boolean;
  message?: string;
}

export interface MigrationVerificationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * §5/Law 1 — every registered migration executor wraps an already-real
 * migration/rollback mechanism (ICMS's `MigrationRunner`/`rollback()`,
 * IDA's `DataMigrationRunner`, optionally IBRRA's `requestRecovery()` for
 * database-domain rollback) — IVGMA never reimplements the mechanical
 * migration/rollback work itself. See ADR-0018.
 */
export interface MigrationExecutor {
  readonly artifactType: string;
  execute(plan: MigrationPlan): Promise<MigrationExecutionResult>;
  verify(plan: MigrationPlan): Promise<MigrationVerificationResult>;
  rollback(plan: MigrationPlan): Promise<MigrationExecutionResult>;
}

export interface VersionGovernanceMetrics {
  migrationCount: number;
  migrationFailureCount: number;
  rollbackCount: number;
  rollbackFailureCount: number;
  averageMigrationDurationMs: number;
  averageVerificationDurationMs: number;
  averageRollbackDurationMs: number;
  activeSupportedVersionCount: number;
  deprecatedArtifactCount: number;
}

/** §15 — the 10 named events. */
export const VERSION_EVENTS = {
  VersionRegistered: 'VersionRegistered',
  VersionReleased: 'VersionReleased',
  VersionDeprecated: 'VersionDeprecated',
  MigrationPlanned: 'MigrationPlanned',
  MigrationStarted: 'MigrationStarted',
  MigrationCompleted: 'MigrationCompleted',
  MigrationFailed: 'MigrationFailed',
  RollbackStarted: 'RollbackStarted',
  RollbackCompleted: 'RollbackCompleted',
  CompatibilityVerified: 'CompatibilityVerified',
} as const;

export type VersionEventName = (typeof VERSION_EVENTS)[keyof typeof VERSION_EVENTS];

/** §24 — a real diff between two version records' actual fields. */
export interface VersionDiff {
  fromVersionId: string;
  toVersionId: string;
  semanticVersionChanged: boolean;
  compatibilityVersionChanged: boolean;
  migrationVersionChanged: boolean;
}
