export { VersionGovernanceAuthority, type VersionGovernanceAuthorityOptions } from './VersionGovernanceAuthority.js';
export { ArtifactTypeRegistry } from './artifactTypeRegistry.js';
export { VersionRegistry } from './versionRegistry.js';
export { ArtifactCompatibilityRegistry } from './artifactCompatibilityRegistry.js';
export { MigrationRegistry } from './migrationRegistry.js';
export { InstitutionalEvolutionGraph } from './evolutionGraph.js';
export { VersionAuditTrail } from './auditTrail.js';
export { VersionEventBus } from './events.js';
export { assertVersionTransition, assertMigrationTransition } from './lifecycle.js';
export {
  createConfigurationVersionSource,
  createDatabaseVersionSource,
  createEventSchemaVersionSource,
  createNoopVersionSource,
} from './versionSources.js';
export {
  createConfigurationMigrationExecutor,
  createDataAuthorityMigrationExecutor,
  withResilienceRollback,
} from './migrationExecutors.js';
export {
  VersionGovernanceAuthorityError,
  UnregisteredArtifactTypeError,
  VersionNotFoundError,
  DuplicateVersionError,
  MigrationNotFoundError,
  NoMigrationExecutorError,
  InvalidVersionTransitionError,
  InvalidMigrationTransitionError,
} from './errors.js';
export {
  DEFAULT_ARTIFACT_TYPES,
  VERSION_EVENTS,
  type DefaultArtifactType,
  type VersionStatus,
  type CertificationStatus,
  type DeprecationInfo,
  type VersionRecord,
  type CompatibilityRelationship,
  type MigrationStatus,
  type MigrationPlan,
  type MigrationRequest,
  type MigrationStepRecord,
  type MigrationRecord,
  type VersionSnapshot,
  type ArtifactVersionSource,
  type MigrationExecutionResult,
  type MigrationVerificationResult,
  type MigrationExecutor,
  type VersionGovernanceMetrics,
  type VersionEventName,
  type VersionDiff,
} from './types.js';
