import type { MigrationStatus, VersionStatus } from './types.js';

export class VersionGovernanceAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'VersionGovernanceAuthorityError';
    this.code = code;
  }
}

export class UnregisteredArtifactTypeError extends VersionGovernanceAuthorityError {
  constructor(artifactType: string) {
    super('VERSION_UNREGISTERED_ARTIFACT_TYPE', `"${artifactType}" is not a registered artifact type.`);
    this.name = 'UnregisteredArtifactTypeError';
  }
}

export class VersionNotFoundError extends VersionGovernanceAuthorityError {
  constructor(versionId: string) {
    super('VERSION_NOT_FOUND', `No version "${versionId}" is registered.`);
    this.name = 'VersionNotFoundError';
  }
}

export class DuplicateVersionError extends VersionGovernanceAuthorityError {
  constructor(artifactType: string, artifactName: string, semanticVersion: string) {
    super('VERSION_DUPLICATE', `"${artifactType}"/"${artifactName}"@${semanticVersion} is already registered.`);
    this.name = 'DuplicateVersionError';
  }
}

export class MigrationNotFoundError extends VersionGovernanceAuthorityError {
  constructor(migrationId: string) {
    super('VERSION_MIGRATION_NOT_FOUND', `No migration "${migrationId}" is recorded.`);
    this.name = 'MigrationNotFoundError';
  }
}

export class NoMigrationExecutorError extends VersionGovernanceAuthorityError {
  constructor(artifactType: string) {
    super('VERSION_NO_EXECUTOR', `No migration executor is registered for artifact type "${artifactType}".`);
    this.name = 'NoMigrationExecutorError';
  }
}

export class InvalidVersionTransitionError extends VersionGovernanceAuthorityError {
  constructor(from: VersionStatus, to: VersionStatus) {
    super('VERSION_INVALID_TRANSITION', `Cannot transition a version from "${from}" to "${to}".`);
    this.name = 'InvalidVersionTransitionError';
  }
}

export class InvalidMigrationTransitionError extends VersionGovernanceAuthorityError {
  constructor(from: MigrationStatus, to: MigrationStatus) {
    super('VERSION_INVALID_MIGRATION_TRANSITION', `Cannot transition a migration from "${from}" to "${to}".`);
    this.name = 'InvalidMigrationTransitionError';
  }
}
