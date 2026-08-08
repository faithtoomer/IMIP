import { DuplicateStorageIdError, StorageNotFoundError } from './errors.js';
import type { StorageDomain, StorageEntry } from './types.js';

function key(domain: StorageDomain, purpose: string): string {
  return `${domain}::${purpose}`;
}

/** §7 — the authoritative SSOT for every managed storage location, indexed
 * both by storageId and by the (domain, purpose) pair allocation idempotency
 * depends on. Mirrors the SSOT-registry pattern already established by
 * ConfigurationRegistry/HardwareRegistry/EventRegistry. */
export class StorageRegistry {
  private byId = new Map<string, StorageEntry>();
  private byDomainPurpose = new Map<string, string>();

  register(entry: StorageEntry): void {
    if (this.byId.has(entry.storageId)) throw new DuplicateStorageIdError(entry.storageId);
    this.byId.set(entry.storageId, entry);
    this.byDomainPurpose.set(key(entry.domain, entry.purpose), entry.storageId);
  }

  update(entry: StorageEntry): void {
    this.require(entry.storageId);
    this.byId.set(entry.storageId, entry);
  }

  remove(storageId: string): void {
    const entry = this.require(storageId);
    this.byId.delete(storageId);
    this.byDomainPurpose.delete(key(entry.domain, entry.purpose));
  }

  get(storageId: string): StorageEntry | undefined {
    return this.byId.get(storageId);
  }

  require(storageId: string): StorageEntry {
    const entry = this.byId.get(storageId);
    if (!entry) throw new StorageNotFoundError(storageId);
    return entry;
  }

  findByPurpose(domain: StorageDomain, purpose: string): StorageEntry | undefined {
    const id = this.byDomainPurpose.get(key(domain, purpose));
    return id ? this.byId.get(id) : undefined;
  }

  byDomain(domain: StorageDomain): StorageEntry[] {
    return [...this.byId.values()].filter((entry) => entry.domain === domain);
  }

  all(): StorageEntry[] {
    return [...this.byId.values()];
  }
}
