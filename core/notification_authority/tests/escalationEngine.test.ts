import { describe, expect, it } from 'vitest';
import { findDueEscalationStep } from '../src/escalationEngine.js';
import type { NotificationRecord } from '../src/types.js';

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    notificationId: 'n1',
    notificationTypeId: 't1',
    category: 'hardware',
    severity: 'critical',
    priority: 'critical',
    title: 'x',
    message: 'y',
    requestingAuthority: 'X',
    status: 'delivered',
    requiresAcknowledgement: true,
    createdAt: '2026-08-08T12:00:00.000Z',
    deliveries: [],
    escalationLevel: 0,
    ...overrides,
  };
}

describe('findDueEscalationStep() (§11 — real, tick-based escalation)', () => {
  it('no policy — never escalates', () => {
    expect(findDueEscalationStep(makeRecord(), undefined, new Date('2026-08-08T12:10:00.000Z'))).toBeUndefined();
  });

  it('not yet due — the step\'s afterMs has not elapsed', () => {
    const policy = { steps: [{ afterMs: 10 * 60 * 1000, action: 'notify-operator' as const, recipientId: 'r1' }] };
    expect(findDueEscalationStep(makeRecord(), policy, new Date('2026-08-08T12:05:00.000Z'))).toBeUndefined();
  });

  it('due — the step\'s afterMs has elapsed', () => {
    const policy = { steps: [{ afterMs: 10 * 60 * 1000, action: 'notify-operator' as const, recipientId: 'r1' }] };
    const due = findDueEscalationStep(makeRecord(), policy, new Date('2026-08-08T12:11:00.000Z'));
    expect(due?.stepIndex).toBe(0);
    expect(due?.step.action).toBe('notify-operator');
  });

  it('advances to the next step once escalationLevel has moved past the first', () => {
    const policy = {
      steps: [
        { afterMs: 5 * 60 * 1000, action: 'retry-same-channel' as const },
        { afterMs: 10 * 60 * 1000, action: 'notify-administrator' as const, recipientId: 'r2' },
      ],
    };
    const record = makeRecord({ escalationLevel: 1 });
    const due = findDueEscalationStep(record, policy, new Date('2026-08-08T12:11:00.000Z'));
    expect(due?.stepIndex).toBe(1);
    expect(due?.step.action).toBe('notify-administrator');
  });

  it('no due step once every step has been exhausted', () => {
    const policy = { steps: [{ afterMs: 1000, action: 'notify-operator' as const, recipientId: 'r1' }] };
    const record = makeRecord({ escalationLevel: 1 });
    expect(findDueEscalationStep(record, policy, new Date('2026-08-08T13:00:00.000Z'))).toBeUndefined();
  });

  it('a notification in a terminal status does not escalate', () => {
    const policy = { steps: [{ afterMs: 1, action: 'notify-operator' as const, recipientId: 'r1' }] };
    expect(findDueEscalationStep(makeRecord({ status: 'acknowledged' }), policy, new Date('2026-08-08T13:00:00.000Z'))).toBeUndefined();
  });
});
