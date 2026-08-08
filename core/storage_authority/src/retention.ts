import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { RetentionResult, StorageEntry } from './types.js';

/** §10 — enforces a storage entry's retention policy against real files on
 * disk. A no-op for file-backed entries and directory entries with no
 * configured policy. */
export function enforceRetention(entry: StorageEntry): RetentionResult {
  const result: RetentionResult = { storageId: entry.storageId, deletedFiles: [], reclaimedBytes: 0 };
  if (entry.isFile || !entry.retentionPolicy) return result;

  const files = readdirSync(entry.path)
    .map((name) => {
      const path = join(entry.path, name);
      const stats = statSync(path);
      return { path, mtimeMs: stats.mtimeMs, size: stats.size };
    })
    .filter((file) => statSync(file.path).isFile())
    .sort((a, b) => a.mtimeMs - b.mtimeMs);

  const { maxAgeMs, maxEntries } = entry.retentionPolicy;
  const now = Date.now();
  const survivors: typeof files = [];

  for (const file of files) {
    const expired = maxAgeMs !== undefined && now - file.mtimeMs > maxAgeMs;
    if (expired) {
      unlinkSync(file.path);
      result.deletedFiles.push(file.path);
      result.reclaimedBytes += file.size;
    } else {
      survivors.push(file);
    }
  }

  if (maxEntries !== undefined && survivors.length > maxEntries) {
    for (const file of survivors.slice(0, survivors.length - maxEntries)) {
      unlinkSync(file.path);
      result.deletedFiles.push(file.path);
      result.reclaimedBytes += file.size;
    }
  }

  return result;
}
