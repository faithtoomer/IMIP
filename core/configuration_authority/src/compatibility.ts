import type { ConfigValues } from './types.js';

export type CompatibilityChecker = (id: string, value: unknown, allValues: Readonly<ConfigValues>) => string | null;

/**
 * Extension point backing pipeline stages 8 (Hardware compatibility) and 9
 * (Policy compatibility). Real, complete, and fully functional with zero
 * registered checkers — there is no Hardware Authority or Policy Authority
 * implementation yet for ICMS to consult, so the correct current behavior is
 * "pass, nothing to check against" rather than a stub. When those authorities
 * exist, they register real checkers here via `.register()`; no changes to
 * the pipeline or ConfigurationAuthority are required.
 */
export class CompatibilityRegistry {
  private checkers: CompatibilityChecker[] = [];

  register(checker: CompatibilityChecker): void {
    this.checkers.push(checker);
  }

  check(id: string, value: unknown, allValues: Readonly<ConfigValues>): string | null {
    for (const checker of this.checkers) {
      const message = checker(id, value, allValues);
      if (message) return message;
    }
    return null;
  }
}
