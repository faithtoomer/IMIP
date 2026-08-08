import { describe, expect, it } from 'vitest';
import { NotificationRegistry } from '../src/registry.js';
import { DuplicateNotificationTypeError, UnregisteredNotificationTypeError } from '../src/errors.js';
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

describe('NotificationRegistry (§8)', () => {
  it('registers and retrieves a notification type', () => {
    const registry = new NotificationRegistry();
    registry.register(makeDefinition());
    expect(registry.get('hardware-fault')?.name).toBe('Hardware Fault');
  });

  it('rejects a duplicate notificationTypeId', () => {
    const registry = new NotificationRegistry();
    registry.register(makeDefinition());
    expect(() => registry.register(makeDefinition())).toThrow(DuplicateNotificationTypeError);
  });

  it('require() throws for an unregistered type', () => {
    const registry = new NotificationRegistry();
    expect(() => registry.require('missing')).toThrow(UnregisteredNotificationTypeError);
  });

  it('byTriggerEvent() finds definitions matching an IEB event name', () => {
    const registry = new NotificationRegistry();
    registry.register(makeDefinition({ notificationTypeId: 'a', triggerEvent: 'HardwareFaultDetected' }));
    registry.register(makeDefinition({ notificationTypeId: 'b', triggerEvent: 'OtherEvent' }));
    expect(registry.byTriggerEvent('HardwareFaultDetected')).toHaveLength(1);
  });
});
