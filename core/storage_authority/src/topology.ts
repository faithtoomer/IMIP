import type { StorageRegistry } from './registry.js';
import type { CapacitySnapshot, HealthCheckResult, StorageDomain, StorageEntry } from './types.js';

export interface TopologyNode {
  entry: StorageEntry;
  capacity?: CapacitySnapshot;
  health?: HealthCheckResult;
}

export interface TopologySnapshot {
  generatedAt: string;
  domains: Record<string, TopologyNode[]>;
}

/**
 * §22 — Architect's Enhancement: the Institutional Storage Topology (IST).
 * A continuously queryable map of every managed storage resource — domain,
 * hierarchy, capacity, health — independent of any single allocation call.
 * Plays the same "always-current diagnostic layer" role for ISMA that the
 * Runtime Governance Board plays for IRBLM (Phase 07 §22): the platform
 * reasons about managed storage *resources*, not raw folders and files.
 */
export class StorageTopology {
  constructor(
    private readonly registry: StorageRegistry,
    private readonly capacityOf: (entry: StorageEntry) => CapacitySnapshot | undefined,
    private readonly healthOf: (entry: StorageEntry) => HealthCheckResult | undefined,
  ) {}

  describe(): TopologySnapshot {
    const domains: Record<string, TopologyNode[]> = {};
    for (const entry of this.registry.all()) {
      const node: TopologyNode = { entry, capacity: this.capacityOf(entry), health: this.healthOf(entry) };
      (domains[entry.domain] ??= []).push(node);
    }
    return { generatedAt: new Date().toISOString(), domains };
  }

  byDomain(domain: StorageDomain): TopologyNode[] {
    return this.registry.byDomain(domain).map((entry) => ({
      entry,
      capacity: this.capacityOf(entry),
      health: this.healthOf(entry),
    }));
  }

  whyDegraded(storageId: string): string[] {
    const entry = this.registry.get(storageId);
    if (!entry) return [`No storage entry registered with id "${storageId}".`];
    const health = this.healthOf(entry);
    return health && health.status !== 'healthy' ? health.reasons : [];
  }

  /** Sums capacity across distinct underlying volumes, deduplicated by their
   * measured (total, available) signature — entries allocated under the same
   * root typically share one filesystem, and double-counting it per entry
   * would overstate real capacity. Documented limitation: two genuinely
   * different volumes that happen to report an identical signature at the
   * same instant are undercounted; there is no cheaper way to identify the
   * underlying device from a plain path without a new OS-level dependency. */
  capacitySummary(): { totalBytes: number; usedBytes: number; availableBytes: number } {
    const seen = new Map<string, CapacitySnapshot>();
    for (const entry of this.registry.all()) {
      const capacity = this.capacityOf(entry);
      if (!capacity) continue;
      seen.set(`${capacity.totalBytes}:${capacity.availableBytes}`, capacity);
    }
    let totalBytes = 0;
    let usedBytes = 0;
    let availableBytes = 0;
    for (const capacity of seen.values()) {
      totalBytes += capacity.totalBytes;
      usedBytes += capacity.usedBytes;
      availableBytes += capacity.availableBytes;
    }
    return { totalBytes, usedBytes, availableBytes };
  }
}
