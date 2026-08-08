import { describe, expect, it } from 'vitest';
import { InstitutionalCommunicationIntelligence } from '../src/intelligence.js';
import type { Acknowledgement, NotificationRecord } from '../src/types.js';

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

describe('InstitutionalCommunicationIntelligence (§24 — the ICI)', () => {
  it('channelReliability() computes real success rates per channel', () => {
    const records: NotificationRecord[] = [
      makeRecord({
        deliveries: [
          { channel: 'webhook', attemptedAt: '', result: { success: true, deliveredAt: '' } },
          { channel: 'webhook', attemptedAt: '', result: { success: false, deliveredAt: '' } },
        ],
      }),
    ];
    const ici = new InstitutionalCommunicationIntelligence(() => records, () => []);
    const [reliability] = ici.channelReliability();
    expect(reliability.channel).toBe('webhook');
    expect(reliability.attempts).toBe(2);
    expect(reliability.successRate).toBe(0.5);
  });

  it('mostIgnored() sorts by lowest acknowledgement rate first', () => {
    const records: NotificationRecord[] = [
      makeRecord({ notificationId: 'a', notificationTypeId: 'always-acked', requiresAcknowledgement: true }),
      makeRecord({ notificationId: 'b', notificationTypeId: 'never-acked', requiresAcknowledgement: true }),
    ];
    const acks: Acknowledgement[] = [{ notificationId: 'a', recipientId: 'r1', timestamp: '2026-08-08T12:01:00.000Z' }];
    const ici = new InstitutionalCommunicationIntelligence(() => records, () => acks);
    const [worst] = ici.mostIgnored();
    expect(worst.notificationTypeId).toBe('never-acked');
    expect(worst.acknowledgementRate).toBe(0);
  });

  it('mostIgnored() ignores notifications that never required acknowledgement', () => {
    const records: NotificationRecord[] = [makeRecord({ requiresAcknowledgement: false })];
    const ici = new InstitutionalCommunicationIntelligence(() => records, () => []);
    expect(ici.mostIgnored()).toHaveLength(0);
  });

  it('averageAcknowledgementLatency() computes real elapsed time between generation and acknowledgement', () => {
    const records: NotificationRecord[] = [makeRecord({ createdAt: '2026-08-08T12:00:00.000Z' })];
    const acks: Acknowledgement[] = [{ notificationId: 'n1', recipientId: 'r1', timestamp: '2026-08-08T12:05:00.000Z' }];
    const ici = new InstitutionalCommunicationIntelligence(() => records, () => acks);
    expect(ici.averageAcknowledgementLatency()).toBe(5 * 60 * 1000);
  });

  it('suppressionRate() computes the real fraction of suppressed notifications', () => {
    const records: NotificationRecord[] = [
      makeRecord({ notificationId: 'a', status: 'suppressed' }),
      makeRecord({ notificationId: 'b', status: 'delivered' }),
    ];
    const ici = new InstitutionalCommunicationIntelligence(() => records, () => []);
    expect(ici.suppressionRate()).toBe(0.5);
  });

  it('evaluate() with no data returns zeroed, real (not fabricated) values', () => {
    const ici = new InstitutionalCommunicationIntelligence(() => [], () => []);
    const insights = ici.evaluate();
    expect(insights.channelReliability).toEqual([]);
    expect(insights.mostIgnoredNotificationTypes).toEqual([]);
    expect(insights.averageAcknowledgementLatencyMs).toBe(0);
    expect(insights.suppressionRate).toBe(0);
  });
});
