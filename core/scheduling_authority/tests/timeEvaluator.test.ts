import { describe, expect, it } from 'vitest';
import { computeNextExecution } from '../src/timeEvaluator.js';

describe('computeNextExecution() (§6/Law 6 — deterministic time triggers)', () => {
  it('intervalMs: next execution is exactly `from + intervalMs`', () => {
    const from = new Date('2026-08-08T12:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', intervalMs: 60_000 }, from);
    expect(next?.toISOString()).toBe('2026-08-08T12:01:00.000Z');
  });

  it('at: returns the timestamp if still in the future', () => {
    const from = new Date('2026-08-08T12:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', at: '2026-08-08T13:00:00.000Z' }, from);
    expect(next?.toISOString()).toBe('2026-08-08T13:00:00.000Z');
  });

  it('at: returns undefined once the timestamp has passed', () => {
    const from = new Date('2026-08-08T12:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', at: '2026-08-08T11:00:00.000Z' }, from);
    expect(next).toBeUndefined();
  });

  it('dailyAt: rolls to today if the time hasn\'t passed yet', () => {
    const from = new Date('2026-08-08T10:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', dailyAt: { hour: 14, minute: 30 } }, from);
    expect(next?.toISOString()).toBe('2026-08-08T14:30:00.000Z');
  });

  it('dailyAt: rolls to tomorrow if today\'s time has already passed', () => {
    const from = new Date('2026-08-08T15:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', dailyAt: { hour: 14, minute: 30 } }, from);
    expect(next?.toISOString()).toBe('2026-08-09T14:30:00.000Z');
  });

  it('weeklyAt: finds the next occurrence of the given day of week', () => {
    // 2026-08-08 is a Saturday (day 6). Ask for Monday (day 1) at 09:00.
    const from = new Date('2026-08-08T00:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', weeklyAt: { dayOfWeek: 1, hour: 9, minute: 0 } }, from);
    expect(next?.toISOString()).toBe('2026-08-10T09:00:00.000Z');
  });

  it('weeklyAt: rolls a full week forward if today matches but the time has passed', () => {
    // 2026-08-08 is a Saturday (day 6), asking for Saturday 00:00 again from 12:00 the same day.
    const from = new Date('2026-08-08T12:00:00.000Z');
    const next = computeNextExecution({ kind: 'time', weeklyAt: { dayOfWeek: 6, hour: 0, minute: 0 } }, from);
    expect(next?.toISOString()).toBe('2026-08-15T00:00:00.000Z');
  });

  it('returns undefined for a trigger with no recognized time fields', () => {
    expect(computeNextExecution({ kind: 'time' }, new Date())).toBeUndefined();
  });
});
