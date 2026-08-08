import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageRegistry } from './registry.js';
import type { AllocationOptions, StorageDomain, StorageEntry } from './types.js';

/** §8 — storage allocation. Deliberately synchronous (plain `fs` sync calls,
 * no `systeminformation`) so it can be called from IDA's and ICMS's
 * synchronous constructors (ADR-0012) without forcing either to become
 * async. */
export class StorageAllocator {
  constructor(
    private readonly registry: StorageRegistry,
    private readonly rootPath: string,
  ) {}

  /** Idempotent: re-allocating the same (domain, purpose) returns the
   * existing entry rather than creating a second one. */
  allocate(domain: StorageDomain, purpose: string, options: AllocationOptions = {}): StorageEntry {
    const existing = this.registry.findByPurpose(domain, purpose);
    if (existing) return existing;

    const directory = join(this.rootPath, domain, purpose);
    mkdirSync(directory, { recursive: true });
    const path = options.filename ? join(directory, options.filename) : directory;

    const entry: StorageEntry = {
      storageId: randomUUID(),
      domain,
      purpose,
      path,
      isFile: Boolean(options.filename),
      retentionPolicy: options.retentionPolicy,
      encryptionStatus: 'none',
      backupStatus: 'none',
      lifecycleStage: 'allocated',
      createdAt: new Date().toISOString(),
    };
    this.registry.register(entry);
    return entry;
  }
}
