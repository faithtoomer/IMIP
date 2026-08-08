import type { TimeTrigger } from './types.js';

/**
 * §6/Law 6 — deterministic next-execution computation for time-based
 * triggers. UTC only, no timezone-library dependency — the simplest, safest
 * choice, matching the "no new dependency unless genuinely needed"
 * precedent (`node:sqlite`, `fs.statfsSync`).
 */
export function computeNextExecution(trigger: TimeTrigger, from: Date): Date | undefined {
  if (trigger.at !== undefined) {
    const at = new Date(trigger.at);
    return at.getTime() > from.getTime() ? at : undefined;
  }
  if (trigger.intervalMs !== undefined) {
    return new Date(from.getTime() + trigger.intervalMs);
  }
  if (trigger.dailyAt) {
    return nextDailyOccurrence(trigger.dailyAt, from);
  }
  if (trigger.weeklyAt) {
    return nextWeeklyOccurrence(trigger.weeklyAt, from);
  }
  return undefined;
}

function nextDailyOccurrence(dailyAt: { hour: number; minute: number }, from: Date): Date {
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), dailyAt.hour, dailyAt.minute, 0, 0),
  );
  if (candidate.getTime() <= from.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

function nextWeeklyOccurrence(weeklyAt: { dayOfWeek: number; hour: number; minute: number }, from: Date): Date {
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), weeklyAt.hour, weeklyAt.minute, 0, 0),
  );
  let dayDelta = (weeklyAt.dayOfWeek - candidate.getUTCDay() + 7) % 7;
  if (dayDelta === 0 && candidate.getTime() <= from.getTime()) dayDelta = 7;
  candidate.setUTCDate(candidate.getUTCDate() + dayDelta);
  return candidate;
}
