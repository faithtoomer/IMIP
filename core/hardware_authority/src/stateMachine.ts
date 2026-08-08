import type { LifecycleStage, RuntimeState } from './types.js';
import { HardwareLifecycleError, HardwareStateTransitionError } from './errors.js';

/** §9 — allowed runtime state transitions. State changes are event-driven and
 * always validated against this table; an illegal transition throws rather than
 * silently succeeding. */
export const RUNTIME_STATE_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  available: ['reserved', 'busy', 'benchmarking', 'mining', 'ai-workload', 'offline', 'faulted', 'maintenance'],
  reserved: ['available', 'busy', 'offline', 'faulted'],
  busy: ['available', 'faulted', 'offline'],
  benchmarking: ['available', 'faulted'],
  mining: ['available', 'faulted', 'offline', 'maintenance'],
  'ai-workload': ['available', 'faulted', 'offline'],
  offline: ['available', 'faulted', 'maintenance'],
  faulted: ['maintenance', 'offline'],
  maintenance: ['available', 'offline', 'faulted'],
};

export function assertRuntimeTransition(from: RuntimeState, to: RuntimeState): void {
  if (from === to) return;
  const allowed = RUNTIME_STATE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HardwareStateTransitionError(`Illegal runtime state transition: "${from}" -> "${to}".`);
  }
}

/** §10 — device lifecycle. Strictly forward, one stage at a time; no skipping. */
const LIFECYCLE_ORDER: LifecycleStage[] = [
  'discovered',
  'registered',
  'capability-assessed',
  'benchmarked',
  'available',
  'allocated',
  'released',
  'retired',
];

/** Stages a device may return to from 'released' (re-allocation cycle) or from
 * 'available' back to 'allocated' directly — the lifecycle is forward-moving but
 * allocate/release cycles repeat without re-running discovery. */
const LIFECYCLE_EXTRA_EDGES: Partial<Record<LifecycleStage, LifecycleStage[]>> = {
  available: ['allocated', 'retired'],
  allocated: ['released', 'retired'],
  released: ['available', 'allocated', 'retired'],
};

export function assertLifecycleTransition(from: LifecycleStage, to: LifecycleStage): void {
  if (from === to) return;
  const forwardIndex = LIFECYCLE_ORDER.indexOf(from);
  const targetIndex = LIFECYCLE_ORDER.indexOf(to);
  const isNextStep = targetIndex === forwardIndex + 1;
  const isExtraEdge = (LIFECYCLE_EXTRA_EDGES[from] ?? []).includes(to);

  if (!isNextStep && !isExtraEdge) {
    throw new HardwareLifecycleError(`Illegal lifecycle transition: "${from}" -> "${to}".`);
  }
}
