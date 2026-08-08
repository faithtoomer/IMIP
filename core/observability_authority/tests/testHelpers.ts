import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ObservabilityAuthority } from '../src/ObservabilityAuthority.js';

export function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'imip-iola-'));
}

export function cleanupTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

/** Registers a single (category, operation) schema and returns it, so tests
 * don't have to repeat the Law 2 registration boilerplate for every case. */
export function allow(iola: ObservabilityAuthority, category: string, operation: string, requiredContextFields?: string[]): void {
  if (!iola.categories.has(category)) iola.registerCategory(category);
  iola.registerSchema({ category, operation, description: `test schema for ${category}/${operation}`, requiredContextFields });
}
