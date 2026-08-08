import type { Acknowledgement, ChannelReliability, CommunicationInsights, IgnoredNotificationType, NotificationRecord } from './types.js';

/**
 * §24 — Architect's Enhancement: Institutional Communication Intelligence
 * (ICI), built in full per explicit direction. Computed entirely from real,
 * already-tracked delivery/acknowledgement data — never changes policy
 * itself (§24 is explicit about this), it only produces insights.
 */
export class InstitutionalCommunicationIntelligence {
  constructor(
    private readonly notifications: () => NotificationRecord[],
    private readonly acknowledgements: () => readonly Acknowledgement[],
  ) {}

  evaluate(): CommunicationInsights {
    return {
      generatedAt: new Date().toISOString(),
      channelReliability: this.channelReliability(),
      mostIgnoredNotificationTypes: this.mostIgnored(),
      averageAcknowledgementLatencyMs: this.averageAcknowledgementLatency(),
      suppressionRate: this.suppressionRate(),
    };
  }

  /** §24 example question: "which notification channel is most reliable?" */
  channelReliability(): ChannelReliability[] {
    const byChannel = new Map<string, { attempts: number; successes: number }>();
    for (const record of this.notifications()) {
      for (const delivery of record.deliveries) {
        const bucket = byChannel.get(delivery.channel) ?? { attempts: 0, successes: 0 };
        bucket.attempts += 1;
        if (delivery.result.success) bucket.successes += 1;
        byChannel.set(delivery.channel, bucket);
      }
    }
    return [...byChannel.entries()].map(([channel, stats]) => ({
      channel,
      attempts: stats.attempts,
      successes: stats.successes,
      successRate: stats.attempts === 0 ? 0 : stats.successes / stats.attempts,
    }));
  }

  /** §24 example question: "which alerts are routinely ignored?" */
  mostIgnored(): IgnoredNotificationType[] {
    const ackedIds = new Set(this.acknowledgements().map((ack) => ack.notificationId));
    const byType = new Map<string, { sent: number; acked: number }>();
    for (const record of this.notifications()) {
      if (!record.requiresAcknowledgement) continue;
      const bucket = byType.get(record.notificationTypeId) ?? { sent: 0, acked: 0 };
      bucket.sent += 1;
      if (ackedIds.has(record.notificationId)) bucket.acked += 1;
      byType.set(record.notificationTypeId, bucket);
    }
    return [...byType.entries()]
      .map(([notificationTypeId, stats]) => ({
        notificationTypeId,
        sentCount: stats.sent,
        acknowledgedCount: stats.acked,
        acknowledgementRate: stats.sent === 0 ? 0 : stats.acked / stats.sent,
      }))
      .sort((a, b) => a.acknowledgementRate - b.acknowledgementRate);
  }

  /** §24 example question: "which notification policies generate the fastest response?" (inverse: latency) */
  averageAcknowledgementLatency(): number {
    const notificationsById = new Map(this.notifications().map((record) => [record.notificationId, record]));
    const latencies = this.acknowledgements()
      .map((ack) => {
        const record = notificationsById.get(ack.notificationId);
        return record ? new Date(ack.timestamp).getTime() - new Date(record.createdAt).getTime() : undefined;
      })
      .filter((value): value is number => value !== undefined);
    if (latencies.length === 0) return 0;
    return latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  }

  /** §24 example question: "are operators experiencing notification fatigue?" (proxy: suppression rate) */
  suppressionRate(): number {
    const all = this.notifications();
    if (all.length === 0) return 0;
    return all.filter((record) => record.status === 'suppressed').length / all.length;
  }
}
