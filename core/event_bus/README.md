# Institutional Event Bus (IEB)

**Status:** IMPLEMENTED (Phase 05)  
**Location:** `core/event_bus/`  
**Authority:** PHASE-05 / ADR-0009

## Purpose

IEB is IMIP's sole communication backbone. Every authority, plugin, and subsystem publishes and subscribes through it — no authority implements its own event system or messages another directly outside an approved interface (Law 1, Law 3).

## Layout

```text
core/event_bus/
  src/
    types.ts                Shared types (EventDefinition, EventEnvelope, Subscription, ...)
    registry.ts               EventRegistry — SSOT for event definitions (Law 1)
    queue.ts                    PriorityEventQueue — binary min-heap, priority + FIFO tie-break
    subscriptions.ts              SubscriptionRegistry — event/category subscriptions,
                                   dead-subscriber tracking
    persistence.ts                  EventPersistence interface + Noop/Memory/File implementations
    errors.ts                        Structured, typed error taxonomy
    InstitutionalEventBus.ts          Orchestrator: validate -> envelope -> dispatch/queue
                                       -> subscriber fan-out -> audit -> persist
    index.ts                          Public exports
  tests/                                57 tests across 11 files (+ cross-authority-integration.test.ts
                                        proving the ICMS/IHIS connection — see below)
```

## Usage

```ts
import { InstitutionalEventBus } from './core/event_bus/src/index.js';

const bus = new InstitutionalEventBus();

bus.registerEventType({
  id: 'configuration.ConfigurationChanged',
  name: 'ConfigurationChanged',
  category: 'configuration',
  description: 'A configuration value changed.',
  publisherAuthority: 'Configuration Authority',
  priority: 'normal',
  deliveryMode: 'sync',
  targeting: 'broadcast',
  version: '1.0.0',
});

const unsubscribe = bus.subscribeToEvent('ConfigurationChanged', (envelope) => {
  console.log(envelope.payload);
}, { subscriberAuthority: 'Dashboard' });

const audit = await bus.publish('ConfigurationChanged', 'Configuration Authority', { key: 'platform.locale' });
// audit.outcome, audit.subscriberResults, audit.overallDurationMs
```

### Connecting ICMS / IHIS

Pass a shared bus into either authority's constructor and its full event catalog auto-registers, with every subsequent publish mirrored onto the IEB alongside its own local (synchronous, unchanged) delivery:

```ts
const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
const icms = new ConfigurationAuthority({ eventBus: bus });
const ihis = new HardwareAuthority({ eventBus: bus });

// A consumer holding only `bus` — no reference to icms or ihis — can observe both:
bus.subscribeToCategory('configuration', (e) => console.log(e.eventType), { subscriberAuthority: 'Anyone' });
bus.subscribeToCategory('hardware', (e) => console.log(e.eventType), { subscriberAuthority: 'Anyone' });
```

See `docs/phase-05/event-bus-connection.md` for why this is a mirror rather than a full migration.

## Scope Boundary

IEB owns transport — definitions, routing, delivery, auditing. It owns no business logic, no decisions, no mining/scheduling/hardware logic (§4). Payload *shape* validation lives on each event definition (`payloadValidator`); IEB never inspects payload semantics.

## Governance

- Every event type is registered exactly once (`EventRegistry`, duplicate registration throws).
- Only an event's declared `publisherAuthority` may publish it — enforced at `publish()`, not by convention.
- No authority may subscribe to an unregistered event, or to a restricted event it isn't on `allowedSubscribers` for.
- A subscriber's failure never blocks delivery to others or crashes the bus; three consecutive failures marks it dead (visible via `getSubscriptions()`, not silently dropped).
- 'database' persistence mode and the Event Intelligence & Correlation Engine are real, complete extension points with nothing plugged in by design (no Database Authority, EICE explicitly reserved) — see ADR-0009.
- ICMS and IHIS are connected via a mirror/bridge (`eventBus` option), not a full migration — their local, synchronous delivery is unchanged; every publish is additionally mirrored onto the IEB. See ADR-0009 §6 and `docs/phase-05/event-bus-connection.md`.
