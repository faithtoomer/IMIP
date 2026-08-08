import { InvalidPowerLifecycleTransitionError } from './errors.js';
import type { PowerLifecycleStage } from './types.js';

/** §13, extended per ADR-0019: `monitored ⇄ analyzed ⇄ optimized` all remain
 * reachable from each other (continuous monitoring, not a one-shot linear
 * pass), and `archived` is reachable from any active stage (a device can be
 * removed from the fleet at any point, not only after a full linear pass). */
const POWER_LIFECYCLE_TRANSITIONS: Record<PowerLifecycleStage, PowerLifecycleStage[]> = {
  discovered: ['profiled'],
  profiled: ['monitored'],
  monitored: ['analyzed', 'archived'],
  analyzed: ['optimized', 'monitored', 'archived'],
  optimized: ['monitored', 'archived'],
  archived: [],
};

export function assertPowerLifecycleTransition(from: PowerLifecycleStage, to: PowerLifecycleStage): void {
  if (!POWER_LIFECYCLE_TRANSITIONS[from].includes(to)) {
    throw new InvalidPowerLifecycleTransitionError(from, to);
  }
}
