import type { RuntimeState } from './types.js';
import { InvalidLifecycleTransitionError } from './errors.js';

/** §7 — allowed platform-level lifecycle transitions. */
export const RUNTIME_STATE_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  stopped: ['booting'],
  booting: ['initializing', 'faulted'],
  initializing: ['validating', 'faulted'],
  validating: ['ready', 'faulted'],
  ready: ['operational', 'faulted'],
  operational: ['paused', 'maintenance', 'restarting', 'shutting-down', 'faulted'],
  paused: ['operational', 'shutting-down', 'faulted'],
  maintenance: ['operational', 'shutting-down', 'faulted'],
  restarting: ['booting', 'faulted'],
  'shutting-down': ['stopped'],
  recovering: ['booting', 'operational', 'faulted'],
  faulted: ['recovering', 'shutting-down'],
};

export function assertRuntimeTransition(from: RuntimeState, to: RuntimeState): void {
  if (from === to) return;
  const allowed = RUNTIME_STATE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidLifecycleTransitionError(from, to);
  }
}
