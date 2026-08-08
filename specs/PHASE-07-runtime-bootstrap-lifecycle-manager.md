# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM I — FOUNDATION

## Phase 07

# Institutional Runtime Bootstrap & Lifecycle Manager (IRBLM)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Foundational Runtime Authority

> There is no `PHASE-06-*.md` — Phase 06 was never specified. Phase 07 is Program I's capstone regardless, per the user's framing.
>
> IRBLM is new — unlike ICMS/IHIS (Phase 02/03), which mirror onto the IEB for backward compatibility (ADR-0009 §6), IRBLM has no legacy synchronous API to preserve, so it uses the IEB as its sole, direct event mechanism (Law 1, fully realized for a new authority).

---

# 1. Mission Statement

IRBLM is the sole authority responsible for assembling, validating, initializing, supervising, and gracefully shutting down IMIP. No authority initializes itself outside the Runtime Bootstrap process; no authority bypasses the Runtime Lifecycle.

---

# 2–4. Objectives, Principles, Responsibilities

See `core/runtime_bootstrap/README.md` for the mapping of §2's objectives, §3's six Laws, and §4's ownership boundaries onto concrete modules. Summary: IRBLM owns bootstrap sequencing, dependency verification, readiness/certification, lifecycle state, shutdown/restart/recovery, and runtime events/diagnostics. It owns no business logic, mining, scheduling, hardware discovery, or decision-making.

---

# 5. Runtime Architecture (Binding Scope Note)

The specification's diagram (Configuration Authority → Capability Registry → Plugin Registry → Event Bus → Runtime Bootstrap → ...) names components that don't all exist yet: **Capability Registry and Plugin Registry remain reserved** (ADR-0002; no Plugin Registry module exists at all). IRBLM is implemented **generically** — a dependency-graph-driven orchestrator over a `ComponentDefinition` contract (`types.ts`), with concrete adapters (`adapters.ts`) for the three authorities that actually exist today: the Institutional Event Bus (Phase 05), Configuration Authority / ICMS (Phase 02), and Hardware Authority / IHIS (Phase 03). Capability Registry and Plugin Registry will register the same way, in the correct dependency-resolved position, the moment they're implemented — zero changes to the orchestrator required.

---

# 6. Startup Lifecycle

Boot Requested → Configuration Loaded → Configuration Validated → [Capability Registry / Plugin Registry — not yet real, no-op today] → Event Bus Started → Authorities Initialized → Plugins Initialized → Dependency Verification → Readiness Verification → Runtime Certification → Operational.

Mapped to code in `RuntimeOrchestrator.runBootSequence()`: dependency-graph resolution (implicit dependency verification, `DependencyGraph.startupOrder()`) → per-component create+initialize (a distinct pass) → a **separate** readiness-verification pass (not merged into initialization — §16 lists "Initialization failures" and "Failed readiness checks" as distinct error categories) → `certifyRuntime()` → Operational.

---

# 7. Runtime Lifecycle States

`stopped | booting | initializing | validating | ready | operational | paused | maintenance | restarting | shutting-down | recovering | faulted` — `lifecycleStateMachine.ts`, with `recovering` reachable to either `operational` (in-place re-validation succeeds) or `booting` (full rebuild) depending on how recovery resolves.

---

# 8. Dependency Management

`DependencyGraph` — Kahn's-algorithm topological sort for startup order, its exact reverse for shutdown order, `MissingDependencyError`/`CircularDependencyError` on registration/resolution.

---

# 9. Readiness Verification

Every `ComponentDefinition` implements `checkReadiness()`. A component whose dependency failed to *initialize* (not just "was never created") is itself blocked — a real bug caught during testing and fixed (see `docs/phase-07/implementation-summary.md`).

---

# 10. Runtime Certification

`certifyRuntime()` — generic: requires every certified-pool component to be ready and not health-`faulted`. `degraded` health never blocks certification (§22's "degraded but still operational" is a first-class, intentional state, not an error).

---

# 11. Graceful Shutdown

`RuntimeOrchestrator.requestShutdown()` — reverse dependency order, one component's shutdown failure never blocks the others (best-effort, all failures reported, orchestrator still reaches `stopped`).

---

# 12. Restart Coordination

`requestRestart()` — full-platform (tear down + reboot, preserving audit/governance history) or single-component (documented as **not cascading to dependents** — a scope simplification, not silently done).

---

# 13. Runtime Events

All 14 named events (`BootstrapStarted` … `RuntimeFaulted`) published directly through the real IEB, category `runtime`, publisher `Runtime Bootstrap`.

---

# 14–15. Explainability & Public Interfaces

`getRuntimeState()`, `getCertificationStatus()`, `getRuntimeHistory()` (bounded, 200 entries), `getMetrics()`, plus the Governance Board's `whyUnavailable()`/`blockingComponents()`/`degradedComponents()`. Controlled interfaces: `requestShutdown()`, `requestRestart()`, `requestMaintenance()`, `pause()`, `resume()`, `recover()`.

---

# 16. Error Handling

`DuplicateComponentError`, `MissingDependencyError`, `CircularDependencyError`, `BootstrapFailedError`, `CertificationFailedError`, `InvalidLifecycleTransitionError`, `ComponentNotFoundError` — all typed, all structured. Law 6: strict mode (default) fails the whole boot on any component failure; `allowPartialStartup: true` is required, explicit policy to proceed without a failed component.

---

# 17. Runtime Metrics

`getMetrics()`: startup/init/readiness/shutdown/restart durations, per-component init times, uptime, recovery count — a read surface for a future Telemetry Authority (not yet implemented).

---

# 18–21. Testing, Acceptance, Completion, Contract

75 tests across 14 files. See `docs/phase-07/certification-checklist.md`.

---

# 22. Architect's Enhancement: Runtime Governance Board (RGB)

Implemented in full (not reserved, unlike Phase 05's EICE) — `governanceBoard.ts`. A continuously updated record per component (lifecycle state, readiness, health, dependency status, certification status, last init/failure, restart count, operational eligibility), independent of the one-time boot sequence, answering "why is X unavailable," "what blocked Operational," "what's degraded but still running" at any point in the platform's life.
