import type { ConfigSnapshot, ConfigValues } from './types.js';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Creates an immutable runtime snapshot (§9). Authorities read only from this. */
export function createSnapshot(values: ConfigValues, version: number): ConfigSnapshot {
  const frozenValues = deepFreeze(structuredClone(values));
  return Object.freeze({
    version,
    createdAt: new Date().toISOString(),
    values: frozenValues,
  });
}
