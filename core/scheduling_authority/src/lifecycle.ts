import { InvalidScheduleTransitionError } from './errors.js';
import type { ScheduleStatus } from './types.js';

/** §8 — the schedule lifecycle, extended with `paused`/`cancelled`/`failed`
 * beyond the spec's literal 9-node diagram (see ADR-0014). `cancelled` is
 * reachable from any non-terminal stage; `completed`/`failed` both lead to
 * either `rescheduled` (recurring triggers) or `retired` (one-shot). */
const TRANSITIONS: Record<ScheduleStatus, ScheduleStatus[]> = {
  created: ['validated'],
  validated: ['registered'],
  registered: ['eligible', 'paused', 'cancelled'],
  eligible: ['scheduled', 'paused', 'cancelled', 'retired'],
  scheduled: ['executing', 'paused', 'cancelled'],
  executing: ['completed', 'failed'],
  completed: ['rescheduled', 'retired'],
  failed: ['rescheduled', 'retired'],
  rescheduled: ['eligible'],
  paused: ['eligible', 'cancelled'],
  cancelled: [],
  retired: [],
};

export function assertScheduleTransition(from: ScheduleStatus, to: ScheduleStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new InvalidScheduleTransitionError(from, to);
  }
}
