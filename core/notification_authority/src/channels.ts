import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { ChannelType, DeliveryResult, NotificationChannel, NotificationRecord } from './types.js';

function now(): string {
  return new Date().toISOString();
}

/** §7 — stands in for "Desktop": zero-dependency, immediate local
 * visibility. Real desktop OS notification integration would require a new
 * platform-specific dependency this codebase has no precedent for. */
export class ConsoleNotificationChannel implements NotificationChannel {
  readonly type: ChannelType = 'console';

  async deliver(notification: NotificationRecord): Promise<DeliveryResult> {
    const line = `[${notification.priority.toUpperCase()}] ${notification.title}: ${notification.message}`;
    if (notification.severity === 'error' || notification.severity === 'critical') console.error(line);
    else if (notification.severity === 'warning') console.warn(line);
    else console.log(line);
    return { success: true, deliveredAt: now() };
  }
}

/** §7 — stands in for "Dashboard": a real, bounded, queryable in-memory
 * feed a future dashboard UI can poll or subscribe to, the same posture as
 * IOLA's MemoryLogSink. */
export class MemoryNotificationChannel implements NotificationChannel {
  readonly type: ChannelType = 'memory';
  private records: NotificationRecord[] = [];

  constructor(private readonly limit = 500) {}

  async deliver(notification: NotificationRecord): Promise<DeliveryResult> {
    this.records.push(notification);
    if (this.records.length > this.limit) this.records.shift();
    return { success: true, deliveredAt: now() };
  }

  all(): readonly NotificationRecord[] {
    return this.records;
  }
}

/** §7 "Log entry" — a real integration with IOLA (Phase 10), not a
 * separate logging mechanism. Requires the caller to have already
 * registered a `notification`/`delivery` schema with IOLA (Law 2) — this
 * channel does not silently swallow that requirement. */
export class LogNotificationChannel implements NotificationChannel {
  readonly type: ChannelType = 'log';

  constructor(private readonly observability: ObservabilityAuthority) {}

  async deliver(notification: NotificationRecord): Promise<DeliveryResult> {
    this.observability.log({
      severity: notification.severity === 'error' ? 'error' : notification.severity === 'critical' ? 'critical' : notification.severity === 'warning' ? 'warning' : 'information',
      category: 'notification',
      authority: 'Notification & Communication Authority',
      operation: 'notification-delivered',
      message: notification.message,
      context: { notificationId: notification.notificationId, title: notification.title, category: notification.category },
    });
    return { success: true, deliveredAt: now() };
  }
}

/**
 * §7 — a real webhook channel using Node's built-in global `fetch` (no new
 * dependency). POSTs a JSON payload to the configured URL.
 */
export class WebhookNotificationChannel implements NotificationChannel {
  readonly type: ChannelType = 'webhook';

  constructor(
    private readonly url: string,
    private readonly buildPayload: (notification: NotificationRecord) => unknown = (n) => n,
  ) {}

  async deliver(notification: NotificationRecord): Promise<DeliveryResult> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildPayload(notification)),
      });
      return { success: response.ok, message: response.ok ? undefined : `HTTP ${response.status}`, deliveredAt: now() };
    } catch (error) {
      return { success: false, message: (error as Error).message, deliveredAt: now() };
    }
  }
}

/** §7 — Discord's integration mechanism is itself a webhook; this is a
 * real `WebhookNotificationChannel` configured with Discord's expected
 * payload shape (`{ content: "..." }`), not a separate implementation. */
export class DiscordNotificationChannel extends WebhookNotificationChannel {
  readonly type: ChannelType = 'discord';

  constructor(webhookUrl: string) {
    super(webhookUrl, (notification) => ({ content: `**${notification.title}**\n${notification.message}` }));
  }
}

/**
 * §7 "Email" — listed as initial support, but no SMTP client exists
 * anywhere in this codebase and adding one is a new dependency for a
 * capability nothing else needs. Real, generic, and functional if the
 * caller supplies an actual sender (their own SMTP/HTTP-email
 * integration) — the same "real mechanism, bring your own backend"
 * posture as EventPersistence's database mode (ADR-0009). No default
 * sender ships. See ADR-0016.
 */
export class EmailNotificationChannel implements NotificationChannel {
  readonly type: ChannelType = 'email';

  constructor(private readonly send: (notification: NotificationRecord) => Promise<void>) {}

  async deliver(notification: NotificationRecord): Promise<DeliveryResult> {
    try {
      await this.send(notification);
      return { success: true, deliveredAt: now() };
    } catch (error) {
      return { success: false, message: (error as Error).message, deliveredAt: now() };
    }
  }
}
