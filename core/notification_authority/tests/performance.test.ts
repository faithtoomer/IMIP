import { describe, expect, it, vi } from 'vitest';
import { NotificationAuthority } from '../src/NotificationAuthority.js';
import type { NotificationDefinition } from '../src/types.js';

const DEFINITION: NotificationDefinition = {
  notificationTypeId: 'perf-test',
  name: 'Perf Test',
  category: 'diagnostics',
  severity: 'info',
  defaultPriority: 'normal',
  defaultChannels: ['console'],
  requiresAcknowledgement: false,
};

describe('performance smoke tests', () => {
  it('requests and delivers 300 notifications well under 1s', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const inca = new NotificationAuthority();
    inca.registerNotificationType(DEFINITION);

    const start = performance.now();
    for (let i = 0; i < 300; i += 1) {
      inca.requestNotification({ notificationTypeId: 'perf-test', title: `n${i}`, message: 'x', requestingAuthority: 'X' });
    }
    await inca.flushDeliveries();

    expect(performance.now() - start).toBeLessThan(1000);
    expect(inca.getMetrics().deliveredCount).toBe(300);
    logSpy.mockRestore();
  });
});
