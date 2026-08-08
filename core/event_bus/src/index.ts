export { InstitutionalEventBus, type InstitutionalEventBusOptions } from './InstitutionalEventBus.js';
export { EventRegistry } from './registry.js';
export { SubscriptionRegistry, DEAD_SUBSCRIBER_THRESHOLD } from './subscriptions.js';
export { PriorityEventQueue } from './queue.js';
export {
  NoopEventPersistence,
  MemoryEventPersistence,
  FileEventPersistence,
  type EventPersistence,
} from './persistence.js';
export {
  EventBusError,
  UnregisteredEventError,
  PublisherOwnershipViolationError,
  SubscriberNotAllowedError,
  PayloadValidationError,
  CircularPublicationError,
  QueueOverflowError,
  DuplicateEventDefinitionError,
  MissingTargetAuthoritiesError,
} from './errors.js';
export type {
  EventCategory,
  EventPriority,
  EventSeverity,
  DeliveryMode,
  DeliveryTargeting,
  PayloadValidator,
  EventDefinition,
  EventEnvelope,
  PublishOptions,
  SubscribeOptions,
  Subscription,
  SubscriberDeliveryResult,
  EventAuditRecord,
  BusMetrics,
  EventHistoryFilter,
} from './types.js';
