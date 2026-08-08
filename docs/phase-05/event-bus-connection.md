# Phase 05 Follow-Up — Connecting ICMS and IHIS to the IEB

**Date:** 2026-08-08  
**Authority:** ADR-0009 §6

## What changed

`ConfigEventBus` (ICMS) and `HardwareEventBus` (IHIS) now optionally accept a shared `InstitutionalEventBus` instance:

```ts
const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
const icms = new ConfigurationAuthority({ eventBus: bus, /* ...other options */ });
const ihis = new HardwareAuthority({ eventBus: bus });
```

On construction, each authority's event bus registers its full event catalog with the IEB, owned by its own authority name (`Configuration Authority` / `Hardware Authority`). Every subsequent `publish()` call:

1. Delivers synchronously to local subscribers exactly as before (`ConfigurationAuthority.events.subscribe(...)`, `HardwareAuthority.events.subscribe(...)`) — **unchanged behavior, unchanged signatures**.
2. Additionally fires a mirrored publish onto the IEB (fire-and-forget, `.catch()`-swallowed) so the event becomes discoverable, audited, and subscribable platform-wide.

Without an `eventBus` option, both modules behave exactly as they did before Phase 05 — this is fully opt-in.

## Why a mirror, not a full migration

The IEB's `publish()` is async by design (it validates, priority-queues, and awaits subscriber dispatch before resolving). ICMS's `load()`/`requestUpdate()`/`rollback()` and most of IHIS's mutation methods are synchronous, and 176 tests across both modules assert on state immediately after calling them with no `await`. Making the IEB the literal sole event mechanism (Law 1's letter) would require making those methods `async`, which is a breaking API change to two already-certified phases for no functional gain right now — nothing yet consumes IEB-mirrored ICMS/IHIS events except the tests written for this connection.

The mirror achieves the actual goal — loose coupling (Law 3), cross-authority observability, a real shared audit trail — without that cost. See ADR-0009 §6 for the full record.

## Proven capability

`core/event_bus/tests/cross-authority-integration.test.ts` demonstrates the payoff directly: a subscriber holding only a reference to the shared `InstitutionalEventBus` — no reference to either `ConfigurationAuthority` or `HardwareAuthority` — observes both authorities' real events (`ConfigurationLoaded`, `HardwareDiscovered`) via `bus.subscribeToCategory()`, and the shared audit trail correctly attributes each event to its actual publisher, never conflating the two.

## Verification

```text
npx tsc --noEmit -p tsconfig.json         → clean (src)
npx tsc --noEmit (src + tests combined)    → clean
npm run build                              → dist/ emitted successfully
npx vitest run                             → 42 files, 248 tests, 248 passed (15 new for the
                                              connection; zero regressions in the existing 233)
```

## Not done here

- **Full migration** (IEB as the sole mechanism, ICMS/IHIS methods made async) — remains possible later, not required now.
- **Retargeting existing local subscribers** (e.g. anything currently calling `authority.events.subscribe(...)`) onto the IEB — local delivery is untouched by design.
- **Registering the platform's actual cross-authority consumers** (e.g. a future Decision Intelligence Authority reacting to `ConfigurationChanged`) — this connection makes that possible, it doesn't yet do it, since that consumer doesn't exist.
