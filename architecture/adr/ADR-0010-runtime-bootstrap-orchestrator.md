# ADR-0010: Institutional Runtime Bootstrap & Lifecycle Manager

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 07  
**Deciders:** Architectural Authority (Specification)

## Context

Phase 07's own architecture diagram (§5) names a startup sequence running through Capability Registry and Plugin Registry — neither of which exist as code (both remain reserved: ADR-0002 for the PCR; Plugin Registry has no module at all). Building IRBLM against that literal diagram would mean either fabricating placeholder authorities (explicitly prohibited, §21) or hardcoding a sequence that immediately goes stale the moment a real authority is added.

Two further decisions needed a record: how IRBLM talks to the platform's event system, and how strictly to interpret Law 6 ("partial startup is prohibited unless explicitly authorized").

## Decisions

1. **Generic, dependency-graph-driven orchestration**, not a hardcoded named sequence. `ComponentDefinition<T>` (`create`/`initialize`/`checkReadiness`/`checkHealth`/`shutdown`) is the contract; `DependencyGraph` topologically sorts whatever is actually registered. `adapters.ts` supplies concrete definitions for the three authorities that exist today (Institutional Event Bus, Configuration Authority, Hardware Authority) by wrapping their real, unmodified public APIs — no changes to any of those three certified modules. Capability Registry and Plugin Registry register the same way whenever they're built, with zero change to the orchestrator.
2. **IRBLM uses the IEB directly, not a mirrored local bus.** ICMS and IHIS mirror onto the IEB (ADR-0009 §6) specifically to preserve a pre-existing synchronous public API. IRBLM has no such legacy constraint — every one of its public methods is already `async` (it awaits component initialization), so it publishes its 14 runtime events straight through the real bus. It is the first authority to realize Law 1 for itself without qualification.
3. **Readiness verification is a distinct pass from initialization**, not folded into the same loop, matching §16's explicit separation of "initialization failures" from "failed readiness checks." This also enabled catching a real bug during testing: a dependency that was *created* but failed to *initialize* was still present in the instance map, so downstream components didn't correctly see it as unavailable. Fixed by tracking successfully-*initialized* names separately from merely-created instances.
4. **Certification never blocks on `degraded` health, only `faulted`.** The Governance Board's stated purpose (§22) is to keep degraded-but-operational components visible, not to treat them as failures — conflating the two would make the RGB pointless.
5. **Law 6 (`allowPartialStartup`) applies uniformly to both initialization and readiness failures**, and certification is computed only over the successfully-initialized-and-ready pool when partial startup is authorized. Failed components remain fully visible in the Governance Board (never hidden), they simply don't factor into whether the successful subset can go Operational.
6. **Single-component restart does not cascade to dependents.** Full cascading restart (recomputing which downstream components must also restart) is real additional complexity with no current caller needing it; documented as a scope simplification rather than silently assumed away.

## Consequences

- Adding Capability Registry, Plugin Registry, or any future authority to the runtime is a `registerComponent()` call with a new adapter — no changes to `RuntimeOrchestrator`, `DependencyGraph`, `certifyRuntime()`, or the lifecycle state machine.
- The Governance Board becomes the platform's standing answer to "why is X unavailable" / "what's blocking Operational" / "what's degraded," independent of the boot sequence that produced the current state.
- IRBLM's own event definitions are the first in the platform registered and published with `deliveryMode: 'sync'` directly against the real IEB — a template for how future new authorities (with no legacy sync-API constraint) should integrate, as distinct from ICMS/IHIS's mirror pattern.
