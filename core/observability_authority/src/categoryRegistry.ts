import { DEFAULT_LOG_CATEGORIES } from './types.js';
import { DuplicateLogCategoryError } from './errors.js';

/** §6 — SSOT for log categories. Pre-seeded with the spec's 19 named
 * categories; §6's "future categories shall be registered" is a runtime
 * requirement, so this is a real registry (like EventRegistry/
 * ConfigurationRegistry), not a closed compile-time union. */
export class LogCategoryRegistry {
  private categories = new Set<string>(DEFAULT_LOG_CATEGORIES);

  register(category: string): void {
    if (this.categories.has(category)) throw new DuplicateLogCategoryError(category);
    this.categories.add(category);
  }

  has(category: string): boolean {
    return this.categories.has(category);
  }

  all(): string[] {
    return [...this.categories];
  }
}
