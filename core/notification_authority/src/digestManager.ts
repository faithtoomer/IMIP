import type { DigestDefinition, DigestReport, NotificationRecord } from './types.js';

/** §14 — a real digest computation over actual recorded notifications
 * within a period. No timer logic here — digest *triggering* is ISOA's
 * job (SchedulingAuthority), matching §14's own "integrates with the
 * Scheduler Authority" requirement; see NotificationAuthority.registerDigest(). */
export function computeDigestReport(
  digest: DigestDefinition,
  notifications: NotificationRecord[],
  periodStart: Date,
  periodEnd: Date,
): DigestReport {
  const inPeriod = notifications.filter((record) => {
    const timestamp = new Date(record.createdAt).getTime();
    const withinPeriod = timestamp >= periodStart.getTime() && timestamp < periodEnd.getTime();
    const matchesCategory = digest.categories.length === 0 || digest.categories.includes(record.category);
    return withinPeriod && matchesCategory;
  });

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const record of inPeriod) {
    byCategory[record.category] = (byCategory[record.category] ?? 0) + 1;
    bySeverity[record.severity] = (bySeverity[record.severity] ?? 0) + 1;
  }

  return {
    digestId: digest.digestId,
    generatedAt: new Date().toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    notificationCount: inPeriod.length,
    byCategory,
    bySeverity,
  };
}
