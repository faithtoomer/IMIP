import { DEFAULT_BACKUP_DOMAINS } from './types.js';

/** §6 — a real, runtime-extensible registry, matching IOLA's/INCA's
 * category registry pattern — "future domains" is explicit in the spec's
 * own wording. */
export class BackupDomainRegistry {
  private domains = new Set<string>(DEFAULT_BACKUP_DOMAINS);

  register(domain: string): void {
    this.domains.add(domain);
  }

  has(domain: string): boolean {
    return this.domains.has(domain);
  }

  all(): string[] {
    return [...this.domains];
  }
}
