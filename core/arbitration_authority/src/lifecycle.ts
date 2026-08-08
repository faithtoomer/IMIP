import { ArbitrationLifecycleError } from './errors.js';
import type { ArbitrationLifecycleStage } from './types.js';

export const ARBITRATION_LIFECYCLE: readonly ArbitrationLifecycleStage[] = Object.freeze([
  'request-received', 'contention-detected', 'policy-evaluation', 'constraint-evaluation',
  'winner-selected', 'decision-published', 'history-archived',
]);
export const ARBITRATION_LIFECYCLE_TRANSITIONS: Readonly<Record<ArbitrationLifecycleStage, readonly ArbitrationLifecycleStage[]>> = Object.freeze({
  'request-received': ['contention-detected'],
  'contention-detected': ['policy-evaluation'],
  'policy-evaluation': ['constraint-evaluation'],
  'constraint-evaluation': ['winner-selected'],
  'winner-selected': ['decision-published'],
  'decision-published': ['history-archived'],
  'history-archived': [],
});

/** The approved seven-stage lifecycle has no implicit or skipped transitions. */
export function assertArbitrationLifecycleTransition(from: ArbitrationLifecycleStage | undefined, to: ArbitrationLifecycleStage): void {
  if (from === undefined && to === 'request-received') return;
  if (from !== undefined && ARBITRATION_LIFECYCLE_TRANSITIONS[from].includes(to)) return;
  throw new ArbitrationLifecycleError(from, to);
}
