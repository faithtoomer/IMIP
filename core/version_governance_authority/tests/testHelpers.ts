import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'imip-ivgma-'));
}

export function cleanupTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
}
