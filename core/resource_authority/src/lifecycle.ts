import type { ResourceState } from './types.js';
import { IllegalStateTransitionError } from './errors.js';

/** §8 — allowed resource lifecycle state transitions. */
export const RESOURCE_STATE_TRANSITIONS: Record<ResourceState, ResourceState[]> = {
  discovered: ['registered', 'unavailable', 'retired'],
  registered: ['available', 'unavailable', 'retired'],
  available: ['reserved', 'allocated', 'unavailable', 'retired'],
  reserved: ['available', 'allocated', 'unavailable', 'retired'],
  allocated: ['active', 'released', 'unavailable', 'retired'],
  active: ['released', 'unavailable', 'retired'],
  released: ['available', 'allocated', 'unavailable', 'retired'],
  unavailable: ['available', 'registered', 'retired'],
  retired: [],
};

const REENTRY_EDGES: Partial<Record<ResourceState, ResourceState[]>> = {
  released: ['available', 'allocated'],
  available: ['reserved', 'allocated'],
};

export function assertResourceStateTransition(from: ResourceState, to: ResourceState): void {
  if (from === to) return;
  const allowed = RESOURCE_STATE_TRANSITIONS[from] ?? [];
  const reentry = REENTRY_EDGES[from] ?? [];
  if (!allowed.includes(to) && !reentry.includes(to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}

export function canTransition(from: ResourceState, to: ResourceState): boolean {
  if (from === to) return true;
  const allowed = RESOURCE_STATE_TRANSITIONS[from] ?? [];
  const reentry = REENTRY_EDGES[from] ?? [];
  return allowed.includes(to) || reentry.includes(to);
}
