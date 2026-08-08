import type { EventDefinition, EventEnvelope } from '../src/types.js';

export function makeDefinition(overrides: Partial<EventDefinition> = {}): EventDefinition {
  return {
    id: 'test.TestEvent',
    name: 'TestEvent',
    category: 'diagnostics',
    description: 'A test event.',
    publisherAuthority: 'Test Authority',
    priority: 'normal',
    deliveryMode: 'sync',
    targeting: 'broadcast',
    version: '1.0.0',
    ...overrides,
  };
}

export function makeEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  const eventId = overrides.eventId ?? Math.random().toString(36).slice(2);
  return {
    eventId,
    eventType: 'TestEvent',
    eventVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    publisher: 'Test Authority',
    correlationId: eventId,
    severity: 'info',
    priority: 'normal',
    payload: {},
    processingStatus: 'pending',
    ...overrides,
  };
}
