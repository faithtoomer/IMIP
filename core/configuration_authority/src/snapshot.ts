import { createHash } from 'node:crypto';
import type { ConfigSnapshot, ConfigValues } from './types.js';
import { ConfigurationRollbackError } from './errors.js';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function computeSnapshotId(values: ConfigValues): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 16);
}

/** Creates an immutable runtime snapshot (§11), digitally identified by a content hash. */
export function createSnapshot(values: ConfigValues, version: number): ConfigSnapshot {
  const frozenValues = deepFreeze(structuredClone(values));
  return Object.freeze({
    version,
    id: computeSnapshotId(values),
    createdAt: new Date().toISOString(),
    values: frozenValues,
  });
}

/**
 * §11 — retains every activated snapshot for rollback. History is append-only:
 * rollback moves the "current" pointer to a prior entry without deleting any
 * snapshot, preserving the full audit-relevant history.
 */
export class SnapshotStore {
  private history: ConfigSnapshot[] = [];
  private currentIndex = -1;

  activate(snapshot: ConfigSnapshot): void {
    this.history.push(snapshot);
    this.currentIndex = this.history.length - 1;
  }

  current(): ConfigSnapshot | undefined {
    return this.currentIndex >= 0 ? this.history[this.currentIndex] : undefined;
  }

  all(): readonly ConfigSnapshot[] {
    return this.history;
  }

  findByVersion(version: number): ConfigSnapshot | undefined {
    return this.history.find((snapshot) => snapshot.version === version);
  }

  rollbackTo(version: number): ConfigSnapshot {
    const index = this.history.findIndex((snapshot) => snapshot.version === version);
    if (index === -1) {
      throw new ConfigurationRollbackError(`Cannot roll back: snapshot version ${version} not found in history.`);
    }
    this.currentIndex = index;
    return this.history[index];
  }
}
