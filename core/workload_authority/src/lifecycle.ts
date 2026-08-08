import type { WorkloadState } from './types.js';
import { IllegalWorkloadStateTransitionError } from './errors.js';

/** §5 — allowed workload lifecycle transitions. */
export const WORKLOAD_STATE_TRANSITIONS: Record<WorkloadState, WorkloadState[]> = {
  created: ['validated', 'archived'],
  validated: ['queued', 'archived'],
  queued: ['assigned', 'archived'],
  assigned: ['running', 'archived'],
  running: ['paused', 'completed', 'failed', 'archived'],
  paused: ['running', 'completed', 'failed', 'archived'],
  completed: ['archived'],
  failed: ['archived'],
  archived: [],
};

export function assertWorkloadStateTransition(from: WorkloadState, to: WorkloadState): void {
  if (from === to) return;
  if (!WORKLOAD_STATE_TRANSITIONS[from].includes(to)) {
    throw new IllegalWorkloadStateTransitionError(from, to);
  }
}

export function canTransitionWorkload(from: WorkloadState, to: WorkloadState): boolean {
  return from === to || WORKLOAD_STATE_TRANSITIONS[from].includes(to);
}
