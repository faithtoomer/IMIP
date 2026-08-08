import type { EventDefinition } from '../../event_bus/src/index.js';
import { SCHEDULE_EVENTS } from './types.js';

export const PUBLISHER_AUTHORITY = 'Scheduling Authority';

/** §13 — the 11 named events, registered under the `'scheduler'`
 * EventCategory, which has been reserved and unused since Phase 01/05 —
 * no new category widening needed (unlike ISMA's `'storage'` or IOLA's
 * `runtime-logs`). ISOA has no legacy synchronous API to preserve, so it
 * publishes directly through the real IEB (IRBLM's pattern, ADR-0010 §2),
 * not the ICMS/IHIS/ISMA/IOLA mirror pattern. */
export const SCHEDULE_EVENT_DEFINITIONS: EventDefinition[] = Object.values(SCHEDULE_EVENTS).map((name) => ({
  id: `scheduler.${name}`,
  name,
  category: 'scheduler',
  description: `ISOA event: ${name}`,
  publisherAuthority: PUBLISHER_AUTHORITY,
  priority: name === SCHEDULE_EVENTS.ScheduleFailed ? 'high' : 'normal',
  deliveryMode: 'async',
  targeting: 'broadcast',
  version: '1.0.0',
}));
