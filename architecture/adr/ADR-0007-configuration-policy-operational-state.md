# ADR-0007: Configuration / Policy / Operational State Boundary

**Status:** Accepted  
**Date:** 2026-08-07  
**Phase:** 02 (v2.0 — ICMS)  
**Deciders:** Architectural Authority (Specification)  
**Supersedes (extends):** ADR-0006

## Context

ADR-0006 split Configuration from Policy: Configuration is system state, Policy is conditional operational rules. The PHASE-02 v2.0 (ICMS) Architect's Addendum adds a third concept — **Operational State**: the live, observed condition of the running platform (current temperature, active miner, current profitability, which snapshot happens to be active right now). Without naming this third category explicitly, there's a real risk of ICMS accreting "just one live status field" over time until it silently becomes a telemetry store, violating Law 1 (Single Ownership) against whichever authority should actually own that data (Telemetry, Health, Profitability, Mining).

## Decision

Formalize a three-way boundary:

| Concept | Answers | Owner | Example |
|---|---|---|---|
| Configuration | What is the platform configured to do? | ICMS (`core/configuration_authority/`) | Wallet addresses, electricity rate, pool endpoints |
| Policy | Under what conditions is the platform allowed to act? | Policy Authority (`core/policy_engine/`, reserved) | Minimum profitability, thermal limits, schedules |
| Operational State | What is the platform's live, observed condition right now? | Telemetry / Health / Profitability / Mining Authorities (not yet implemented) | Current GPU temperature, active miner, current profitability, live hash rate |

ICMS's own notion of "current snapshot" (which configuration snapshot is active) is a narrow, self-referential exception: it is metadata about ICMS's own state, not a general-purpose operational-state store. ICMS must not grow additional live/observed fields beyond that.

## Consequences

- No future authority may push live/observed telemetry-shaped values into the Configuration Registry, even for convenience ("just one status field").
- The Configuration/Policy key mapping in ADR-0006 is unchanged; this ADR adds the third category on top of it.
- When Telemetry, Health, Profitability, and Mining Authorities are implemented, they own Operational State; ICMS's role stays confined to configuration and its own snapshot/provenance bookkeeping.
