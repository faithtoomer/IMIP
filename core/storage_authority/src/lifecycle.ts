import { InvalidStorageTransitionError } from './errors.js';
import type { StorageLifecycleStage } from './types.js';

/** §12 — the storage lifecycle transition table:
 * allocated -> active -> archived -> retained -> expired -> deleted.
 * `deleted` is reachable from any non-terminal stage (release/cleanup can
 * happen at any point); every other transition follows the linear sequence. */
const TRANSITIONS: Record<StorageLifecycleStage, StorageLifecycleStage[]> = {
  allocated: ['active', 'deleted'],
  active: ['archived', 'expired', 'deleted'],
  archived: ['retained', 'deleted'],
  retained: ['expired', 'deleted'],
  expired: ['deleted'],
  deleted: [],
};

export function assertStorageTransition(from: StorageLifecycleStage, to: StorageLifecycleStage): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new InvalidStorageTransitionError(from, to);
  }
}
