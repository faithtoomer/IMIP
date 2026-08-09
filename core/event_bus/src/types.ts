export type EventCategory =
  | 'configuration'
  | 'capability'
  | 'plugin'
  | 'hardware'
  | 'runtime'
  | 'mining'
  | 'mining-adapter'
  | 'miner-process'
  | 'mining-statistics'
  | 'cpu-mining'
  | 'gpu-mining'
  | 'asic-mining'
  | 'scheduler'
  | 'workload'
  | 'benchmark'
  | 'arbitration'
  | 'certification'
  | 'power'
  | 'thermal'
  | 'health'
  | 'database'
  | 'storage'
  | 'security'
  | 'profitability'
  | 'decision'
  | 'ai'
  | 'dashboard'
  | 'notification'
  | 'diagnostics'
  | 'resilience'
  | 'version-governance';

/** §13 — priority affects delivery order, never ownership. */
export type EventPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

/** §10 — sync dispatches inline, in strict publish order, no reordering relative to
 * other events. async enqueues onto the priority queue and may be reordered relative
 * to other concurrently-pending async events by priority (Law 4 — documented, not
 * hidden: see InstitutionalEventBus.ts). */
export type DeliveryMode = 'sync' | 'async';

/** broadcast = every matching subscription receives it. directed = only subscriptions
 * whose subscriberAuthority is listed in the envelope's targetAuthorities. */
export type DeliveryTargeting = 'broadcast' | 'directed';

export type PayloadValidator = (payload: unknown) => string[] | null;

/** §7 — event registry entry. The registry is authoritative; publish() and
 * subscribe() both consult it before doing anything else. */
export interface EventDefinition {
  id: string;
  name: string;
  category: EventCategory;
  description: string;
  publisherAuthority: string;
  allowedSubscribers?: string[];
  priority: EventPriority;
  deliveryMode: DeliveryMode;
  targeting: DeliveryTargeting;
  payloadValidator?: PayloadValidator;
  version: string;
  deprecated?: boolean;
  versionDeprecated?: string;
}

/** §9 — every event's metadata envelope. */
export interface EventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  timestamp: string;
  publisher: string;
  correlationId: string;
  causationId?: string;
  severity: EventSeverity;
  priority: EventPriority;
  payload: TPayload;
  processingStatus: 'pending' | 'dispatched' | 'completed' | 'failed';
  traceId?: string;
  parentEventId?: string;
  retryCount?: number;
  processingDurationMs?: number;
  targetAuthorities?: string[];
}

export interface PublishOptions {
  correlationId?: string;
  causationId?: string;
  severity?: EventSeverity;
  traceId?: string;
  parentEventId?: string;
  targetAuthorities?: string[];
}

export interface SubscribeOptions {
  subscriberAuthority: string;
  filter?: (envelope: EventEnvelope) => boolean;
}

export interface Subscription {
  subscriptionId: string;
  selector: string;
  selectorKind: 'event' | 'category';
  subscriberAuthority: string;
  handler: (envelope: EventEnvelope) => void | Promise<void>;
  filter?: (envelope: EventEnvelope) => boolean;
  consecutiveFailures: number;
  dead: boolean;
  registeredAt: string;
  sequence: number;
}

export interface SubscriberDeliveryResult {
  subscriptionId: string;
  subscriberAuthority: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

/** §14/§15 — every processed event's audit + explainability record in one place. */
export interface EventAuditRecord {
  eventId: string;
  eventType: string;
  publisher: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  subscriberResults: SubscriberDeliveryResult[];
  overallDurationMs: number;
  outcome: 'completed' | 'failed' | 'partial' | 'no-subscribers';
}

export interface BusMetrics {
  totalPublished: number;
  totalDispatched: number;
  totalFailedDeliveries: number;
  queueDepth: number;
  averageDispatchMs: number;
  deadSubscriptions: number;
}

export interface EventHistoryFilter {
  eventType?: string;
  publisher?: string;
  correlationId?: string;
  since?: string;
  limit?: number;
}
