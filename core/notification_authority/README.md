# Institutional Notification & Communication Authority (INCA)

**Status:** IMPLEMENTED (Phase 13)  
**Location:** `core/notification_authority/`  
**Authority:** PHASE-13 / ADR-0016

## Purpose

INCA is the sole institutional authority for platform communication. Notifications are decisions — who should know, what, when, through which channel, at what priority, whether acknowledgement is required, whether it escalates — not just messages sent to a channel. It fills the "Notification Authority" slot named in `architecture/AUTHORITY_REGISTRY.md`.

## Layout

```text
core/notification_authority/
  src/
    types.ts                  NotificationSeverity/Priority, NotificationDefinition/Record,
                                Acknowledgement, Recipient, DigestDefinition, NOTIFICATION_EVENTS (8)
    errors.ts                   Structured, typed error taxonomy
    categoryRegistry.ts           NotificationCategoryRegistry — real, runtime-extensible (§6)
    registry.ts                     NotificationRegistry — notification TYPE definitions (§8)
    recipientRegistry.ts              RecipientRegistry — "who should know"
    channels.ts                         Console/Memory/Log/Webhook/Discord (real) + Email (interface)
    suppressionEngine.ts                  checkSuppression() — real, ISOA-aware (§13)
    escalationEngine.ts                     findDueEscalationStep() — real, tick-based (§11)
    acknowledgementManager.ts                 AcknowledgementManager — structurally immutable
    digestManager.ts                            computeDigestReport() — real ISOA integration (§14)
    auditTrail.ts                                 NotificationAuditTrail — structurally immutable
    events.ts                                       NotificationEventBus — mirrors onto the real IEB
    intelligence.ts                                   InstitutionalCommunicationIntelligence (§24)
    NotificationAuthority.ts                            The orchestrator
    index.ts                                             Public exports
  tests/                                                  70 tests across 12 files
```

## Usage

```ts
import { NotificationAuthority } from './core/notification_authority/src/index.js';

const inca = new NotificationAuthority({ schedulingAuthority: isoa, observabilityAuthority: iola });

inca.registerNotificationType({
  notificationTypeId: 'hardware-fault',
  name: 'Hardware Fault',
  category: 'hardware',
  triggerEvent: 'HardwareFaultDetected',
  severity: 'error',
  defaultPriority: 'high',
  defaultChannels: ['console'],
  requiresAcknowledgement: true,
  escalationPolicy: { steps: [{ afterMs: 5 * 60_000, action: 'notify-operator', recipientId: 'on-call' }] },
  suppressionRules: { duplicateWindowMs: 60_000, respectMaintenanceWindows: true },
});

// Law 6 — returns immediately; delivery happens in the background:
const notification = inca.requestNotification({
  notificationTypeId: 'hardware-fault',
  title: 'GPU 1 overheating',
  message: '92°C, exceeds safe threshold.',
  requestingAuthority: 'Hardware Authority',
});

await inca.flushDeliveries(); // test/diagnostic hook — awaits in-flight delivery
inca.acknowledge(notification.notificationId, 'operator-1');
inca.checkEscalations(); // real, tick-based — call periodically (e.g. from an ISOA schedule)

// §14 — a real ISOA-scheduled digest:
await inca.registerDigest(
  { digestId: 'daily-hardware', name: 'Daily Hardware Summary', categories: ['hardware'], channels: ['console'] },
  { kind: 'time', dailyAt: { hour: 8, minute: 0 } },
);

inca.intelligence.evaluate(); // §24 — channel reliability, ignored-alert detection, etc.
```

## Scope Boundary

INCA owns the Notification Registry, generation, routing, delivery, channel management, escalation, history, suppression, digest generation, and communication auditing — never business logic, runtime scheduling, event routing, security decisions, or mining operations (§4).

## Governance

- `requestNotification()` is synchronous and returns immediately (Law 6) — real delivery (often network I/O) runs as a tracked background task, awaitable via `flushDeliveries()` for deterministic testing.
- Digest generation and maintenance suppression are real ISOA integrations — INCA contains no internal timer/cron logic and no duplicated maintenance-window concept.
- `NotificationCategoryRegistry` and `NotificationPriority` are deliberately their own types, not reused from the Event Bus's `EventCategory`/`EventPriority` — the spec's own value sets don't match those unions.
- `AcknowledgementManager` and `NotificationAuditTrail` both expose no update or delete method for any reason — immutability is structural.
- Five of six initial channels are real and functional; `EmailNotificationChannel` ships only a generic interface — no SMTP client exists in this codebase, and the caller supplies the real sender.
