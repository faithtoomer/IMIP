import type { BackupLifecycleStatus, RecoveryLifecycleStatus } from './types.js';

export class ResilienceAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ResilienceAuthorityError';
    this.code = code;
  }
}

export class UnregisteredBackupDomainError extends ResilienceAuthorityError {
  constructor(domain: string) {
    super('RESILIENCE_UNREGISTERED_DOMAIN', `"${domain}" is not a registered backup domain.`);
    this.name = 'UnregisteredBackupDomainError';
  }
}

export class NoDomainHandlersError extends ResilienceAuthorityError {
  constructor() {
    super('RESILIENCE_NO_HANDLERS', 'No domain backup handlers are registered — nothing to back up.');
    this.name = 'NoDomainHandlersError';
  }
}

export class UnsupportedBackupTypeError extends ResilienceAuthorityError {
  constructor(backupType: string) {
    super(
      'RESILIENCE_UNSUPPORTED_BACKUP_TYPE',
      `Backup type "${backupType}" is not supported — no incremental/differential primitive exists in IDA or ISMA today.`,
    );
    this.name = 'UnsupportedBackupTypeError';
  }
}

export class BackupNotFoundError extends ResilienceAuthorityError {
  constructor(backupId: string) {
    super('RESILIENCE_BACKUP_NOT_FOUND', `No backup "${backupId}" is registered.`);
    this.name = 'BackupNotFoundError';
  }
}

export class RecoveryNotFoundError extends ResilienceAuthorityError {
  constructor(recoveryId: string) {
    super('RESILIENCE_RECOVERY_NOT_FOUND', `No recovery "${recoveryId}" is recorded.`);
    this.name = 'RecoveryNotFoundError';
  }
}

export class RecoveryPointNotFoundError extends ResilienceAuthorityError {
  constructor(recoveryPointId: string) {
    super('RESILIENCE_RECOVERY_POINT_NOT_FOUND', `No recovery point "${recoveryPointId}" is recorded.`);
    this.name = 'RecoveryPointNotFoundError';
  }
}

export class NoBackupDestinationError extends ResilienceAuthorityError {
  constructor() {
    super(
      'RESILIENCE_NO_DESTINATION',
      'No backup destination configured — supply a StorageAuthority or an explicit backupRootPath.',
    );
    this.name = 'NoBackupDestinationError';
  }
}

export class UnverifiedBackupError extends ResilienceAuthorityError {
  constructor(backupId: string) {
    super('RESILIENCE_UNVERIFIED_BACKUP', `Backup "${backupId}" has not been verified — Law 2 "Recoverability First" prohibits restoring from it.`);
    this.name = 'UnverifiedBackupError';
  }
}

export class InvalidBackupTransitionError extends ResilienceAuthorityError {
  constructor(from: BackupLifecycleStatus, to: BackupLifecycleStatus) {
    super('RESILIENCE_INVALID_BACKUP_TRANSITION', `Cannot transition a backup from "${from}" to "${to}".`);
    this.name = 'InvalidBackupTransitionError';
  }
}

export class InvalidRecoveryTransitionError extends ResilienceAuthorityError {
  constructor(from: RecoveryLifecycleStatus, to: RecoveryLifecycleStatus) {
    super('RESILIENCE_INVALID_RECOVERY_TRANSITION', `Cannot transition a recovery from "${from}" to "${to}".`);
    this.name = 'InvalidRecoveryTransitionError';
  }
}
