import { describe, expect, it, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { StorageRegistry } from '../src/registry.js';
import { StorageAllocator } from '../src/allocator.js';
import { createArchive, validateArchive } from '../src/archive.js';
import { ArchiveFailedError } from '../src/errors.js';
import { makeTempRoot, cleanupTempRoot } from './testHelpers.js';

describe('archive.ts (§11 — real archival with checksummed integrity)', () => {
  let root: string;
  afterEach(() => {
    if (root) cleanupTempRoot(root);
  });

  it('copies real files (including nested directories) into the archive and records checksums', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('explainability', 'reports');
    mkdirSync(join(entry.path, 'nested'), { recursive: true });
    writeFileSync(join(entry.path, 'a.txt'), 'alpha');
    writeFileSync(join(entry.path, 'nested', 'b.txt'), 'beta');

    const archiveRoot = join(root, 'backups');
    const record = createArchive(entry, archiveRoot);

    expect(Object.keys(record.checksums).sort()).toEqual(['a.txt', join('nested', 'b.txt')].sort());
    expect(validateArchive(record)).toBe(true);
  });

  it('detects tampering: validateArchive() fails if an archived file is modified after archiving', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('explainability', 'reports');
    writeFileSync(join(entry.path, 'a.txt'), 'alpha');

    const record = createArchive(entry, join(root, 'backups'));
    appendFileSync(join(record.path, 'a.txt'), 'TAMPERED');

    expect(validateArchive(record)).toBe(false);
  });

  it('refuses to archive a file-backed entry as a directory tree', () => {
    root = makeTempRoot();
    const entry = new StorageAllocator(new StorageRegistry(), root).allocate('database', 'primary', { filename: 'data.db' });
    expect(() => createArchive(entry, join(root, 'backups'))).toThrow(ArchiveFailedError);
  });
});
