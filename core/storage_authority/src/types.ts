/** §6 — the 8 institutional storage domains. */
export type StorageDomain =
  | 'configuration'
  | 'database'
  | 'runtime'
  | 'telemetry'
  | 'explainability'
  | 'backups'
  | 'plugins'
  | 'ai';

export type StorageHealthStatus = 'healthy' | 'degraded' | 'critical';
export type EncryptionStatus = 'none' | 'encrypted';
export type BackupStatus = 'none' | 'backed-up';

/** §12 — every managed storage object's lifecycle. */
export type StorageLifecycleStage = 'allocated' | 'active' | 'archived' | 'retained' | 'expired' | 'deleted';

export interface RetentionPolicy {
  /** Delete files older than this many milliseconds. */
  maxAgeMs?: number;
  /** Keep at most this many files in the location (oldest deleted first). */
  maxEntries?: number;
}

/** §7 — the authoritative registry entry for every managed storage location. */
export interface StorageEntry {
  storageId: string;
  domain: StorageDomain;
  purpose: string;
  path: string;
  /** True when `path` names a single file (a filename was given at allocation
   * time); false when `path` names a managed directory. */
  isFile: boolean;
  retentionPolicy?: RetentionPolicy;
  encryptionStatus: EncryptionStatus;
  backupStatus: BackupStatus;
  lifecycleStage: StorageLifecycleStage;
  createdAt: string;
}

export interface AllocationOptions {
  /** If given, the allocated path names a file inside the purpose's managed
   * directory rather than the directory itself. */
  filename?: string;
  retentionPolicy?: RetentionPolicy;
}

export interface CapacitySnapshot {
  storageId: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  measuredAt: string;
}

export interface HealthCheckResult {
  storageId: string;
  status: StorageHealthStatus;
  reasons: string[];
}

/** §9 — a real, discovered OS-level filesystem/mount, distinct from a
 * `StorageEntry` (which is a location ISMA manages *within* one of these). */
export interface DiscoveredVolume {
  mount: string;
  type: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
}

/** §11 — an archived copy of a storage location's contents, with a per-file
 * checksum recorded for later integrity validation. */
export interface ArchiveRecord {
  archiveId: string;
  sourceStorageId: string;
  path: string;
  checksums: Record<string, string>;
  createdAt: string;
  validated?: boolean;
  validatedAt?: string;
}

export interface RetentionResult {
  storageId: string;
  deletedFiles: string[];
  reclaimedBytes: number;
}

export interface StorageAuthorityMetrics {
  allocationCount: number;
  releaseCount: number;
  archiveCount: number;
  cleanupCount: number;
  capacityWarningCount: number;
  capacityCriticalCount: number;
  averageAllocationLatencyMs: number;
}

/** §13 — the minimum published event set. */
export const STORAGE_EVENTS = {
  StorageDiscovered: 'StorageDiscovered',
  StorageRegistered: 'StorageRegistered',
  StorageAllocated: 'StorageAllocated',
  StorageReleased: 'StorageReleased',
  CapacityWarning: 'CapacityWarning',
  CapacityCritical: 'CapacityCritical',
  StorageHealthy: 'StorageHealthy',
  StorageDegraded: 'StorageDegraded',
  ArchiveCreated: 'ArchiveCreated',
  CleanupCompleted: 'CleanupCompleted',
} as const;

export type StorageEventName = (typeof STORAGE_EVENTS)[keyof typeof STORAGE_EVENTS];
