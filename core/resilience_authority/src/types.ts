import type { RetentionPolicy } from '../../storage_authority/src/index.js';

/** §6 — a real, runtime-extensible registry (not a closed union), matching
 * IOLA's/INCA's category registries — "future domains" is explicit in the
 * spec's own wording. */
export const DEFAULT_BACKUP_DOMAINS = [
  'configuration',
  'database',
  'runtime',
  'plugin-registry',
  'capability-registry',
  'hardware-registry',
  'logs-audit',
] as const;

export type DefaultBackupDomain = (typeof DEFAULT_BACKUP_DOMAINS)[number];

/**
 * §8 — 'full', 'manual', 'scheduled', and 'snapshot' are real and fully
 * implemented, backed by IDA's/ICMS's/ISMA's actual mechanisms.
 * 'incremental'/'differential' are registered, honest types that throw
 * `UnsupportedBackupTypeError` rather than fabricate a strategy — no
 * incremental/differential primitive exists anywhere in IDA or ISMA today
 * (both only support full snapshots). See ADR-0017.
 */
export type BackupType = 'full' | 'incremental' | 'differential' | 'snapshot' | 'manual' | 'scheduled';

export type CompressionStatus = 'none' | 'gzip';
export type EncryptionStatus = 'none' | 'encrypted';
export type VerificationStatus = 'unverified' | 'verified' | 'failed';

/** §10, extended with `failed` beyond the spec's literal 8-node diagram —
 * required for §17/§20 to be a real, reachable state. See ADR-0017. */
export type BackupLifecycleStatus = 'created' | 'validated' | 'stored' | 'verified' | 'available' | 'archived' | 'expired' | 'purged' | 'failed';

/** §11, extended with `failed` for the same reason. */
export type RecoveryLifecycleStatus =
  | 'requested'
  | 'backup-selected'
  | 'compatibility-verified'
  | 'integrity-verified'
  | 'executed'
  | 'validated'
  | 'certified'
  | 'operational'
  | 'failed';

export interface DomainBackupResult {
  domain: string;
  sizeBytes: number;
  checksum?: string;
  location: string;
  compressionStatus: CompressionStatus;
  metadata?: Record<string, unknown>;
}

export interface DomainValidationResult {
  domain: string;
  valid: boolean;
  reasons: string[];
}

export interface DomainRestoreResult {
  domain: string;
  success: boolean;
  /** false = this domain intentionally does not support restore (e.g. live
   * hardware/runtime state, or a reserved domain with no producer yet) —
   * distinct from a real, attempted restore that failed. Only
   * `supported && !success` counts as a genuine recovery failure. */
  supported: boolean;
  message?: string;
}

/**
 * §5/Law 1 — every registered backup domain implements this. IBRRA never
 * reimplements the underlying persistence/storage mechanics itself — real
 * handlers wrap IDA's/ICMS's/ISMA's/IHIS's/IRBLM's own existing, real
 * methods. See ADR-0017.
 */
export interface DomainBackupHandler {
  readonly domain: string;
  backup(destinationDir: string): Promise<DomainBackupResult>;
  validate(result: DomainBackupResult): Promise<DomainValidationResult>;
  restore(result: DomainBackupResult): Promise<DomainRestoreResult>;
}

/** §7 — the authoritative Backup Registry entry (a "backup set" spanning
 * one or more domains). */
export interface BackupRecord {
  backupId: string;
  backupType: BackupType;
  domains: DomainBackupResult[];
  createdAt: string;
  storageLocation: string;
  totalSizeBytes: number;
  encryptionStatus: EncryptionStatus;
  verificationStatus: VerificationStatus;
  expirationDate?: string;
  retentionPolicy?: RetentionPolicy;
  /** Sourced from ICMS's real `platform.version` config value when
   * available; `'unknown'` otherwise — never fabricated. */
  recoveryCompatibilityVersion: string;
  status: BackupLifecycleStatus;
  reason?: string;
}

export interface BackupRequest {
  backupType: BackupType;
  domains?: string[];
  reason?: string;
  retentionPolicy?: RetentionPolicy;
}

/** §9 — immutable once created. */
export interface RecoveryPoint {
  recoveryPointId: string;
  backupId: string;
  platformVersion: string;
  domainSchemaVersions: Record<string, number>;
  createdAt: string;
  verificationStatus: VerificationStatus;
}

export interface RecoveryStepRecord {
  step: RecoveryLifecycleStatus;
  timestamp: string;
  detail?: string;
}

export interface RecoveryRecord {
  recoveryId: string;
  backupId: string;
  requestedBy: string;
  reason: string;
  status: RecoveryLifecycleStatus;
  steps: RecoveryStepRecord[];
  domainResults: DomainRestoreResult[];
  startedAt: string;
  completedAt?: string;
  certifiedOperational?: boolean;
}

export interface ResilienceMetrics {
  backupCount: number;
  backupFailureCount: number;
  recoveryCount: number;
  recoveryFailureCount: number;
  averageBackupDurationMs: number;
  averageRecoveryDurationMs: number;
  averageVerificationDurationMs: number;
  recoveryReadinessScore: number;
}

/** §14 — the 10 named events. */
export const RESILIENCE_EVENTS = {
  BackupStarted: 'BackupStarted',
  BackupCompleted: 'BackupCompleted',
  BackupFailed: 'BackupFailed',
  BackupVerified: 'BackupVerified',
  BackupExpired: 'BackupExpired',
  RecoveryRequested: 'RecoveryRequested',
  RecoveryStarted: 'RecoveryStarted',
  RecoveryCompleted: 'RecoveryCompleted',
  RecoveryFailed: 'RecoveryFailed',
  RecoveryValidated: 'RecoveryValidated',
} as const;

export type ResilienceEventName = (typeof RESILIENCE_EVENTS)[keyof typeof RESILIENCE_EVENTS];

/** §23 — a single edge in the Institutional Recovery Graph: "what changed
 * between two recovery points." */
export interface RecoveryPointDelta {
  fromRecoveryPointId: string;
  toRecoveryPointId: string;
  platformVersionChanged: boolean;
  domainSchemaChanges: { domain: string; from?: number; to?: number }[];
}
