import { BenchmarkLifecycleError } from './errors.js';
import type { BenchmarkLifecycleState } from './types.js';

export const BENCHMARK_LIFECYCLE: readonly BenchmarkLifecycleState[] = Object.freeze([
  'created', 'validated', 'scheduled', 'executed', 'verified', 'stored', 'compared', 'archived',
]);

export const BENCHMARK_LIFECYCLE_TRANSITIONS: Readonly<Record<BenchmarkLifecycleState, readonly BenchmarkLifecycleState[]>> = Object.freeze({
  created: ['validated'],
  validated: ['scheduled'],
  scheduled: ['executed'],
  executed: ['verified'],
  verified: ['stored'],
  stored: ['compared'],
  compared: ['archived'],
  archived: [],
});

/** Enforces the approved eight-state sequence; failure publication does not invent a ninth state. */
export function assertBenchmarkLifecycleTransition(from: BenchmarkLifecycleState | undefined, to: BenchmarkLifecycleState): void {
  if (from === undefined && to === 'created') return;
  if (from !== undefined && BENCHMARK_LIFECYCLE_TRANSITIONS[from].includes(to)) return;
  throw new BenchmarkLifecycleError(from, to);
}
