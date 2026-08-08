import { PowerLifecycleError } from './errors.js';
import type { PowerLifecycleStage } from './types.js';

/** §13 — allowed lifecycle transitions. */
export const POWER_LIFECYCLE_TRANSITIONS: Record<PowerLifecycleStage, PowerLifecycleStage[]> = {
  discovered: ['profiled', 'archived'],
  profiled: ['monitored', 'archived'],
  monitored: ['analyzed', 'archived'],
  analyzed: ['optimized', 'archived'],
  optimized: ['archived'],
  archived: [],
};

export function assertLifecycleTransition(from: PowerLifecycleStage, to: PowerLifecycleStage): void {
  if (from === to) return;
  const allowed = POWER_LIFECYCLE_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new PowerLifecycleError(`Illegal power lifecycle transition: "${from}" -> "${to}"`);
  }
}
