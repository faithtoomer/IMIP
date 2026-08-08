import { describe, expect, it } from 'vitest';
import { checkSuppression } from '../src/suppressionEngine.js';
import type { NotificationRecord } from '../src/types.js';

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    notificationId: 'n1',
    notificationTypeId: 't1',
    category: 'hardware',
    severity: 'info',
    priority: 'normal',
    title: 'Fault',
    message: 'GPU 1 overheating',
    requestingAuthority: 'X',
    status: 'delivered',
    requiresAcknowledgement: false,
    createdAt: new Date().toISOString(),
    deliveries: [],
    escalationLevel: 0,
    ...overrides,
  };
}

describe('checkSuppression() (§13)', () => {
  it('no rules configured — never suppressed', () => {
    const result = checkSuppression({ category: 'hardware', title: 'x', message: 'y' }, undefined, { now: new Date(), recentNotifications: [] });
    expect(result.suppressed).toBe(false);
  });

  it('categorySuppressed suppresses unconditionally', () => {
    const result = checkSuppression(
      { category: 'hardware', title: 'x', message: 'y' },
      { categorySuppressed: true },
      { now: new Date(), recentNotifications: [] },
    );
    expect(result.suppressed).toBe(true);
  });

  it('duplicateWindowMs suppresses an identical notification within the window', () => {
    const now = new Date('2026-08-08T12:00:00.000Z');
    const recent = makeRecord({ createdAt: '2026-08-08T11:59:30.000Z' }); // 30s ago
    const result = checkSuppression(
      { category: 'hardware', title: 'Fault', message: 'GPU 1 overheating' },
      { duplicateWindowMs: 60_000 },
      { now, recentNotifications: [recent] },
    );
    expect(result.suppressed).toBe(true);
    expect(result.reasons[0]).toContain(recent.notificationId);
  });

  it('duplicateWindowMs does not suppress once the window has passed', () => {
    const now = new Date('2026-08-08T12:00:00.000Z');
    const recent = makeRecord({ createdAt: '2026-08-08T11:58:00.000Z' }); // 2 min ago
    const result = checkSuppression(
      { category: 'hardware', title: 'Fault', message: 'GPU 1 overheating' },
      { duplicateWindowMs: 60_000 },
      { now, recentNotifications: [recent] },
    );
    expect(result.suppressed).toBe(false);
  });

  it('quietHours suppresses within a same-day window', () => {
    const result = checkSuppression(
      { category: 'hardware', title: 'x', message: 'y' },
      { quietHours: { startHour: 22, endHour: 23 } },
      { now: new Date('2026-08-08T22:30:00.000Z'), recentNotifications: [] },
    );
    expect(result.suppressed).toBe(true);
  });

  it('quietHours suppresses within an overnight-wrapping window', () => {
    const result = checkSuppression(
      { category: 'hardware', title: 'x', message: 'y' },
      { quietHours: { startHour: 22, endHour: 6 } },
      { now: new Date('2026-08-08T02:00:00.000Z'), recentNotifications: [] },
    );
    expect(result.suppressed).toBe(true);
  });

  it('respectMaintenanceWindows consults the injected ISOA-backed check', () => {
    const result = checkSuppression(
      { category: 'hardware', title: 'x', message: 'y' },
      { respectMaintenanceWindows: true },
      { now: new Date(), recentNotifications: [], isBlockedByMaintenance: () => ({ blocked: true, reasons: ['maintenance window active'] }) },
    );
    expect(result.suppressed).toBe(true);
    expect(result.reasons).toContain('maintenance window active');
  });
});
