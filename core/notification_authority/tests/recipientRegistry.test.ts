import { describe, expect, it } from 'vitest';
import { RecipientRegistry } from '../src/recipientRegistry.js';
import { RecipientNotFoundError } from '../src/errors.js';

describe('RecipientRegistry (routing "who should know")', () => {
  it('registers and retrieves a recipient', () => {
    const registry = new RecipientRegistry();
    registry.register({ recipientId: 'r1', name: 'Operator', channels: ['console'] });
    expect(registry.get('r1')?.name).toBe('Operator');
  });

  it('require() throws for an unregistered recipient', () => {
    const registry = new RecipientRegistry();
    expect(() => registry.require('missing')).toThrow(RecipientNotFoundError);
  });

  it('subscribersFor() defaults to all categories when subscribedCategories is unset', () => {
    const registry = new RecipientRegistry();
    registry.register({ recipientId: 'r1', name: 'Operator', channels: ['console'] });
    expect(registry.subscribersFor('hardware', 'normal').map((r) => r.recipientId)).toEqual(['r1']);
  });

  it('subscribersFor() filters by subscribedCategories when set', () => {
    const registry = new RecipientRegistry();
    registry.register({ recipientId: 'r1', name: 'Hardware Watcher', channels: ['console'], subscribedCategories: ['hardware'] });
    expect(registry.subscribersFor('hardware', 'normal').map((r) => r.recipientId)).toEqual(['r1']);
    expect(registry.subscribersFor('mining', 'normal')).toHaveLength(0);
  });

  it('subscribersFor() filters by minimumPriority', () => {
    const registry = new RecipientRegistry();
    registry.register({ recipientId: 'r1', name: 'Critical Only', channels: ['console'], minimumPriority: 'critical' });
    expect(registry.subscribersFor('hardware', 'normal')).toHaveLength(0);
    expect(registry.subscribersFor('hardware', 'critical').map((r) => r.recipientId)).toEqual(['r1']);
  });

  it('remove() deregisters a recipient', () => {
    const registry = new RecipientRegistry();
    registry.register({ recipientId: 'r1', name: 'x', channels: [] });
    registry.remove('r1');
    expect(registry.get('r1')).toBeUndefined();
  });
});
