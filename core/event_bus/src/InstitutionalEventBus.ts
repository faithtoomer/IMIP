import { randomUUID } from 'node:crypto';
import { EventRegistry } from './registry.js';
import { SubscriptionRegistry } from './subscriptions.js';
import { PriorityEventQueue } from './queue.js';
import { NoopEventPersistence, type EventPersistence } from './persistence.js';
import {
  CircularPublicationError,
  MissingTargetAuthoritiesError,
  PayloadValidationError,
  PublisherOwnershipViolationError,
  SubscriberNotAllowedError,
} from './errors.js';
import type {
  BusMetrics,
  EventAuditRecord,
  EventCategory,
  EventDefinition,
  EventEnvelope,
  EventHistoryFilter,
  PublishOptions,
  SubscriberDeliveryResult,
  SubscribeOptions,
  Subscription,
} from './types.js';

export interface InstitutionalEventBusOptions {
  persistence?: EventPersistence;
  maxQueueSize?: number;
}

const DURATION_WINDOW = 1000;

/**
 * IEB — the Institutional Event Bus (PHASE-05). The sole communication backbone
 * for IMIP (Law 1): every authority publishes and subscribes through this class,
 * never through an ad-hoc mechanism or another authority's private emitter.
 *
 * Pipeline (§5/§6): definition lookup → ownership + payload validation →
 * envelope creation → (sync: immediate dispatch | async: priority queue) →
 * subscriber fan-out (isolated failures, §16) → audit + persistence.
 */
export class InstitutionalEventBus {
  readonly registry = new EventRegistry();
  readonly subscriptions = new SubscriptionRegistry();

  private readonly queue: PriorityEventQueue;
  private readonly persistence: EventPersistence;
  private readonly dispatchStack: string[] = [];
  private readonly pendingAsyncResults = new Map<string, (audit: EventAuditRecord) => void>();
  private readonly recentDispatchDurations: number[] = [];
  private draining = false;

  private totalPublished = 0;
  private totalDispatched = 0;
  private totalFailedDeliveries = 0;

  constructor(options: InstitutionalEventBusOptions = {}) {
    this.queue = new PriorityEventQueue(options.maxQueueSize ?? 10_000);
    this.persistence = options.persistence ?? new NoopEventPersistence();
  }

  /** §7 — the only way an event type comes into existence. */
  registerEventType(definition: EventDefinition): void {
    this.registry.register(definition);
  }

  registerEventTypes(definitions: EventDefinition[]): void {
    this.registry.registerAll(definitions);
  }

  /** §11 — subscribe to one specific, already-registered event type. */
  subscribeToEvent(
    eventName: string,
    handler: (envelope: EventEnvelope) => void | Promise<void>,
    options: SubscribeOptions,
  ): () => void {
    const definition = this.registry.require(eventName);
    if (definition.allowedSubscribers && !definition.allowedSubscribers.includes(options.subscriberAuthority)) {
      throw new SubscriberNotAllowedError(eventName, options.subscriberAuthority);
    }
    const subscription = this.subscriptions.add(eventName, 'event', handler, options.subscriberAuthority, options.filter);
    return () => {
      this.subscriptions.remove(subscription.subscriptionId);
    };
  }

  /** §11 — subscribe to every event published under a category, present and future. */
  subscribeToCategory(
    category: EventCategory,
    handler: (envelope: EventEnvelope) => void | Promise<void>,
    options: SubscribeOptions,
  ): () => void {
    const subscription = this.subscriptions.add(category, 'category', handler, options.subscriberAuthority, options.filter);
    return () => {
      this.subscriptions.remove(subscription.subscriptionId);
    };
  }

  /**
   * §6 — publish. Validates ownership and payload, builds the envelope, then
   * either dispatches immediately (sync) or enqueues by priority (async).
   * Resolves once this specific event has finished dispatching, in both modes.
   */
  async publish(eventName: string, publisher: string, payload: unknown, options: PublishOptions = {}): Promise<EventAuditRecord> {
    const definition = this.registry.require(eventName);

    if (definition.publisherAuthority !== publisher) {
      throw new PublisherOwnershipViolationError(eventName, publisher, definition.publisherAuthority);
    }

    if (definition.payloadValidator) {
      const errors = definition.payloadValidator(payload);
      if (errors && errors.length > 0) throw new PayloadValidationError(eventName, errors);
    }

    if (definition.targeting === 'directed' && (!options.targetAuthorities || options.targetAuthorities.length === 0)) {
      throw new MissingTargetAuthoritiesError(eventName);
    }

    const eventId = randomUUID();
    const envelope: EventEnvelope = {
      eventId,
      eventType: eventName,
      eventVersion: definition.version,
      timestamp: new Date().toISOString(),
      publisher,
      correlationId: options.correlationId ?? eventId,
      causationId: options.causationId,
      severity: options.severity ?? 'info',
      priority: definition.priority,
      payload,
      processingStatus: 'pending',
      traceId: options.traceId,
      parentEventId: options.parentEventId,
      targetAuthorities: options.targetAuthorities,
    };

    this.totalPublished += 1;

    if (definition.deliveryMode === 'sync') {
      if (this.dispatchStack.includes(eventName)) {
        throw new CircularPublicationError(eventName, this.dispatchStack);
      }
      this.dispatchStack.push(eventName);
      try {
        return await this.dispatchNow(envelope, definition);
      } finally {
        this.dispatchStack.pop();
      }
    }

    this.queue.enqueue(envelope);
    const resultPromise = new Promise<EventAuditRecord>((resolve) => {
      this.pendingAsyncResults.set(envelope.eventId, resolve);
    });
    this.scheduleDrain();
    return resultPromise;
  }

  // ---- Read API (§18) ----

  getEventDefinition(name: string): EventDefinition | undefined {
    return this.registry.get(name);
  }

  getEventDefinitions(category?: EventCategory): EventDefinition[] {
    return category ? this.registry.byCategory(category) : this.registry.all();
  }

  getSubscriptions(filter: { subscriberAuthority?: string; selector?: string } = {}): Subscription[] {
    return this.subscriptions
      .all()
      .filter((s) => !filter.subscriberAuthority || s.subscriberAuthority === filter.subscriberAuthority)
      .filter((s) => !filter.selector || s.selector === filter.selector);
  }

  getEventHistory(filter?: EventHistoryFilter): EventEnvelope[] {
    return this.persistence.history(filter);
  }

  getAuditRecord(eventId: string): EventAuditRecord | undefined {
    return this.persistence.getAudit(eventId);
  }

  /** §19 — real-time bus metrics, exposed as a read surface for a future
   * Telemetry Authority to consume (not yet implemented). */
  getMetrics(): BusMetrics {
    const averageDispatchMs =
      this.recentDispatchDurations.length === 0
        ? 0
        : this.recentDispatchDurations.reduce((sum, d) => sum + d, 0) / this.recentDispatchDurations.length;

    return {
      totalPublished: this.totalPublished,
      totalDispatched: this.totalDispatched,
      totalFailedDeliveries: this.totalFailedDeliveries,
      queueDepth: this.queue.size,
      averageDispatchMs,
      deadSubscriptions: this.subscriptions.deadCount(),
    };
  }

  // ---- Internal dispatch ----

  /** Defers the drain loop's start to a microtask rather than starting it inline.
   * This lets a same-tick burst of publish() calls all finish enqueueing — and
   * therefore be correctly priority-ordered relative to each other — before
   * dispatch of any of them begins. Starting inline would let the very first
   * enqueued item begin dispatching before the others even arrive, defeating
   * priority reordering for concurrently-issued publishes (§13). */
  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => {
      void this.drainQueue();
    });
  }

  private async drainQueue(): Promise<void> {
    let next = this.queue.dequeue();
    while (next) {
      const definition = this.registry.require(next.eventType);
      const audit = await this.dispatchNow(next, definition);
      const resolve = this.pendingAsyncResults.get(next.eventId);
      if (resolve) {
        resolve(audit);
        this.pendingAsyncResults.delete(next.eventId);
      }
      next = this.queue.dequeue();
    }
    this.draining = false;
  }

  private async dispatchNow(envelope: EventEnvelope, definition: EventDefinition): Promise<EventAuditRecord> {
    const start = performance.now();
    envelope.processingStatus = 'dispatched';

    const matches = this.subscriptions
      .matchesFor(envelope.eventType, definition.category)
      .filter((sub) => definition.targeting === 'broadcast' || (envelope.targetAuthorities?.includes(sub.subscriberAuthority) ?? false))
      .filter((sub) => !sub.filter || sub.filter(envelope));

    const settled = await Promise.allSettled(matches.map((sub) => this.invokeSubscriber(sub, envelope)));
    const subscriberResults: SubscriberDeliveryResult[] = settled.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            subscriptionId: matches[index].subscriptionId,
            subscriberAuthority: matches[index].subscriberAuthority,
            success: false,
            durationMs: 0,
            error: String((result as PromiseRejectedResult).reason),
          },
    );

    const overallDurationMs = performance.now() - start;
    const failureCount = subscriberResults.filter((r) => !r.success).length;
    const allFailed = matches.length > 0 && failureCount === matches.length;

    envelope.processingStatus = allFailed ? 'failed' : 'completed';
    envelope.processingDurationMs = overallDurationMs;

    const outcome: EventAuditRecord['outcome'] =
      matches.length === 0 ? 'no-subscribers' : allFailed ? 'failed' : failureCount > 0 ? 'partial' : 'completed';

    const audit: EventAuditRecord = {
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      publisher: envelope.publisher,
      timestamp: envelope.timestamp,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      subscriberResults,
      overallDurationMs,
      outcome,
    };

    this.totalDispatched += 1;
    this.totalFailedDeliveries += failureCount;
    this.recentDispatchDurations.push(overallDurationMs);
    if (this.recentDispatchDurations.length > DURATION_WINDOW) this.recentDispatchDurations.shift();

    this.persistence.record(envelope, audit);
    return audit;
  }

  /** §16 — one subscriber's failure never blocks or fails delivery to the rest;
   * three consecutive failures marks the subscription dead (§16 dead-subscriber
   * detection), removing it from future matches without unregistering it (it
   * remains visible via getSubscriptions() for diagnosis). */
  private async invokeSubscriber(subscription: Subscription, envelope: EventEnvelope): Promise<SubscriberDeliveryResult> {
    const start = performance.now();
    try {
      await subscription.handler(envelope);
      this.subscriptions.recordSuccess(subscription.subscriptionId);
      return {
        subscriptionId: subscription.subscriptionId,
        subscriberAuthority: subscription.subscriberAuthority,
        success: true,
        durationMs: performance.now() - start,
      };
    } catch (error) {
      this.subscriptions.recordFailure(subscription.subscriptionId);
      return {
        subscriptionId: subscription.subscriptionId,
        subscriberAuthority: subscription.subscriberAuthority,
        success: false,
        durationMs: performance.now() - start,
        error: (error as Error).message,
      };
    }
  }
}
