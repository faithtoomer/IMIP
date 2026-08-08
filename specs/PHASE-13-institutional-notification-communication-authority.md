# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 13

# Institutional Notification & Communication Authority (INCA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Core Infrastructure Authority

> INCA fills the "Notification Authority" slot named in `architecture/AUTHORITY_REGISTRY.md` (Phase 01). Notifications are decisions, not messages: who should know, what, when, through which channel, at what priority, whether acknowledgement is required, and whether it escalates. See ADR-0016.

---

# 1. Mission Statement

INCA is the sole authority for generating, routing, delivering, tracking, escalating, and auditing all platform notifications and operational communications. No authority sends notifications independently.

---

# 2. Mission Objectives

Notification generation, routing, multi-channel delivery, priority management, escalation workflows, delivery tracking, acknowledgement tracking, notification suppression, digest generation, explainable notifications, notification auditing, a real extension point for future enterprise messaging integration.

---

# 3. Institutional Principles

1. **Single Notification Authority** — INCA is the sole owner of notification delivery.
2. **Event Driven** — authorities request notifications (`requestNotification()`); INCA decides whether/how they're actually delivered. Requesting is not the same as sending — the request itself is just another input into INCA's registry/suppression/routing pipeline, never a bypass of it.
3. **Channel Independence** — authorities never select a channel directly; a `NotificationDefinition`'s `defaultChannels` (or an explicit override) is resolved by INCA.
4. **Explainability** — every notification answers why/which-event/who-requested/who-received/why-this-channel/was-it-successful via `explain()`.
5. **Policy Governed** — routing, suppression, and escalation all read from registered, inspectable definitions, never ad hoc logic.
6. **Non-Blocking** — `requestNotification()` is synchronous and returns immediately; real channel delivery (often network I/O) runs as a tracked background task. See §5/ADR-0016.

---

# 4. Responsibilities

INCA owns: the Notification Registry, notification generation, delivery routing, channel management, delivery tracking, escalation management, notification history, suppression, digest generation, communication auditing, notification events. INCA does **not** own: business logic, runtime scheduling, event routing, security decisions, or mining operations.

---

# 5. Runtime Architecture

```text
Authorities
        │
        ▼
Institutional Notification & Communication Authority
        │
        ├──────── Notification Registry (types)
        ├──────── Recipient Registry ("who should know" — see §7 note)
        ├──────── Routing Engine
        ├──────── Delivery Manager (real channels)
        ├──────── Escalation Engine (real, tick-based)
        ├──────── Acknowledgement Manager
        ├──────── Suppression Engine
        ├──────── Digest Manager (real ISOA integration)
        └──────── Audit Manager
                    │
                    ▼
Delivery Providers (Console/Memory/Log/Webhook/Discord real; Email interface-only)
```

`requestNotification()` is synchronous (Law 6); events mirror onto the real IEB (ADR-0009 §6 pattern), the same choice made for ISTA (ADR-0015).

---

# 6. Notification Categories

17 named categories, seeded into a real, runtime-extensible `NotificationCategoryRegistry` — deliberately **not** a reuse of the Event Bus's `EventCategory`, since the spec's own list (`maintenance`, `backup`, `recovery`, `operator`) includes values `EventCategory` doesn't have. INCA's own 8 events, separately, register under the Event Bus's existing `'notification'` category — reserved and unused since Phase 01/05, no widening needed.

---

# 7. Delivery Channels

Real, shipped implementations: `ConsoleNotificationChannel` (stands in for "Desktop" — no OS-level desktop notification precedent exists in this codebase), `MemoryNotificationChannel` (stands in for "Dashboard" — a real, bounded, pollable feed), `LogNotificationChannel` (a genuine integration with IOLA, not a separate logging path), `WebhookNotificationChannel` (real, via Node's built-in global `fetch`, no new dependency), `DiscordNotificationChannel` (a real `WebhookNotificationChannel` configured with Discord's payload shape — Discord's integration mechanism *is* webhooks). `EmailNotificationChannel` ships only the interface — no SMTP client exists anywhere in this codebase, and the caller supplies the real sender (the same "real mechanism, bring your own backend" posture as `EventPersistence`'s database mode, ADR-0009).

**Recipient note**: §5's Routing Engine needs a "who" to route to, which the spec doesn't separately name as a registry. `RecipientRegistry` is the real, necessary primitive that decision requires — built honestly, not left implicit.

---

# 8. Notification Registry

Every field §8 requires. `NotificationDefinition` is the type-level registration; individual notifications are `NotificationRecord` instances, tracked separately.

---

# 9. Notification Lifecycle

```text
generated → validated → registered → queued → delivered → acknowledged (optional) → archived
```

Extended beyond the spec's literal 7-node diagram with `suppressed`, `failed`, and `escalated` — required for §11/§13/§18 to be real states, not just interfaces with nowhere to route. See ADR-0016.

---

# 10. Priority Levels

`critical | high | normal | low | informational` — a distinct `NotificationPriority` type, deliberately **not** a reuse of the Event Bus's `EventPriority` (`critical|high|normal|low|background`), since the value sets don't match. See ADR-0016.

---

# 11. Escalation Engine

Real, tick-based (`checkEscalations(at?)`), not `setTimeout`-driven — matching ISOA's `tick()` pattern: deterministic, testable with an injectable clock, no timer flakiness. Supports every listed action: retry-same-channel, alternate-channel, notify-operator, notify-administrator, broadcast-critical.

---

# 12. Acknowledgement Management

`AcknowledgementManager` — structurally immutable, mirroring every other audit-style trail in this platform.

---

# 13. Suppression Rules

Duplicate/time-window/category suppression are real, computed checks (`checkSuppression()`). **Maintenance suppression consults ISOA's already-built Institutional Time Graph** (`isBlockedAt()`, Phase 11) when a `SchedulingAuthority` is supplied — INCA does not duplicate a second maintenance-window concept. A real bug (a notification suppressing itself as a "duplicate" of its own just-recorded snapshot) was caught and fixed during testing — see ADR-0016.

---

# 14. Digest Generation

**Real integration with ISOA**, exactly as §14 requires: `registerDigest()` registers a genuine `SchedulingAuthority` time-triggered schedule whose handler calls `generateDigest()` — INCA contains no internal timer/cron logic of its own for this. `computeDigestReport()` is a real aggregation over actually-recorded notification history.

---

# 15. Notification Events

The 8 named events, registered under the reserved `'notification'` `EventCategory`.

---

# 16. Explainability

`explain(notificationId)` returns the record, its acknowledgements, and its full audit history together.

---

# 17. Public Interfaces

`requestNotification()`, `acknowledge()`, `checkEscalations()`, `registerDigest()`/`generateDigest()`, `explain()`, `getMetrics()`, plus `registry`/`recipients`/`audit`/`intelligence` read surfaces. Authorities request notifications; they never select channels directly.

---

# 18. Error Handling

`InvalidNotificationError`, `UnregisteredNotificationTypeError`, `DuplicateNotificationTypeError`, `UnregisteredNotificationCategoryError`, `NotificationNotFoundError`, `DuplicateChannelError`, `UnregisteredChannelError`, `RecipientNotFoundError`, `DigestNotFoundError` — all typed. An unregistered delivery channel produces a real, recorded delivery failure, not a crash.

---

# 19. Performance Metrics

`getMetrics()`: generatedCount, deliveredCount, failedCount, escalationCount, suppressedCount, averageDeliveryLatencyMs, averageAcknowledgementLatencyMs. Exposed to **the Institutional Observability & Logging Authority** (IOLA now exists) — every INCA event is also logged through IOLA when configured.

---

# 20. Testing Requirements

70 tests across 12 files: category/type/recipient registries, every delivery channel (including real `fetch`-mocked webhook/Discord delivery and real IOLA log delivery), suppression (including real ISOA maintenance-window consultation), escalation (tick-based, all action types), acknowledgement (structural immutability), digest computation, the event mirror, the Institutional Communication Intelligence layer, and the orchestrator end-to-end — non-blocking request/delivery, suppression, multi-channel delivery, unregistered-channel handling, acknowledgement, escalation dispatch, real ISOA digest scheduling, real ISOA maintenance suppression, explainability, metrics, and real IEB/IOLA integration.

---

# 21. Acceptance Criteria

All notifications flow through INCA. The Notification Registry is authoritative. Multi-channel delivery is operational. Priority routing functions correctly. Escalation policies are enforced. Acknowledgements are tracked. Suppression rules prevent notification fatigue. Digest generation is operational (via real ISOA integration). Notification events are published. Explainability is complete. Tests pass. Documentation is complete.

---

# 22. Institutional Completion Standard (ICS) / Compliance Note

No placeholder implementations: five of six initial channels are real and functional (Console/Memory/Log/Webhook/Discord); Email is an honest, generic interface with no fabricated SMTP backend. A pre-coding spec review (explicitly requested) confirmed digest generation and maintenance suppression are real ISOA integrations, not duplicated logic, and that INCA's own notification-category and priority types are deliberately distinct from (not reused from) the Event Bus's `EventCategory`/`EventPriority`, since the spec's own value sets don't match those unions.

---

# 24. Architect's Enhancement: Institutional Communication Intelligence (ICI)

**Implemented in full**, per explicit direction. `InstitutionalCommunicationIntelligence` computes channel reliability, most-ignored notification types, average acknowledgement latency, and suppression rate — all from real, already-tracked delivery/acknowledgement data. Never changes policy automatically, exactly as §24 specifies — it produces insights (`evaluate()`) for a human or a future Decision Intelligence program to act on.
