import { randomUUID } from 'node:crypto';
import type { EventEnvelope, Subscription } from './types.js';

/** Consecutive delivery failures before a subscription is marked dead (§16). */
export const DEAD_SUBSCRIBER_THRESHOLD = 3;

/**
 * §11 — Subscription Management. Supports both specific-event and whole-category
 * subscriptions, filtered subscriptions, and tracks per-subscription failure
 * history for dead-subscriber detection.
 */
export class SubscriptionRegistry {
  private subscriptions = new Map<string, Subscription>();
  private sequenceCounter = 0;

  add(
    selector: string,
    selectorKind: 'event' | 'category',
    handler: (envelope: EventEnvelope) => void | Promise<void>,
    subscriberAuthority: string,
    filter?: (envelope: EventEnvelope) => boolean,
  ): Subscription {
    this.sequenceCounter += 1;
    const subscription: Subscription = {
      subscriptionId: randomUUID(),
      selector,
      selectorKind,
      subscriberAuthority,
      handler,
      filter,
      consecutiveFailures: 0,
      dead: false,
      registeredAt: new Date().toISOString(),
      sequence: this.sequenceCounter,
    };
    this.subscriptions.set(subscription.subscriptionId, subscription);
    return subscription;
  }

  remove(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  get(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /** Matching subscriptions for an event, in deterministic (registration) order:
   * exact event-name subscriptions first, then whole-category subscriptions. */
  matchesFor(eventName: string, category: string): Subscription[] {
    const eventMatches = [...this.subscriptions.values()]
      .filter((s) => !s.dead && s.selectorKind === 'event' && s.selector === eventName)
      .sort((a, b) => a.sequence - b.sequence);
    const categoryMatches = [...this.subscriptions.values()]
      .filter((s) => !s.dead && s.selectorKind === 'category' && s.selector === category)
      .sort((a, b) => a.sequence - b.sequence);
    return [...eventMatches, ...categoryMatches];
  }

  recordSuccess(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) subscription.consecutiveFailures = 0;
  }

  /** Returns true if this failure just crossed the dead-subscriber threshold. */
  recordFailure(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;
    subscription.consecutiveFailures += 1;
    if (subscription.consecutiveFailures >= DEAD_SUBSCRIBER_THRESHOLD && !subscription.dead) {
      subscription.dead = true;
      return true;
    }
    return false;
  }

  all(): Subscription[] {
    return [...this.subscriptions.values()];
  }

  deadCount(): number {
    return [...this.subscriptions.values()].filter((s) => s.dead).length;
  }
}
