import type { EscalationPolicy, EscalationStep, NotificationRecord } from './types.js';

/** §11 — a real, tick-based (not setTimeout-based) escalation check,
 * matching ISOA's `tick()` pattern: deterministic, testable with an
 * injectable clock, no timer flakiness. */
export function findDueEscalationStep(
  notification: NotificationRecord,
  policy: EscalationPolicy | undefined,
  now: Date,
): { step: EscalationStep; stepIndex: number } | undefined {
  if (!policy || policy.steps.length === 0) return undefined;
  if (notification.status !== 'queued' && notification.status !== 'delivered' && notification.status !== 'escalated') return undefined;
  if (notification.escalationLevel >= policy.steps.length) return undefined;

  const step = policy.steps[notification.escalationLevel];
  const elapsedMs = now.getTime() - new Date(notification.createdAt).getTime();
  if (elapsedMs < step.afterMs) return undefined;

  return { step, stepIndex: notification.escalationLevel };
}
