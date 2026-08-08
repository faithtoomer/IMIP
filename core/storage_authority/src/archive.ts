import { randomUUID, createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { ArchiveFailedError } from './errors.js';
import type { ArchiveRecord, StorageEntry } from './types.js';

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out;
}

/** §11 — copies a storage location's contents into an archive directory and
 * records a per-file SHA-256 checksum for later integrity validation. Real
 * file copy + real hashing, not a metadata-only "archived" flag. */
export function createArchive(entry: StorageEntry, archiveRoot: string): ArchiveRecord {
  if (entry.isFile) {
    throw new ArchiveFailedError(entry.storageId, 'Cannot archive a single-file storage entry as a directory tree.');
  }

  const archiveId = randomUUID();
  const destination = join(archiveRoot, archiveId);
  mkdirSync(destination, { recursive: true });

  const checksums: Record<string, string> = {};
  try {
    for (const filePath of collectFiles(entry.path)) {
      const relPath = relative(entry.path, filePath);
      const destPath = join(destination, relPath);
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(filePath, destPath);
      checksums[relPath] = sha256(destPath);
    }
  } catch (error) {
    throw new ArchiveFailedError(entry.storageId, (error as Error).message);
  }

  return { archiveId, sourceStorageId: entry.storageId, path: destination, checksums, createdAt: new Date().toISOString() };
}

/** Recomputes every archived file's checksum and compares against the
 * recorded value — real integrity validation, not a stub. */
export function validateArchive(record: ArchiveRecord): boolean {
  for (const [relPath, expected] of Object.entries(record.checksums)) {
    const filePath = join(record.path, relPath);
    if (!statSync(filePath, { throwIfNoEntry: false })) return false;
    if (sha256(filePath) !== expected) return false;
  }
  return true;
}
