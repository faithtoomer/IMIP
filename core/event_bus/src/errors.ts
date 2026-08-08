export class EventBusError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'EventBusError';
    this.code = code;
  }
}

/** §23 — "Permit undefined event publication" and "subscribe to undefined events" are
 * both prohibited (§11, §16). This is the shared error for both violations. */
export class UnregisteredEventError extends EventBusError {
  constructor(eventName: string) {
    super('EVENT_UNREGISTERED', `Event "${eventName}" is not registered with the Institutional Event Bus.`);
    this.name = 'UnregisteredEventError';
  }
}

/** Law 2 — only the owning authority may publish an event type. */
export class PublisherOwnershipViolationError extends EventBusError {
  constructor(eventName: string, attemptedBy: string, owner: string) {
    super(
      'EVENT_PUBLISHER_NOT_OWNER',
      `"${attemptedBy}" may not publish "${eventName}" — it is owned by "${owner}".`,
    );
    this.name = 'PublisherOwnershipViolationError';
  }
}

export class SubscriberNotAllowedError extends EventBusError {
  constructor(eventName: string, subscriberAuthority: string) {
    super(
      'EVENT_SUBSCRIBER_NOT_ALLOWED',
      `"${subscriberAuthority}" is not an allowed subscriber of "${eventName}".`,
    );
    this.name = 'SubscriberNotAllowedError';
  }
}

export class PayloadValidationError extends EventBusError {
  readonly errors: string[];

  constructor(eventName: string, errors: string[]) {
    super('EVENT_PAYLOAD_INVALID', `Payload for "${eventName}" failed validation: ${errors.join('; ')}`);
    this.name = 'PayloadValidationError';
    this.errors = errors;
  }
}

/** §16 — a synchronous publish-dispatch chain re-triggered an event already in
 * flight on the same causal call stack. Scope: catches synchronous/awaited
 * recursive loops within one publish() call tree; it cannot detect cycles formed
 * by independently-triggered async events later — that is inherent to any
 * event-driven system and is documented, not silently ignored. */
export class CircularPublicationError extends EventBusError {
  constructor(eventName: string, chain: string[]) {
    super('EVENT_CIRCULAR_PUBLICATION', `Circular publication detected for "${eventName}": ${[...chain, eventName].join(' -> ')}`);
    this.name = 'CircularPublicationError';
  }
}

export class QueueOverflowError extends EventBusError {
  constructor(maxSize: number) {
    super('EVENT_QUEUE_OVERFLOW', `Event queue exceeded its maximum size (${maxSize}).`);
    this.name = 'QueueOverflowError';
  }
}

export class DuplicateEventDefinitionError extends EventBusError {
  constructor(eventName: string) {
    super('EVENT_DUPLICATE_DEFINITION', `Event "${eventName}" is already registered.`);
    this.name = 'DuplicateEventDefinitionError';
  }
}

export class MissingTargetAuthoritiesError extends EventBusError {
  constructor(eventName: string) {
    super('EVENT_MISSING_TARGET_AUTHORITIES', `"${eventName}" uses directed delivery and requires at least one target authority.`);
    this.name = 'MissingTargetAuthoritiesError';
  }
}
