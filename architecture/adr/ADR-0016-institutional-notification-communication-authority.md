# ADR-0016: Institutional Notification & Communication Authority

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 13  
**Deciders:** Architectural Authority (Specification), User (naming/scope framing)

## Context

The user framed Phase 13 around a real distinction: notifications are decisions (who should know, what, when, through which channel, with what priority, whether acknowledgement is required, whether it escalates), not just messages a conventional notification service sends. Before writing code, per the user's explicit instruction ("review the following for duplication, redundancies, conflicts and contradictions"), the spec was checked against `AUTHORITY_REGISTRY.md`, and — critically — against ISOA (Phase 11) and IOLA (Phase 10), since §14 and §13 of the spec explicitly reference "the Scheduler Authority" and channel/log delivery respectively.

That review found two real integration points the spec itself asks for, not conflicts to resolve by picking a side:

1. §14: "Digest generation integrates with the Scheduler Authority." ISOA already has a real, tested time-trigger and dispatch mechanism (Phase 11) — building a second, INCA-internal timer for digests would duplicate it.
2. §13: "Maintenance suppression" is one of INCA's suppression rule types. ISOA already has a real, working Institutional Time Graph with maintenance windows (`isBlockedAt()`, Phase 11) — INCA reimplementing its own separate maintenance-window concept would duplicate that too.

The review also found that INCA's own §6 "Notification Categories" list includes values (`maintenance`, `backup`, `recovery`, `operator`) absent from the Event Bus's `EventCategory`, meaning it has to be INCA's own registry, not a reuse — and that §10's priority levels (`informational` instead of `background`) don't match the Event Bus's `EventPriority` either, unlike ISOA's priority field, which correctly reused it because the value sets happened to align.

§24's wording ("I'd recommend building toward from the beginning") was softer than Phase 12's unambiguous phrasing, so it was clarified directly before implementation: build the Institutional Communication Intelligence layer in full, same as every prior Architect's Enhancement.

## Decisions

1. **Digest generation is a real ISOA integration, not a second scheduler.** `registerDigest()` calls `SchedulingAuthority.registerSchedule()` with a real time trigger and a handler that calls `generateDigest()`. INCA contains zero internal cron/timer logic for this.
2. **Maintenance suppression consults ISOA's real Institutional Time Graph**, not a duplicated concept. `checkSuppression()` accepts an injected `isBlockedByMaintenance` function; `NotificationAuthority` wires it to `schedulingAuthority.graph.isBlockedAt()` when one is supplied.
3. **`NotificationCategoryRegistry` is INCA's own runtime-extensible registry** (mirroring IOLA's `LogCategoryRegistry` pattern), not a reuse of `EventCategory` — the value sets genuinely differ. INCA's own 8 events register under the Event Bus's existing `'notification'` category instead, which required no widening.
4. **`NotificationPriority` is its own type, not a reuse of `EventPriority`** — verified the value sets don't match (`informational` vs. `background`) before deciding, rather than assuming reuse was safe the way it was for ISOA's priority field.
5. **`requestNotification()` is synchronous and returns immediately; delivery runs as a tracked, not-awaited background task** (Law 6 "Non-Blocking"). Events mirror onto the IEB fire-and-forget (ADR-0009 §6 pattern), the same choice made for ISTA (ADR-0015) — for the same reason: a widely-depended-upon authority's entry point should be callable inline from any other synchronous authority.
6. **The escalation engine is real and tick-based (`checkEscalations(at?)`), not `setTimeout`-driven** — matching ISOA's `tick()` pattern for the same reason: deterministic, testable with an injectable clock, no timer flakiness in tests or production.
7. **Five of six initial channels are real and functional; Email ships only a generic interface.** No SMTP client exists anywhere in this codebase, and adding one is a new dependency for a capability nothing else needs. Console/Memory/Log are zero-dependency; Webhook/Discord use Node's built-in global `fetch` (verified available on the target runtime, no new dependency); Discord is literally a `WebhookNotificationChannel` configured with Discord's own webhook payload shape, not a separate implementation.
8. **`RecipientRegistry` was added as a real, necessary primitive** the spec implies but doesn't separately name — §5's Routing Engine needs a "who" to route to. Built honestly, the same way IDA added `revision` and ISOA added extra lifecycle states beyond a literal reading of their specs.
9. **The notification lifecycle is extended with `suppressed`, `failed`, and `escalated`** beyond the spec's literal 7-node §9 diagram — required for §11/§13/§18 to be real, reachable states.
10. **A real bug was caught and fixed during testing**: the suppression check's "recent notifications" pool included the notification currently being evaluated, because the `validated` lifecycle transition records it before the suppression check runs — so a notification's duplicate-detection check matched against itself, and every notification with `duplicateWindowMs` configured was suppressed on its very first request. Fixed by excluding the in-flight notification's own ID from the candidate pool passed to `checkSuppression()`.
11. **The Institutional Communication Intelligence (§24) is built in full**, per the user's clarified direction.

## Consequences

- ISOA remains the platform's single real scheduling mechanism — INCA's digests are schedules like any other, visible in ISOA's own registry and Institutional Time Graph.
- A maintenance window registered once, in ISOA's graph, simultaneously blocks scheduled job execution (ISOA) and notification delivery (INCA) — one source of truth, two real consumers.
- `NotificationCategoryRegistry` and `NotificationPriority` are free to diverge from `EventCategory`/`EventPriority` as INCA's own needs require, without pressure to keep a mismatched reuse consistent.
- The suppression self-match bug is exactly the kind of defect the test-first-then-fix discipline in this project exists to catch before certification, not after.
