import { join } from 'node:path';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { StorageRegistry } from './registry.js';
import { StorageAllocator } from './allocator.js';
import { StorageEventBus } from './events.js';
import { StorageTopology } from './topology.js';
import { measureCapacity, evaluateHealth } from './capacity.js';
import { discoverVolumes } from './discovery.js';
import { enforceRetention } from './retention.js';
import { createArchive, validateArchive as validateArchiveIntegrity } from './archive.js';
import { assertStorageTransition } from './lifecycle.js';
import { StorageNotFoundError } from './errors.js';
import { STORAGE_EVENTS } from './types.js';
import type {
  AllocationOptions,
  ArchiveRecord,
  CapacitySnapshot,
  DiscoveredVolume,
  HealthCheckResult,
  RetentionResult,
  StorageAuthorityMetrics,
  StorageDomain,
  StorageEntry,
} from './types.js';

export interface StorageAuthorityOptions {
  /** Root directory under which every managed storage location lives.
   * Defaults to `<cwd>/storage`. */
  rootPath?: string;
  eventBus?: InstitutionalEventBus;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * ISMA — the Institutional Storage Management Authority (PHASE-09). The sole
 * authority for physical storage infrastructure: registry, allocation,
 * capacity/health monitoring, retention, archival, and the Institutional
 * Storage Topology (§22). IDA (Phase 08) owns logical data; ISMA owns where
 * that data physically lives (ADR-0011 §"Separation of Concerns", ADR-0012).
 */
export class StorageAuthority {
  readonly registry = new StorageRegistry();
  readonly events: StorageEventBus;
  readonly topology: StorageTopology;

  private readonly allocator: StorageAllocator;
  private readonly archives = new Map<string, ArchiveRecord>();

  private allocationCount = 0;
  private releaseCount = 0;
  private archiveCount = 0;
  private cleanupCount = 0;
  private capacityWarningCount = 0;
  private capacityCriticalCount = 0;
  private readonly allocationDurations: number[] = [];

  constructor(options: StorageAuthorityOptions = {}) {
    const rootPath = options.rootPath ?? join(process.cwd(), 'storage');
    this.events = new StorageEventBus(options.eventBus);
    this.allocator = new StorageAllocator(this.registry, rootPath);
    this.topology = new StorageTopology(
      this.registry,
      (entry) => this.safeCapacity(entry),
      (entry) => this.safeHealth(entry),
    );
  }

  /** §8 — idempotent: re-allocating the same (domain, purpose) returns the
   * existing entry without creating a duplicate or re-publishing events. */
  allocate(domain: StorageDomain, purpose: string, options: AllocationOptions = {}): StorageEntry {
    const start = performance.now();
    const alreadyExisted = Boolean(this.registry.findByPurpose(domain, purpose));
    const entry = this.allocator.allocate(domain, purpose, options);
    if (!alreadyExisted) {
      this.allocationCount += 1;
      this.allocationDurations.push(performance.now() - start);
      this.events.publish(STORAGE_EVENTS.StorageRegistered, { storageId: entry.storageId, domain, purpose });
      this.events.publish(STORAGE_EVENTS.StorageAllocated, { storageId: entry.storageId, domain, purpose, path: entry.path });
    }
    return entry;
  }

  /** Deregisters a storage entry — ISMA stops tracking/monitoring it. Does
   * not delete the underlying files; use `enforceRetention()`/`archive()`
   * for that. */
  release(storageId: string): void {
    const entry = this.registry.require(storageId);
    assertStorageTransition(entry.lifecycleStage, 'deleted');
    this.registry.remove(storageId);
    this.releaseCount += 1;
    this.events.publish(STORAGE_EVENTS.StorageReleased, { storageId, domain: entry.domain, purpose: entry.purpose });
  }

  resolve(storageId: string): StorageEntry {
    return this.registry.require(storageId);
  }

  listByDomain(domain: StorageDomain): StorageEntry[] {
    return this.registry.byDomain(domain);
  }

  activate(storageId: string): StorageEntry {
    const entry = this.registry.require(storageId);
    assertStorageTransition(entry.lifecycleStage, 'active');
    const updated: StorageEntry = { ...entry, lifecycleStage: 'active' };
    this.registry.update(updated);
    return updated;
  }

  getCapacity(storageId: string): CapacitySnapshot {
    return measureCapacity(this.registry.require(storageId));
  }

  getHealth(storageId: string): HealthCheckResult {
    const entry = this.registry.require(storageId);
    const capacity = measureCapacity(entry);
    const result = evaluateHealth(entry, capacity);
    if (result.status === 'critical') {
      this.capacityCriticalCount += 1;
      this.events.publish(STORAGE_EVENTS.CapacityCritical, { storageId, usedPercent: capacity.usedPercent });
    } else if (result.status === 'degraded') {
      this.capacityWarningCount += 1;
      this.events.publish(STORAGE_EVENTS.CapacityWarning, { storageId, usedPercent: capacity.usedPercent });
      this.events.publish(STORAGE_EVENTS.StorageDegraded, { storageId });
    } else {
      this.events.publish(STORAGE_EVENTS.StorageHealthy, { storageId });
    }
    return result;
  }

  /** §9 — real, whole-machine filesystem discovery (`systeminformation`), distinct
   * from `getCapacity()`'s per-entry check. */
  async discover(): Promise<DiscoveredVolume[]> {
    const volumes = await discoverVolumes();
    this.events.publish(STORAGE_EVENTS.StorageDiscovered, { count: volumes.length });
    return volumes;
  }

  enforceRetention(storageId: string): RetentionResult {
    const entry = this.registry.require(storageId);
    const result = enforceRetention(entry);
    if (result.deletedFiles.length > 0) {
      this.cleanupCount += 1;
      this.events.publish(STORAGE_EVENTS.CleanupCompleted, {
        storageId,
        deleted: result.deletedFiles.length,
        reclaimedBytes: result.reclaimedBytes,
      });
    }
    return result;
  }

  enforceAllRetention(): RetentionResult[] {
    return this.registry
      .all()
      .filter((entry) => entry.retentionPolicy)
      .map((entry) => this.enforceRetention(entry.storageId));
  }

  /** §11 — moves the entry's contents into a checksummed archive under the
   * `backups` domain and transitions its lifecycle to `archived`. Requires
   * the entry to already be `active` (see `activate()`). */
  archive(storageId: string): ArchiveRecord {
    const entry = this.registry.require(storageId);
    assertStorageTransition(entry.lifecycleStage, 'archived');

    const archiveLocation = this.allocate('backups', `archive-${entry.domain}-${entry.purpose}`);
    const record = createArchive(entry, archiveLocation.path);
    this.archives.set(record.archiveId, record);

    this.registry.update({ ...entry, lifecycleStage: 'archived', backupStatus: 'backed-up' });
    this.archiveCount += 1;
    this.events.publish(STORAGE_EVENTS.ArchiveCreated, { archiveId: record.archiveId, storageId });
    return record;
  }

  validateArchive(archiveId: string): boolean {
    const record = this.archives.get(archiveId);
    if (!record) throw new StorageNotFoundError(archiveId);
    const valid = validateArchiveIntegrity(record);
    this.archives.set(archiveId, { ...record, validated: valid, validatedAt: new Date().toISOString() });
    return valid;
  }

  getArchive(archiveId: string): ArchiveRecord | undefined {
    return this.archives.get(archiveId);
  }

  getMetrics(): StorageAuthorityMetrics {
    return {
      allocationCount: this.allocationCount,
      releaseCount: this.releaseCount,
      archiveCount: this.archiveCount,
      cleanupCount: this.cleanupCount,
      capacityWarningCount: this.capacityWarningCount,
      capacityCriticalCount: this.capacityCriticalCount,
      averageAllocationLatencyMs: average(this.allocationDurations),
    };
  }

  private safeCapacity(entry: StorageEntry): CapacitySnapshot | undefined {
    try {
      return measureCapacity(entry);
    } catch {
      return undefined;
    }
  }

  private safeHealth(entry: StorageEntry): HealthCheckResult | undefined {
    try {
      return evaluateHealth(entry, measureCapacity(entry));
    } catch {
      return undefined;
    }
  }
}
