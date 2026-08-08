import { describe, expect, it } from 'vitest';
import { computeDigestReport } from '../src/digestManager.js';
import type { DigestDefinition, NotificationRecord } from '../src/types.js';

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    notificationId: 'n1',
    notificationTypeId: 't1',
    category: 'hardware',
    severity: 'info',
    priority: 'normal',
    title: 'x',
    message: 'y',
    requestingAuthority: 'X',
    status: 'delivered',
    requiresAcknowledgement: false,
    createdAt: '2026-08-08T12:00:00.000Z',
    deliveries: [],
    escalationLevel: 0,
    ...overrides,
  };
}

const DIGEST: DigestDefinition = { digestId: 'd1', name: 'Daily Hardware', categories: ['hardware'], channels: ['console'] };

describe('computeDigestReport() (§14 — real digest computation)', () => {
  it('counts only records within the period and matching categories', () => {
    const records: NotificationRecord[] = [
      makeRecord({ notificationId: 'a', category: 'hardware', createdAt: '2026-08-08T10:00:00.000Z' }), // in period
      makeRecord({ notificationId: 'b', category: 'mining', createdAt: '2026-08-08T10:00:00.000Z' }), // wrong category
      makeRecord({ notificationId: 'c', category: 'hardware', createdAt: '2026-08-07T10:00:00.000Z' }), // before period
    ];
    const report = computeDigestReport(DIGEST, records, new Date('2026-08-08T00:00:00.000Z'), new Date('2026-08-09T00:00:00.000Z'));
    expect(report.notificationCount).toBe(1);
    expect(report.byCategory.hardware).toBe(1);
  });

  it('an empty categories list matches every category', () => {
    const allCategories: DigestDefinition = { ...DIGEST, categories: [] };
    const records: NotificationRecord[] = [
      makeRecord({ category: 'hardware', createdAt: '2026-08-08T10:00:00.000Z' }),
      makeRecord({ category: 'mining', createdAt: '2026-08-08T10:00:00.000Z' }),
    ];
    const report = computeDigestReport(allCategories, records, new Date('2026-08-08T00:00:00.000Z'), new Date('2026-08-09T00:00:00.000Z'));
    expect(report.notificationCount).toBe(2);
  });

  it('breaks down counts by severity', () => {
    const records: NotificationRecord[] = [
      makeRecord({ severity: 'critical', createdAt: '2026-08-08T10:00:00.000Z' }),
      makeRecord({ severity: 'critical', createdAt: '2026-08-08T11:00:00.000Z' }),
      makeRecord({ severity: 'info', createdAt: '2026-08-08T11:30:00.000Z' }),
    ];
    const report = computeDigestReport(DIGEST, records, new Date('2026-08-08T00:00:00.000Z'), new Date('2026-08-09T00:00:00.000Z'));
    expect(report.bySeverity.critical).toBe(2);
    expect(report.bySeverity.info).toBe(1);
  });
});
