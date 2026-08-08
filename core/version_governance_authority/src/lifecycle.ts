import { InvalidMigrationTransitionError, InvalidVersionTransitionError } from './errors.js';
import type { MigrationStatus, VersionStatus } from './types.js';

/** §9, extended with `rejected` beyond the spec's literal 7-node diagram —
 * required for certification to be a real gate rather than always
 * succeeding. See ADR-0018. */
const VERSION_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  created: ['registered'],
  registered: ['certified', 'rejected'],
  certified: ['released'],
  released: ['supported'],
  supported: ['deprecated'],
  deprecated: ['retired'],
  retired: [],
  rejected: [],
};

export function assertVersionTransition(from: VersionStatus, to: VersionStatus): void {
  if (!VERSION_TRANSITIONS[from].includes(to)) {
    throw new InvalidVersionTransitionError(from, to);
  }
}

/** §10, extended with `failed` (rollback itself can fail — Law 4 doesn't
 * guarantee rollback always succeeds, only that migration is transactional). */
const MIGRATION_TRANSITIONS: Record<MigrationStatus, MigrationStatus[]> = {
  planned: ['validated', 'failed'],
  validated: ['compatibility-verified', 'rollback'],
  'compatibility-verified': ['executed', 'rollback'],
  executed: ['verified', 'rollback'],
  verified: ['certified', 'rollback'],
  certified: [],
  rollback: ['rolled-back', 'failed'],
  'rolled-back': [],
  failed: [],
};

export function assertMigrationTransition(from: MigrationStatus, to: MigrationStatus): void {
  if (!MIGRATION_TRANSITIONS[from].includes(to)) {
    throw new InvalidMigrationTransitionError(from, to);
  }
}
