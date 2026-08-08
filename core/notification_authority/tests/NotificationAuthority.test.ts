import { describe, expect, it } from 'vitest';
import { NotificationAuthority } from '../src/NotificationAuthority.js';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import { SchedulingAuthority } from '../../scheduling_authority/src/index.js';
import { MemoryNotificationChannel } from '../src/channels.js';
import { NotificationNotFoundError } from '../src/errors.js';
import type { NotificationDefinition } from '../src/types.js';

function makeDefinition(overrides: Partial<NotificationDefinition> = {}): NotificationDefinition {
  return {
    notificationTypeId: 'hardware-fault',
    name: 'Hardware Fault',
    category: 'hardware',
    severity: 'error',
    defaultPriority: 'high',
    defaultChannels: ['console'],
    requiresAcknowledgement: false,
    ...overrides,
  };
}

describe('NotificationAuthority (Law 1/Law 2/Law 6 — the sole notification authority)', () => {
  it('requestNotification() returns immediately in "queued" status — Law 6 "Non-Blocking"', () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition());
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'GPU overheating', message: 'x', requestingAuthority: 'IHIS' });
    expect(record.status).toBe('queued');
  });

  it('after flushDeliveries(), a real delivery has completed and status reflects it', async () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition());
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.flushDeliveries();
    const updated = inca.history().find((r) => r.notificationId === record.notificationId);
    expect(updated?.status).toBe('delivered');
    expect(updated?.deliveries).toHaveLength(1);
  });

  it('a category-suppressed notification never reaches delivery', async () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition({ suppressionRules: { categorySuppressed: true } }));
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    expect(record.status).toBe('suppressed');
    await inca.flushDeliveries();
    const updated = inca.history().find((r) => r.notificationId === record.notificationId);
    expect(updated?.deliveries).toHaveLength(0);
  });

  it('duplicate suppression prevents a repeat within the configured window', () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition({ suppressionRules: { duplicateWindowMs: 60_000 } }));
    const first = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    const second = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    expect(first.status).toBe('queued');
    expect(second.status).toBe('suppressed');
  });

  it('delivering to multiple real channels populates a delivery attempt per channel', async () => {
    const inca = new NotificationAuthority();
    const memory = new MemoryNotificationChannel();
    inca.registerChannel(memory);
    inca.registerNotificationType(makeDefinition({ defaultChannels: ['console', 'memory'] }));
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.flushDeliveries();
    const updated = inca.history().find((r) => r.notificationId === record.notificationId)!;
    expect(updated.deliveries.map((d) => d.channel).sort()).toEqual(['console', 'memory']);
    expect(memory.all()).toHaveLength(1);
  });

  it('requesting an unregistered channel produces a real, recorded failure — not a crash', async () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition({ defaultChannels: ['pagerduty'] }));
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.flushDeliveries();
    const updated = inca.history().find((r) => r.notificationId === record.notificationId)!;
    expect(updated.status).toBe('failed');
    expect(updated.deliveries[0].result.message).toMatch(/unregistered/i);
  });

  // ---- Acknowledgement ----

  it('acknowledge() records an immutable acknowledgement and updates status', () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition({ requiresAcknowledgement: true }));
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    inca.acknowledge(record.notificationId, 'operator-1', 'seen it');
    expect(inca.history().find((r) => r.notificationId === record.notificationId)?.status).toBe('acknowledged');
    expect(inca.acknowledgements.isAcknowledged(record.notificationId)).toBe(true);
  });

  it('acknowledge() throws for an unknown notification', () => {
    const inca = new NotificationAuthority();
    expect(() => inca.acknowledge('nonexistent', 'operator-1')).toThrow(NotificationNotFoundError);
  });

  // ---- Escalation ----

  it('checkEscalations() dispatches notify-operator to the recipient\'s own channels once the step is due', async () => {
    const clock = { current: new Date('2026-08-08T12:00:00.000Z') };
    const inca = new NotificationAuthority({ now: () => clock.current });
    const memory = new MemoryNotificationChannel();
    inca.registerChannel(memory);
    inca.registerRecipient({ recipientId: 'operator-1', name: 'Operator', channels: ['memory'] });
    inca.registerNotificationType(
      makeDefinition({
        requiresAcknowledgement: true,
        escalationPolicy: { steps: [{ afterMs: 5 * 60 * 1000, action: 'notify-operator', recipientId: 'operator-1' }] },
      }),
    );
    inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.flushDeliveries();

    clock.current = new Date('2026-08-08T12:06:00.000Z');
    inca.checkEscalations();
    await inca.flushDeliveries();

    expect(memory.all()).toHaveLength(1);
    expect(inca.getMetrics().escalationCount).toBe(1);
  });

  it('checkEscalations() never escalates an already-acknowledged notification', async () => {
    const clock = { current: new Date('2026-08-08T12:00:00.000Z') };
    const inca = new NotificationAuthority({ now: () => clock.current });
    inca.registerNotificationType(
      makeDefinition({
        requiresAcknowledgement: true,
        escalationPolicy: { steps: [{ afterMs: 1000, action: 'notify-operator', recipientId: 'operator-1' }] },
      }),
    );
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    inca.acknowledge(record.notificationId, 'operator-1');
    clock.current = new Date('2026-08-08T13:00:00.000Z');
    inca.checkEscalations();
    expect(inca.getMetrics().escalationCount).toBe(0);
  });

  // ---- Digests, real ISOA integration (§14) ----

  it('registerDigest() with a real SchedulingAuthority registers a real ISOA schedule; triggering it generates and delivers a digest', async () => {
    const clock = { current: new Date('2026-08-08T00:00:00.000Z') };
    const isoa = new SchedulingAuthority({ now: () => clock.current });
    const inca = new NotificationAuthority({ schedulingAuthority: isoa, now: () => clock.current });
    const memory = new MemoryNotificationChannel();
    inca.registerChannel(memory);
    inca.registerNotificationType(makeDefinition());
    inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.flushDeliveries();

    const digest = await inca.registerDigest(
      { digestId: 'daily-hardware', name: 'Daily Hardware', categories: ['hardware'], channels: ['memory'] },
      { kind: 'time', intervalMs: 60_000 },
    );
    expect(digest.scheduleId).toBeDefined();

    clock.current = new Date('2026-08-08T00:01:00.000Z');
    await isoa.tick(clock.current);
    await inca.flushDeliveries();

    const digestDeliveries = memory.all().filter((r) => r.notificationTypeId === 'digest:daily-hardware');
    expect(digestDeliveries).toHaveLength(1);
  });

  it('generateDigest() throws for an unregistered digest', () => {
    const inca = new NotificationAuthority();
    expect(() => inca.generateDigest('nonexistent')).toThrow();
  });

  it('maintenance suppression consults a real ISOA Institutional Time Graph', () => {
    const clock = { current: new Date('2026-08-08T12:00:00.000Z') };
    const isoa = new SchedulingAuthority({ now: () => clock.current });
    isoa.graph.registerWindow({
      windowId: 'maint-1',
      type: 'maintenance',
      label: 'Nightly maintenance',
      startsAt: '2026-08-08T00:00:00.000Z',
      endsAt: '2026-08-08T23:59:59.000Z',
      source: 'Operator',
      blocksExecution: true,
    });
    const inca = new NotificationAuthority({ schedulingAuthority: isoa, now: () => clock.current });
    inca.registerNotificationType(makeDefinition({ suppressionRules: { respectMaintenanceWindows: true } }));
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    expect(record.status).toBe('suppressed');
  });

  // ---- Explainability, metrics ----

  it('explain() surfaces the record, acknowledgements, and audit history together', () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition());
    const record = inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    const view = inca.explain(record.notificationId);
    expect(view.record.notificationId).toBe(record.notificationId);
    expect(view.auditHistory.length).toBeGreaterThan(0);
  });

  it('getMetrics() tracks generated, delivered, and suppressed counts', async () => {
    const inca = new NotificationAuthority();
    inca.registerNotificationType(makeDefinition());
    inca.registerNotificationType(makeDefinition({ notificationTypeId: 'suppressed-type', suppressionRules: { categorySuppressed: true } }));
    inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    inca.requestNotification({ notificationTypeId: 'suppressed-type', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.flushDeliveries();

    const metrics = inca.getMetrics();
    expect(metrics.generatedCount).toBe(2);
    expect(metrics.deliveredCount).toBe(1);
    expect(metrics.suppressedCount).toBe(1);
  });

  // ---- Real IEB / IOLA integration ----

  it('wires into a real InstitutionalEventBus under the reserved "notification" category', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const inca = new NotificationAuthority({ eventBus: bus });
    inca.registerNotificationType(makeDefinition());
    const seen: unknown[] = [];
    bus.subscribeToEvent('NotificationGenerated', (envelope) => { seen.push(envelope.payload); }, { subscriberAuthority: 'Test' });

    inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    await inca.events.flushMirror();

    expect(seen).toHaveLength(1);
    expect(bus.getEventDefinition('NotificationGenerated')?.category).toBe('notification');
  });

  it('wires into a real ObservabilityAuthority: notification events are logged under category "notification"', () => {
    const iola = new ObservabilityAuthority();
    const inca = new NotificationAuthority({ observabilityAuthority: iola });
    inca.registerNotificationType(makeDefinition());
    inca.requestNotification({ notificationTypeId: 'hardware-fault', title: 'x', message: 'y', requestingAuthority: 'IHIS' });
    const logged = iola.search((record) => record.category === 'notification' && record.operation === 'NotificationGenerated');
    expect(logged).toHaveLength(1);
  });
});
