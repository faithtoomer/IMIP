import { describe, expect, it } from 'vitest';
import { DEAD_SUBSCRIBER_THRESHOLD, SubscriptionRegistry } from '../src/subscriptions.js';

describe('SubscriptionRegistry (§11)', () => {
  it('add() registers a subscription and matchesFor() finds it by exact event name', () => {
    const registry = new SubscriptionRegistry();
    registry.add('MyEvent', 'event', () => {}, 'Authority A');
    expect(registry.matchesFor('MyEvent', 'diagnostics')).toHaveLength(1);
    expect(registry.matchesFor('OtherEvent', 'diagnostics')).toHaveLength(0);
  });

  it('matchesFor() also finds category-wide subscriptions', () => {
    const registry = new SubscriptionRegistry();
    registry.add('hardware', 'category', () => {}, 'Authority A');
    expect(registry.matchesFor('HardwareDiscovered', 'hardware')).toHaveLength(1);
    expect(registry.matchesFor('AnythingElse', 'configuration')).toHaveLength(0);
  });

  it('event-name matches are ordered before category matches, both in registration order', () => {
    const registry = new SubscriptionRegistry();
    registry.add('diagnostics', 'category', () => {}, 'Category Subscriber');
    registry.add('MyEvent', 'event', () => {}, 'Specific Subscriber A');
    registry.add('MyEvent', 'event', () => {}, 'Specific Subscriber B');

    const matches = registry.matchesFor('MyEvent', 'diagnostics');
    expect(matches.map((m) => m.subscriberAuthority)).toEqual(['Specific Subscriber A', 'Specific Subscriber B', 'Category Subscriber']);
  });

  it('remove() unsubscribes', () => {
    const registry = new SubscriptionRegistry();
    const sub = registry.add('MyEvent', 'event', () => {}, 'Authority A');
    expect(registry.remove(sub.subscriptionId)).toBe(true);
    expect(registry.matchesFor('MyEvent', 'diagnostics')).toHaveLength(0);
  });

  it('marks a subscription dead after the consecutive-failure threshold and excludes it from matches', () => {
    const registry = new SubscriptionRegistry();
    const sub = registry.add('MyEvent', 'event', () => {}, 'Authority A');

    for (let i = 0; i < DEAD_SUBSCRIBER_THRESHOLD - 1; i += 1) {
      const becameDead = registry.recordFailure(sub.subscriptionId);
      expect(becameDead).toBe(false);
    }
    expect(registry.matchesFor('MyEvent', 'diagnostics')).toHaveLength(1); // not dead yet

    const becameDeadNow = registry.recordFailure(sub.subscriptionId);
    expect(becameDeadNow).toBe(true);
    expect(registry.matchesFor('MyEvent', 'diagnostics')).toHaveLength(0); // now excluded
    expect(registry.get(sub.subscriptionId)?.dead).toBe(true);
    expect(registry.deadCount()).toBe(1);
  });

  it('recordSuccess() resets the consecutive-failure counter', () => {
    const registry = new SubscriptionRegistry();
    const sub = registry.add('MyEvent', 'event', () => {}, 'Authority A');
    registry.recordFailure(sub.subscriptionId);
    registry.recordFailure(sub.subscriptionId);
    registry.recordSuccess(sub.subscriptionId);
    expect(registry.get(sub.subscriptionId)?.consecutiveFailures).toBe(0);
  });
});
