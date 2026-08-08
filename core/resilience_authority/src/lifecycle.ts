import { InvalidBackupTransitionError, InvalidRecoveryTransitionError } from './errors.js';
import type { BackupLifecycleStatus, RecoveryLifecycleStatus } from './types.js';

/** §10, extended with `failed` (reachable from any non-terminal stage)
 * beyond the spec's literal 8-node diagram. See ADR-0017. */
const BACKUP_TRANSITIONS: Record<BackupLifecycleStatus, BackupLifecycleStatus[]> = {
  created: ['validated', 'failed'],
  validated: ['stored', 'failed'],
  stored: ['verified', 'failed'],
  verified: ['available', 'failed'],
  available: ['archived', 'failed'],
  archived: ['expired'],
  expired: ['purged'],
  purged: [],
  failed: [],
};

export function assertBackupTransition(from: BackupLifecycleStatus, to: BackupLifecycleStatus): void {
  if (!BACKUP_TRANSITIONS[from].includes(to)) {
    throw new InvalidBackupTransitionError(from, to);
  }
}

/** §11, extended with `failed` (reachable from any non-terminal stage). */
const RECOVERY_TRANSITIONS: Record<RecoveryLifecycleStatus, RecoveryLifecycleStatus[]> = {
  requested: ['backup-selected', 'failed'],
  'backup-selected': ['compatibility-verified', 'failed'],
  'compatibility-verified': ['integrity-verified', 'failed'],
  'integrity-verified': ['executed', 'failed'],
  executed: ['validated', 'failed'],
  validated: ['certified', 'failed'],
  certified: ['operational', 'failed'],
  operational: [],
  failed: [],
};

export function assertRecoveryTransition(from: RecoveryLifecycleStatus, to: RecoveryLifecycleStatus): void {
  if (!RECOVERY_TRANSITIONS[from].includes(to)) {
    throw new InvalidRecoveryTransitionError(from, to);
  }
}
