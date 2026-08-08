import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A fresh, real, unique temp directory per test — cleaned up by the caller
 * via `cleanupTempRoot()`. Every ISMA test that touches disk uses one of
 * these rather than the repo's own filesystem. */
export function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'imip-isma-'));
}

export function cleanupTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
}
