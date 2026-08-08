import { existsSync, statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import { DirectoryMissingError } from './errors.js';
import type { CapacitySnapshot, HealthCheckResult, StorageEntry } from './types.js';

const WARNING_PERCENT = 85;
const CRITICAL_PERCENT = 95;

/** §9 — real, synchronous capacity measurement via Node's built-in
 * `fs.statfsSync` (no new dependency). Used for per-entry health checks;
 * `discovery.ts`'s async `systeminformation.fsSize()` scan is the broader,
 * whole-machine counterpart used by `discover()`. */
export function measureCapacity(entry: StorageEntry): CapacitySnapshot {
  const targetPath = entry.isFile ? dirname(entry.path) : entry.path;
  if (!existsSync(targetPath)) throw new DirectoryMissingError(targetPath);

  const stats = statfsSync(targetPath);
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bfree * stats.bsize;
  const availableBytes = stats.bavail * stats.bsize;
  const usedBytes = totalBytes - freeBytes;
  const usedPercent = totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100;

  return {
    storageId: entry.storageId,
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent,
    measuredAt: new Date().toISOString(),
  };
}

export function evaluateHealth(entry: StorageEntry, capacity: CapacitySnapshot): HealthCheckResult {
  if (capacity.usedPercent >= CRITICAL_PERCENT) {
    return {
      storageId: entry.storageId,
      status: 'critical',
      reasons: [`Disk usage at ${capacity.usedPercent.toFixed(1)}% (>= ${CRITICAL_PERCENT}% critical threshold).`],
    };
  }
  if (capacity.usedPercent >= WARNING_PERCENT) {
    return {
      storageId: entry.storageId,
      status: 'degraded',
      reasons: [`Disk usage at ${capacity.usedPercent.toFixed(1)}% (>= ${WARNING_PERCENT}% warning threshold).`],
    };
  }
  return { storageId: entry.storageId, status: 'healthy', reasons: [] };
}
