import { describe, expect, it } from 'vitest';
import { assertScheduleTransition } from '../src/lifecycle.js';
import { InvalidScheduleTransitionError } from '../src/errors.js';

describe('assertScheduleTransition() (§8 — schedule lifecycle)', () => {
  it('allows the full linear happy path', () => {
    expect(() => assertScheduleTransition('created', 'validated')).not.toThrow();
    expect(() => assertScheduleTransition('validated', 'registered')).not.toThrow();
    expect(() => assertScheduleTransition('registered', 'eligible')).not.toThrow();
    expect(() => assertScheduleTransition('eligible', 'scheduled')).not.toThrow();
    expect(() => assertScheduleTransition('scheduled', 'executing')).not.toThrow();
    expect(() => assertScheduleTransition('executing', 'completed')).not.toThrow();
    expect(() => assertScheduleTransition('completed', 'rescheduled')).not.toThrow();
    expect(() => assertScheduleTransition('rescheduled', 'eligible')).not.toThrow();
  });

  it('allows a failed execution to reschedule or retire', () => {
    expect(() => assertScheduleTransition('executing', 'failed')).not.toThrow();
    expect(() => assertScheduleTransition('failed', 'rescheduled')).not.toThrow();
    expect(() => assertScheduleTransition('failed', 'retired')).not.toThrow();
  });

  it('allows cancellation from any non-terminal stage', () => {
    for (const from of ['registered', 'eligible', 'scheduled', 'paused'] as const) {
      expect(() => assertScheduleTransition(from, 'cancelled')).not.toThrow();
    }
  });

  it('rejects skipping stages', () => {
    expect(() => assertScheduleTransition('created', 'registered')).toThrow(InvalidScheduleTransitionError);
    expect(() => assertScheduleTransition('eligible', 'executing')).toThrow(InvalidScheduleTransitionError);
  });

  it('rejects any transition out of a terminal stage', () => {
    expect(() => assertScheduleTransition('cancelled', 'eligible')).toThrow(InvalidScheduleTransitionError);
    expect(() => assertScheduleTransition('retired', 'eligible')).toThrow(InvalidScheduleTransitionError);
  });

  it('pause/resume round-trips through eligible', () => {
    expect(() => assertScheduleTransition('eligible', 'paused')).not.toThrow();
    expect(() => assertScheduleTransition('paused', 'eligible')).not.toThrow();
  });
});
