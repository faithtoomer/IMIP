import type { NotificationDefinition, NotificationRecord } from './types.js';

export interface SuppressionCheckContext {
  now: Date;
  recentNotifications: NotificationRecord[];
  isBlockedByMaintenance?: (at: Date) => { blocked: boolean; reasons: string[] };
}

export interface SuppressionResult {
  suppressed: boolean;
  reasons: string[];
}

/**
 * §13 — real, explainable suppression checks. `respectMaintenanceWindows`
 * consults ISOA's real Institutional Time Graph (`isBlockedByMaintenance`,
 * when a SchedulingAuthority is supplied) rather than duplicating a second
 * maintenance-window concept inside INCA — see ADR-0016.
 */
export function checkSuppression(
  candidate: { category: string; title: string; message: string },
  rules: NotificationDefinition['suppressionRules'],
  context: SuppressionCheckContext,
): SuppressionResult {
  if (!rules) return { suppressed: false, reasons: [] };
  const reasons: string[] = [];

  if (rules.categorySuppressed) {
    reasons.push(`Category "${candidate.category}" is suppressed.`);
  }

  if (rules.duplicateWindowMs !== undefined) {
    const windowMs = rules.duplicateWindowMs;
    const duplicate = context.recentNotifications.find(
      (record) =>
        record.category === candidate.category &&
        record.title === candidate.title &&
        record.message === candidate.message &&
        context.now.getTime() - new Date(record.createdAt).getTime() < windowMs,
    );
    if (duplicate) reasons.push(`Duplicate of notification "${duplicate.notificationId}" within the suppression window.`);
  }

  if (rules.quietHours) {
    const hour = context.now.getUTCHours();
    const { startHour, endHour } = rules.quietHours;
    const inWindow = startHour <= endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
    if (inWindow) reasons.push(`Within quiet hours (${startHour}:00–${endHour}:00 UTC).`);
  }

  if (rules.respectMaintenanceWindows && context.isBlockedByMaintenance) {
    const blocked = context.isBlockedByMaintenance(context.now);
    if (blocked.blocked) reasons.push(...blocked.reasons);
  }

  return { suppressed: reasons.length > 0, reasons };
}
