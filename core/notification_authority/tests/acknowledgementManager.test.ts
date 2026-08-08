import { describe, expect, it } from 'vitest';
import { AcknowledgementManager } from '../src/acknowledgementManager.js';

describe('AcknowledgementManager (§12 — immutable acknowledgement history)', () => {
  it('records and lists acknowledgements', () => {
    const manager = new AcknowledgementManager();
    manager.record({ notificationId: 'n1', recipientId: 'r1', timestamp: new Date().toISOString() });
    expect(manager.all()).toHaveLength(1);
  });

  it('forNotification() filters by notificationId', () => {
    const manager = new AcknowledgementManager();
    manager.record({ notificationId: 'n1', recipientId: 'r1', timestamp: new Date().toISOString() });
    manager.record({ notificationId: 'n2', recipientId: 'r1', timestamp: new Date().toISOString() });
    expect(manager.forNotification('n1')).toHaveLength(1);
  });

  it('isAcknowledged() reflects whether any acknowledgement exists', () => {
    const manager = new AcknowledgementManager();
    expect(manager.isAcknowledged('n1')).toBe(false);
    manager.record({ notificationId: 'n1', recipientId: 'r1', timestamp: new Date().toISOString() });
    expect(manager.isAcknowledged('n1')).toBe(true);
  });

  it('records are frozen — cannot be mutated after recording', () => {
    const manager = new AcknowledgementManager();
    manager.record({ notificationId: 'n1', recipientId: 'r1', timestamp: new Date().toISOString() });
    const [ack] = manager.all();
    expect(() => {
      (ack as { response?: string }).response = 'tampered';
    }).toThrow();
  });

  it('exposes no update or delete method (structural immutability)', () => {
    const manager = new AcknowledgementManager();
    expect((manager as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((manager as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});
