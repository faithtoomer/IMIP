# ADR-0003: Institutional Runtime Architecture

**Status:** Accepted  
**Date:** 2026-08-07  
**Phase:** 01  
**Deciders:** Architectural Authority (Specification)

## Context

Phase 00 established the repository structure. Before any authority, plugin behavior, or AI integration is implemented, IMIP needs one binding runtime blueprint so every later authority derives from the same architecture rather than being designed ad hoc.

## Decision

Adopt a runtime architecture that is event-driven, authority-based, capability-driven, plugin-oriented, coin-agnostic, deterministic, explainable, observable, horizontally scalable, and AI-augmented (never AI-controlled).

Establish:

- A fixed seven-layer runtime topology (Presentation → Decision → Institutional Authority → Capability → Plugin → Mining Adapter → External).
- A documented runtime lifecycle from system boot through graceful shutdown.
- Dependency laws: no circular dependencies, no shared mutable state, no direct plugin interaction by authorities; communication only through the Event Bus, interfaces, and approved authority contracts.
- A fixed decision pipeline that shall never be bypassed.
- An explainability pipeline that produces a permanent audit trail for every decision.
- A runtime state machine covering Startup, Idle, Evaluating, Authorized, Mining, Paused, Cooling, Maintenance, Shutdown, Recovery, and Error.
- AI integration boundaries: AI may predict, rank, forecast, recommend, and score confidence; AI may never control hardware, override authorities or policy, or start/stop mining.

## Consequences

- Every future authority specification must conform to this runtime architecture.
- No authority, plugin, or interface may bypass the runtime topology or decision pipeline.
- Adding a new authority, plugin, or AI model is a registration/contract exercise, not a runtime redesign.
- This ADR is binding; changes require architectural approval and a superseding ADR.
