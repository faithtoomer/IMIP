import { DEFAULT_NOTIFICATION_CATEGORIES } from './types.js';

/** §6 — a real, runtime-extensible registry (not a closed union), matching
 * IOLA's LogCategoryRegistry pattern exactly — "future categories are
 * registry driven" is a runtime requirement. */
export class NotificationCategoryRegistry {
  private categories = new Set<string>(DEFAULT_NOTIFICATION_CATEGORIES);

  register(category: string): void {
    this.categories.add(category);
  }

  has(category: string): boolean {
    return this.categories.has(category);
  }

  all(): string[] {
    return [...this.categories];
  }
}
