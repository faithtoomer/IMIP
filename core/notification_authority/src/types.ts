/** §6 — INCA's own notification-type categories. Deliberately a separate,
 * runtime-extensible registry from the Event Bus's `EventCategory` — the
 * spec's own list (`maintenance`, `backup`, `recovery`, `operator`, ...)
 * includes values that aren't in `EventCategory` at all, so this can't be a
 * reuse of that union (same reasoning as IOLA's LogCategoryRegistry, §6 of
 * PHASE-10). INCA's own 8 events register under the Event Bus's existing
 * `'notification'` category instead — see events.ts. */
export const DEFAULT_NOTIFICATION_CATEGORIES = [
  'runtime',
  'configuration',
  'hardware',
  'mining',
  'profitability',
  'power',
  'thermal',
  'security',
  'plugin',
  'scheduler',
  'maintenance',
  'backup',
  'recovery',
  'diagnostics',
  'decision',
  'ai',
  'operator',
] as const;

export type DefaultNotificationCategory = (typeof DEFAULT_NOTIFICATION_CATEGORIES)[number];

/** §8 — describes the underlying situation's severity. */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * §10 — delivery urgency. Deliberately its own type, not a reuse of the
 * Event Bus's `EventPriority` (`critical|high|normal|low|background`) —
 * the value sets don't match (`informational` here, `background` there).
 * Reusing a mismatched enum would be worse than defining a new one; see
 * ADR-0016.
 */
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low' | 'informational';

export type ChannelType = 'console' | 'memory' | 'log' | 'webhook' | 'discord' | 'email' | (string & {});

export interface DeliveryResult {
  success: boolean;
  message?: string;
  deliveredAt: string;
}

/** §7 — every channel implements this. Console/Memory/Log/Webhook/Discord
 * ship real, functional implementations; Email ships only this interface —
 * no SMTP client exists anywhere in this codebase, and adding one would be
 * a new dependency for a capability nothing else needs (same "real
 * mechanism, bring your own backend" posture as EventPersistence's
 * database mode, ADR-0009). */
export interface NotificationChannel {
  readonly type: ChannelType;
  deliver(notification: NotificationRecord): Promise<DeliveryResult>;
}

export type EscalationAction = 'retry-same-channel' | 'alternate-channel' | 'notify-operator' | 'notify-administrator' | 'broadcast-critical';

export interface EscalationStep {
  afterMs: number;
  action: EscalationAction;
  alternateChannels?: ChannelType[];
  recipientId?: string;
}

export interface EscalationPolicy {
  steps: EscalationStep[];
}

export interface RetentionPolicy {
  maxAgeMs?: number;
  maxEntries?: number;
}

/** §13 — `respectMaintenanceWindows` is checked against ISOA's real
 * Institutional Time Graph when a SchedulingAuthority is supplied, not a
 * second, separately-tracked maintenance-window concept — see ADR-0016. */
export interface SuppressionRuleSet {
  duplicateWindowMs?: number;
  categorySuppressed?: boolean;
  respectMaintenanceWindows?: boolean;
  quietHours?: { startHour: number; endHour: number };
}

/** §8 — every registered notification type. */
export interface NotificationDefinition {
  notificationTypeId: string;
  name: string;
  category: string;
  triggerEvent?: string;
  severity: NotificationSeverity;
  defaultPriority: NotificationPriority;
  defaultChannels: ChannelType[];
  escalationPolicy?: EscalationPolicy;
  requiresAcknowledgement: boolean;
  retentionPolicy?: RetentionPolicy;
  suppressionRules?: SuppressionRuleSet;
}

/** §9, extended beyond the spec's literal 7-node diagram with `suppressed`,
 * `failed`, and `escalated` — required for §11/§13/§18 to be real states a
 * notification instance can actually be found in, not just interfaces with
 * nowhere to route. See ADR-0016. */
export type NotificationInstanceStatus =
  | 'generated'
  | 'validated'
  | 'registered'
  | 'queued'
  | 'delivered'
  | 'acknowledged'
  | 'archived'
  | 'suppressed'
  | 'failed'
  | 'escalated';

export interface DeliveryAttempt {
  channel: ChannelType;
  attemptedAt: string;
  result: DeliveryResult;
}

export interface NotificationRecord {
  notificationId: string;
  notificationTypeId: string;
  category: string;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  triggerEventId?: string;
  requestingAuthority: string;
  status: NotificationInstanceStatus;
  requiresAcknowledgement: boolean;
  createdAt: string;
  deliveries: DeliveryAttempt[];
  escalationLevel: number;
  correlationId?: string;
  traceId?: string;
}

export type NotificationRequest = Pick<NotificationRecord, 'notificationTypeId' | 'title' | 'message' | 'requestingAuthority'> &
  Partial<Pick<NotificationRecord, 'context' | 'triggerEventId' | 'correlationId' | 'traceId'>> & {
    priority?: NotificationPriority;
    channels?: ChannelType[];
  };

/** §12 — immutable once recorded. */
export interface Acknowledgement {
  notificationId: string;
  recipientId: string;
  timestamp: string;
  response?: string;
}

export interface Recipient {
  recipientId: string;
  name: string;
  channels: ChannelType[];
  subscribedCategories?: string[];
  minimumPriority?: NotificationPriority;
}

export interface DigestDefinition {
  digestId: string;
  name: string;
  categories: string[];
  channels: ChannelType[];
  /** Populated once registered with a SchedulingAuthority, if one is supplied. */
  scheduleId?: string;
}

export interface DigestReport {
  digestId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  notificationCount: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface NotificationMetrics {
  generatedCount: number;
  deliveredCount: number;
  failedCount: number;
  escalationCount: number;
  suppressedCount: number;
  averageDeliveryLatencyMs: number;
  averageAcknowledgementLatencyMs: number;
}

/** §15 — the 8 named events. */
export const NOTIFICATION_EVENTS = {
  NotificationGenerated: 'NotificationGenerated',
  NotificationQueued: 'NotificationQueued',
  NotificationDelivered: 'NotificationDelivered',
  NotificationFailed: 'NotificationFailed',
  NotificationAcknowledged: 'NotificationAcknowledged',
  NotificationEscalated: 'NotificationEscalated',
  NotificationSuppressed: 'NotificationSuppressed',
  DigestGenerated: 'DigestGenerated',
} as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

/** §24 — a single channel's observed reliability. */
export interface ChannelReliability {
  channel: ChannelType;
  attempts: number;
  successes: number;
  successRate: number;
}

export interface IgnoredNotificationType {
  notificationTypeId: string;
  sentCount: number;
  acknowledgedCount: number;
  acknowledgementRate: number;
}

export interface CommunicationInsights {
  generatedAt: string;
  channelReliability: ChannelReliability[];
  mostIgnoredNotificationTypes: IgnoredNotificationType[];
  averageAcknowledgementLatencyMs: number;
  suppressionRate: number;
}
