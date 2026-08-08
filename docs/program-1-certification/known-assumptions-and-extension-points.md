# Program I — Known Assumptions & Extension Points

Every reserved, deferred, or intentionally-scoped-down decision across all 10 ADRs, in one ledger. Nothing here is an oversight — each entry has a named owner (the ADR that made the call) and a clear trigger for when it should be revisited.

## Reserved (no code, directory + README only)

| Item | Reserved since | Owning ADR | Trigger to implement |
|---|---|---|---|
| Platform Capability Registry (`core/capability_registry/`) | Phase 00 | ADR-0002 | When cross-authority capability discovery is needed beyond IHIS's own `getCapabilityRegistrations()` read-surface |
| Policy Authority / Policy Engine (`core/policy_engine/`) | Phase 01 | ADR-0004 | When the 9 deferred Configuration-adjacent values (profitability thresholds, thermal/power limits, schedules, failover rules — see `configuration-catalog.md`) need an actual owner |
| Event Intelligence & Correlation Engine (EICE) | Phase 05 | ADR-0009 §"Reserved: EICE" | When cross-event pattern detection / causal-chain analysis is needed; the data model (`correlationId`/`causationId` on every envelope, full audit history) already supports it without redesign |

## Real Extension Points (complete, functioning, zero registrations today)

| Item | File | Owning ADR | What plugging in looks like |
|---|---|---|---|
| ASIC discovery backend | `AsicDiscoveryProvider` interface, `NoopAsicDiscoveryProvider` default | ADR-0008 | A new class implementing the interface (LAN scan + vendor API), passed to `SystemInformationDiscoveryProvider` |
| Hardware/policy compatibility checkers | `CompatibilityRegistry` in ICMS | ADR-0007-adjacent (Phase 02) | `.register(checker)` calls from a future Hardware/Policy Authority |
| 'database' event/config persistence | `EventPersistence` interface (IEB), audit JSONL sink (ICMS) | ADR-0009 §17 | A new class implementing the interface once a Database Authority exists |
| Capability Registry / Plugin Registry runtime components | `ComponentDefinition<T>` contract | ADR-0010 | `registerComponent()` with a new adapter, once those modules exist — zero changes to `RuntimeOrchestrator` |

## Deliberate Scope Boundaries (not gaps — explicit trade-offs)

| Decision | Reasoning | Owning ADR |
|---|---|---|
| ICMS/IHIS mirror onto the IEB rather than fully migrating to it | Their public APIs are synchronous and certified; a full migration would force `async` onto `load()`/`requestUpdate()`/most of IHIS's mutation methods, breaking ~176 tests for no current functional gain | ADR-0009 §6 |
| Circular-publication detection (IEB) only catches synchronous/awaited chains within one `publish()` call tree | Detecting cycles across independently-triggered async events later is not practically possible without distributed tracing | ADR-0009 |
| Single-component restart (IRBLM) doesn't cascade to dependents | Real additional complexity, no current caller needs it | ADR-0010 §6 |
| Configuration/Policy/Operational-State three-way split | The literal Phase 02 draft would have put conditional operational rules (thresholds, limits, schedules) under Configuration, violating SSOT once Policy Authority exists | ADR-0006, ADR-0007 |
| 9 specific values excluded from the 44-key Configuration Registry | See `configuration-catalog.md` — named individually, not silently dropped | ADR-0006 |

## Structural Gaps (specification numbering, not implementation)

| Gap | Resolution |
|---|---|
| "Phase 04" | Content overlapped almost entirely with Phase 03 (same mission, Laws, Digital Twin concept) — absorbed as additive enhancements to Phase 03 instead of a separate spec (`docs/phase-03/implementation-summary.md` §2a) |
| "Phase 06" | Never specified. Phase 07 was given directly as Program I's final phase |

## Bugs Found and Fixed During Development (for institutional memory)

| Bug | Where | How caught |
|---|---|---|
| IEB's async drain loop started processing the first queued item inline, before a same-tick burst of other publishes finished enqueuing — defeating priority reordering | `InstitutionalEventBus.scheduleDrain()` | A deliberately-written priority-ordering test failed; fixed by deferring drain start to a microtask |
| `NoopEventPersistence`'s methods were declared with zero parameters, causing call-site arity errors under strict type-check (invisible to vitest's transpile-only runner) | `core/event_bus/src/persistence.ts` | Full `tsc` type-check (src + tests), run separately from `vitest run` |
| IRBLM's dependency check used `this.instances.has(dep)`, which doesn't distinguish "created" from "successfully initialized" — a dependency that threw during `initialize()` was still treated as available to its dependents | `RuntimeOrchestrator.runBootSequence()` | An explainability test expected a "missing dependency" reason and got an empty string instead |

These are recorded here, not just fixed silently, because the pattern (full type-check catching what test runners alone miss; testing failure-explainability paths surfaces real logic bugs, not just typos) is worth repeating in every future program.
