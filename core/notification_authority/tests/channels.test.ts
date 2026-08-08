import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  ConsoleNotificationChannel,
  MemoryNotificationChannel,
  LogNotificationChannel,
  WebhookNotificationChannel,
  DiscordNotificationChannel,
  EmailNotificationChannel,
} from '../src/channels.js';
import { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { NotificationRecord } from '../src/types.js';

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    notificationId: 'n1',
    notificationTypeId: 't1',
    category: 'hardware',
    severity: 'info',
    priority: 'normal',
    title: 'Test',
    message: 'hello',
    requestingAuthority: 'X',
    status: 'queued',
    requiresAcknowledgement: false,
    createdAt: new Date().toISOString(),
    deliveries: [],
    escalationLevel: 0,
    ...overrides,
  };
}

describe('Notification channels (§7)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ConsoleNotificationChannel delivers successfully and routes by severity', async () => {
    const channel = new ConsoleNotificationChannel();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await channel.deliver(makeRecord({ severity: 'critical' }));
    expect(result.success).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('MemoryNotificationChannel is bounded and queryable', async () => {
    const channel = new MemoryNotificationChannel(2);
    await channel.deliver(makeRecord({ notificationId: 'a' }));
    await channel.deliver(makeRecord({ notificationId: 'b' }));
    await channel.deliver(makeRecord({ notificationId: 'c' }));
    expect(channel.all().map((r) => r.notificationId)).toEqual(['b', 'c']);
  });

  it('LogNotificationChannel delivers a real entry through IOLA', async () => {
    const iola = new ObservabilityAuthority();
    iola.registerCategory('notification'); // not one of IOLA's pre-seeded categories
    iola.registerSchema({ category: 'notification', operation: 'notification-delivered', description: 'x' });
    const channel = new LogNotificationChannel(iola);
    const result = await channel.deliver(makeRecord());
    expect(result.success).toBe(true);
    expect(iola.search((r) => r.operation === 'notification-delivered')).toHaveLength(1);
  });

  it('WebhookNotificationChannel POSTs real JSON via global fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const channel = new WebhookNotificationChannel('https://example.test/hook');
    const result = await channel.deliver(makeRecord());

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/hook',
      expect.objectContaining({ method: 'POST', headers: { 'content-type': 'application/json' } }),
    );
  });

  it('WebhookNotificationChannel reports failure on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const channel = new WebhookNotificationChannel('https://example.test/hook');
    const result = await channel.deliver(makeRecord());
    expect(result.success).toBe(false);
    expect(result.message).toContain('500');
  });

  it('WebhookNotificationChannel reports failure on a network error, without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const channel = new WebhookNotificationChannel('https://example.test/hook');
    const result = await channel.deliver(makeRecord());
    expect(result.success).toBe(false);
    expect(result.message).toBe('network down');
  });

  it('DiscordNotificationChannel sends Discord\'s expected {content} payload shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const channel = new DiscordNotificationChannel('https://discord.example/webhook');
    await channel.deliver(makeRecord({ title: 'Alert', message: 'Something happened' }));

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.content).toContain('Alert');
    expect(body.content).toContain('Something happened');
  });

  it('EmailNotificationChannel delivers via a caller-supplied sender, with no built-in SMTP implementation', async () => {
    const sent: NotificationRecord[] = [];
    const channel = new EmailNotificationChannel(async (notification) => {
      sent.push(notification);
    });
    const result = await channel.deliver(makeRecord());
    expect(result.success).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('EmailNotificationChannel reports failure if the supplied sender throws', async () => {
    const channel = new EmailNotificationChannel(async () => {
      throw new Error('smtp rejected');
    });
    const result = await channel.deliver(makeRecord());
    expect(result.success).toBe(false);
    expect(result.message).toBe('smtp rejected');
  });
});
