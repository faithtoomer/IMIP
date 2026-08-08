import { randomUUID } from 'node:crypto';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { SchedulingAuthority, TimeTrigger } from '../../scheduling_authority/src/index.js';
import { NotificationCategoryRegistry } from './categoryRegistry.js';
import { NotificationRegistry } from './registry.js';
import { RecipientRegistry } from './recipientRegistry.js';
import { AcknowledgementManager } from './acknowledgementManager.js';
import { NotificationAuditTrail } from './auditTrail.js';
import { NotificationEventBus } from './events.js';
import { InstitutionalCommunicationIntelligence } from './intelligence.js';
import { checkSuppression } from './suppressionEngine.js';
import { findDueEscalationStep } from './escalationEngine.js';
import { computeDigestReport } from './digestManager.js';
import { ConsoleNotificationChannel } from './channels.js';
import {
  DigestNotFoundError,
  DuplicateChannelError,
  NotificationNotFoundError,
  UnregisteredNotificationCategoryError,
} from './errors.js';
import { NOTIFICATION_EVENTS } from './types.js';
import type {
  Acknowledgement,
  ChannelType,
  DeliveryAttempt,
  DigestDefinition,
  DigestReport,
  NotificationChannel,
  NotificationDefinition,
  NotificationInstanceStatus,
  NotificationMetrics,
  NotificationRecord,
  NotificationRequest,
  Recipient,
} from './types.js';

export interface NotificationAuthorityOptions {
  eventBus?: InstitutionalEventBus;
  observabilityAuthority?: ObservabilityAuthority;
  /** Enables real digest scheduling (§14) and real maintenance-window
   * suppression (§13), both delegated to ISOA rather than reimplemented. */
  schedulingAuthority?: SchedulingAuthority;
  /** Additional channels beyond the always-registered ConsoleNotificationChannel. */
  channels?: NotificationChannel[];
  now?: () => Date;
}

const LOG_CATEGORY = 'notification';
const SELF_AUTHORITY = 'Notification & Communication Authority';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * INCA — the Institutional Notification & Communication Authority
 * (PHASE-13). The sole authority for generating, routing, delivering,
 * tracking, escalating, and auditing platform notifications. Notifications
 * are decisions, not messages (user framing): `requestNotification()`
 * decides who should know, through which channel, with what priority,
 * whether acknowledgement is required, and whether it should escalate.
 *
 * `requestNotification()` itself is synchronous and returns immediately
 * (Law 6 "non-blocking") — actual channel delivery (often real network
 * I/O) runs as a tracked, not-awaited background task. Events mirror onto
 * the real IEB (ADR-0009 §6 pattern), the same choice made for ISTA.
 */
export class NotificationAuthority {
  readonly categories = new NotificationCategoryRegistry();
  readonly registry = new NotificationRegistry();
  readonly recipients = new RecipientRegistry();
  readonly acknowledgements = new AcknowledgementManager();
  readonly audit = new NotificationAuditTrail();
  readonly events: NotificationEventBus;
  readonly intelligence: InstitutionalCommunicationIntelligence;

  private readonly channels = new Map<string, NotificationChannel>();
  private readonly records = new Map<string, NotificationRecord>();
  private readonly digests = new Map<string, DigestDefinition>();
  private readonly observability?: ObservabilityAuthority;
  private readonly schedulingAuthority?: SchedulingAuthority;
  private readonly now: () => Date;
  private pendingDeliveries: Promise<void>[] = [];

  private generatedCount = 0;
  private deliveredCount = 0;
  private failedCount = 0;
  private escalationCount = 0;
  private suppressedCount = 0;
  private readonly deliveryDurations: number[] = [];

  constructor(options: NotificationAuthorityOptions = {}) {
    this.observability = options.observabilityAuthority;
    this.schedulingAuthority = options.schedulingAuthority;
    this.now = options.now ?? (() => new Date());
    this.events = new NotificationEventBus(options.eventBus);
    this.intelligence = new InstitutionalCommunicationIntelligence(
      () => this.history(),
      () => this.acknowledgements.all(),
    );

    this.registerChannel(new ConsoleNotificationChannel());
    for (const channel of options.channels ?? []) this.registerChannel(channel);

    if (this.observability) {
      if (!this.observability.categories.has(LOG_CATEGORY)) this.observability.registerCategory(LOG_CATEGORY);
      for (const name of Object.values(NOTIFICATION_EVENTS)) {
        if (!this.observability.schemas.get(LOG_CATEGORY, name)) {
          this.observability.registerSchema({ category: LOG_CATEGORY, operation: name, description: `INCA event: ${name}` });
        }
      }
    }
  }

  // ---- Registration ----

  registerCategory(category: string): void {
    this.categories.register(category);
  }

  registerNotificationType(definition: NotificationDefinition): void {
    if (!this.categories.has(definition.category)) throw new UnregisteredNotificationCategoryError(definition.category);
    this.registry.register(definition);
  }

  registerChannel(channel: NotificationChannel): void {
    if (this.channels.has(channel.type)) throw new DuplicateChannelError(channel.type);
    this.channels.set(channel.type, channel);
  }

  registerRecipient(recipient: Recipient): void {
    this.recipients.register(recipient);
  }

  // ---- Core: request -> generate -> suppress-or-queue-and-deliver (§9, Law 6) ----

  requestNotification(request: NotificationRequest): NotificationRecord {
    const definition = this.registry.require(request.notificationTypeId);
    if (!this.categories.has(definition.category)) throw new UnregisteredNotificationCategoryError(definition.category);

    const notificationId = randomUUID();
    let record: NotificationRecord = {
      notificationId,
      notificationTypeId: request.notificationTypeId,
      category: definition.category,
      severity: definition.severity,
      priority: request.priority ?? definition.defaultPriority,
      title: request.title,
      message: request.message,
      context: request.context,
      triggerEventId: request.triggerEventId,
      requestingAuthority: request.requestingAuthority,
      status: 'generated',
      requiresAcknowledgement: definition.requiresAcknowledgement,
      createdAt: this.now().toISOString(),
      deliveries: [],
      escalationLevel: 0,
      correlationId: request.correlationId,
      traceId: request.traceId,
    };
    this.generatedCount += 1;
    this.publish(NOTIFICATION_EVENTS.NotificationGenerated, { notificationId, notificationTypeId: request.notificationTypeId });

    record = this.transition(record, 'validated');

    const suppression = checkSuppression(
      { category: record.category, title: record.title, message: record.message },
      definition.suppressionRules,
      {
        now: this.now(),
        // Excludes this notification's own just-recorded 'validated'
        // snapshot — otherwise duplicate detection matches a notification
        // against itself (real bug caught by testing; see ADR-0016).
        recentNotifications: this.history().filter((existing) => existing.notificationId !== notificationId),
        isBlockedByMaintenance: this.schedulingAuthority ? (at) => this.schedulingAuthority!.graph.isBlockedAt(at) : undefined,
      },
    );
    if (suppression.suppressed) {
      record = this.transition(record, 'suppressed');
      this.suppressedCount += 1;
      this.publish(NOTIFICATION_EVENTS.NotificationSuppressed, { notificationId, reasons: suppression.reasons });
      return record;
    }

    record = this.transition(record, 'registered');
    record = this.transition(record, 'queued');
    this.publish(NOTIFICATION_EVENTS.NotificationQueued, { notificationId });

    const channelTypes = request.channels ?? definition.defaultChannels;
    this.pendingDeliveries.push(this.deliver(record, channelTypes).catch(() => {}));

    return record;
  }

  private async deliver(record: NotificationRecord, channelTypes: ChannelType[]): Promise<void> {
    const attempts: DeliveryAttempt[] = [];
    let anySuccess = false;

    for (const channelType of channelTypes) {
      const channel = this.channels.get(channelType);
      const attemptedAt = this.now().toISOString();
      if (!channel) {
        attempts.push({ channel: channelType, attemptedAt, result: { success: false, message: 'Unregistered channel.', deliveredAt: attemptedAt } });
        continue;
      }
      const start = performance.now();
      const result = await channel.deliver(record);
      this.deliveryDurations.push(performance.now() - start);
      attempts.push({ channel: channelType, attemptedAt, result });
      if (result.success) anySuccess = true;
    }

    const current = this.records.get(record.notificationId);
    if (!current) return;
    const status: NotificationInstanceStatus = anySuccess ? 'delivered' : 'failed';
    const updated: NotificationRecord = { ...current, deliveries: [...current.deliveries, ...attempts], status };
    this.setRecord(updated);

    if (anySuccess) {
      this.deliveredCount += 1;
      this.publish(NOTIFICATION_EVENTS.NotificationDelivered, { notificationId: record.notificationId });
    } else {
      this.failedCount += 1;
      this.publish(NOTIFICATION_EVENTS.NotificationFailed, { notificationId: record.notificationId });
    }
  }

  /** Test/diagnostic hook: resolves once every currently-tracked background
   * delivery has settled — deterministic testing of the fire-and-forget
   * delivery path without polling. */
  async flushDeliveries(): Promise<void> {
    const pending = this.pendingDeliveries;
    this.pendingDeliveries = [];
    await Promise.all(pending);
  }

  // ---- Acknowledgement (§12) ----

  acknowledge(notificationId: string, recipientId: string, response?: string): Acknowledgement {
    const record = this.records.get(notificationId);
    if (!record) throw new NotificationNotFoundError(notificationId);
    const acknowledgement: Acknowledgement = { notificationId, recipientId, timestamp: this.now().toISOString(), response };
    this.acknowledgements.record(acknowledgement);
    this.setRecord({ ...record, status: 'acknowledged' });
    this.publish(NOTIFICATION_EVENTS.NotificationAcknowledged, { notificationId, recipientId });
    return acknowledgement;
  }

  // ---- Escalation (§11) — real, tick-based, not setTimeout-driven ----

  checkEscalations(at?: Date): void {
    const now = at ?? this.now();
    for (const record of this.history()) {
      if (record.requiresAcknowledgement && this.acknowledgements.isAcknowledged(record.notificationId)) continue;
      const definition = this.registry.get(record.notificationTypeId);
      const due = findDueEscalationStep(record, definition?.escalationPolicy, now);
      if (!due) continue;

      this.escalationCount += 1;
      const updated: NotificationRecord = { ...record, status: 'escalated', escalationLevel: due.stepIndex + 1 };
      this.setRecord(updated);
      this.publish(NOTIFICATION_EVENTS.NotificationEscalated, {
        notificationId: record.notificationId,
        action: due.step.action,
        stepIndex: due.stepIndex,
      });

      this.pendingDeliveries.push(this.dispatchEscalation(updated, due.step).catch(() => {}));
    }
  }

  private async dispatchEscalation(record: NotificationRecord, step: { action: string; alternateChannels?: ChannelType[]; recipientId?: string }): Promise<void> {
    if (step.action === 'retry-same-channel') {
      const lastChannel = record.deliveries[record.deliveries.length - 1]?.channel;
      if (lastChannel) await this.deliver(record, [lastChannel]);
    } else if (step.action === 'alternate-channel' && step.alternateChannels) {
      await this.deliver(record, step.alternateChannels);
    } else if ((step.action === 'notify-operator' || step.action === 'notify-administrator') && step.recipientId) {
      const recipient = this.recipients.get(step.recipientId);
      if (recipient) await this.deliver(record, recipient.channels);
    } else if (step.action === 'broadcast-critical') {
      await this.deliver(record, [...this.channels.keys()]);
    }
  }

  // ---- Digests (§14 — real integration with ISOA) ----

  async registerDigest(digest: Omit<DigestDefinition, 'scheduleId'>, trigger: TimeTrigger): Promise<DigestDefinition> {
    let full: DigestDefinition = { ...digest };
    this.digests.set(digest.digestId, full);

    if (this.schedulingAuthority) {
      const schedule = await this.schedulingAuthority.registerSchedule(
        { name: `digest-${digest.digestId}`, ownerAuthority: SELF_AUTHORITY, scheduleType: 'time', trigger },
        {
          execute: async () => {
            this.generateDigest(digest.digestId);
            return { success: true };
          },
        },
      );
      full = { ...full, scheduleId: schedule.scheduleId };
      this.digests.set(digest.digestId, full);
    }
    return full;
  }

  generateDigest(digestId: string, periodStart?: Date, periodEnd?: Date): DigestReport {
    const digest = this.digests.get(digestId);
    if (!digest) throw new DigestNotFoundError(digestId);

    const end = periodEnd ?? this.now();
    const start = periodStart ?? new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const report = computeDigestReport(digest, this.history(), start, end);
    this.publish(NOTIFICATION_EVENTS.DigestGenerated, { digestId, notificationCount: report.notificationCount });

    const digestNotification: NotificationRecord = {
      notificationId: randomUUID(),
      notificationTypeId: `digest:${digestId}`,
      category: 'diagnostics',
      severity: 'info',
      priority: 'informational',
      title: `Digest: ${digest.name}`,
      message: `${report.notificationCount} notification(s) between ${report.periodStart} and ${report.periodEnd}.`,
      requestingAuthority: SELF_AUTHORITY,
      status: 'queued',
      requiresAcknowledgement: false,
      createdAt: this.now().toISOString(),
      deliveries: [],
      escalationLevel: 0,
    };
    this.setRecord(digestNotification);
    this.pendingDeliveries.push(this.deliver(digestNotification, digest.channels).catch(() => {}));

    return report;
  }

  // ---- Explainability, metrics ----

  explain(notificationId: string): { record: NotificationRecord; acknowledgements: Acknowledgement[]; auditHistory: NotificationRecord[] } {
    const record = this.records.get(notificationId);
    if (!record) throw new NotificationNotFoundError(notificationId);
    return {
      record,
      acknowledgements: this.acknowledgements.forNotification(notificationId),
      auditHistory: this.audit.history(notificationId),
    };
  }

  getMetrics(): NotificationMetrics {
    return {
      generatedCount: this.generatedCount,
      deliveredCount: this.deliveredCount,
      failedCount: this.failedCount,
      escalationCount: this.escalationCount,
      suppressedCount: this.suppressedCount,
      averageDeliveryLatencyMs: average(this.deliveryDurations),
      averageAcknowledgementLatencyMs: this.intelligence.averageAcknowledgementLatency(),
    };
  }

  history(): NotificationRecord[] {
    return [...this.records.values()];
  }

  // ---- Internal ----

  private transition(record: NotificationRecord, status: NotificationInstanceStatus): NotificationRecord {
    const updated = { ...record, status };
    this.setRecord(updated);
    return updated;
  }

  private setRecord(record: NotificationRecord): void {
    this.records.set(record.notificationId, record);
    this.audit.record(record);
  }

  private publish(name: (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS], payload: unknown): void {
    this.events.publish(name, payload);
    this.logOnly(name, payload);
  }

  private logOnly(operation: string, payload: unknown): void {
    if (!this.observability) return;
    try {
      this.observability.log({
        severity: operation === NOTIFICATION_EVENTS.NotificationFailed ? 'warning' : 'information',
        category: LOG_CATEGORY,
        authority: SELF_AUTHORITY,
        operation,
        message: operation,
        context: payload as Record<string, unknown>,
      });
    } catch {
      // Observability is a diagnostic concern, never a functional dependency.
    }
  }
}
