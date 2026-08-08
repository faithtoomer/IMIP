# ADR-0006: Configuration / Policy Boundary

**Status:** Accepted  
**Date:** 2026-08-07  
**Phase:** 02  
**Deciders:** Architectural Authority (Specification)

## Context

PHASE-02 §3 (as drafted) assigns some conditional, operational values — profit thresholds, thermal/power limits, mining schedules, auto-start/stop behavior, pool failover rules — to the Configuration Authority. The same specification's Architect's Enhancement explicitly reclassifies exactly this kind of value as Policy: *"Configuration answers what the system is configured to do; Policy answers under what conditions the system is allowed to act."*

Implementing both as written would create two conflicting owners for the same conceptual values, violating the SSOT principle the Configuration Authority exists to enforce.

## Decision

The Architect's Enhancement takes precedence over the literal §3 list. The Configuration Authority registry implements only system-state values. The following are excluded from Phase 02 and deferred to the Policy Authority (`core/policy_engine/`, reserved since Phase 01):

| Deferred value | Rationale |
|---|---|
| Profit threshold / minimum profitability | Conditional gate on whether mining is allowed to start |
| Mining schedule | Conditional rule on when mining is allowed to run |
| Auto-start policy / auto-stop policy | Conditional rule on system behavior |
| Maximum CPU / GPU utilization | Safety limit gating hardware use |
| Thermal limits | Safety limit gating hardware use |
| Power limits | Safety limit gating hardware use |
| Fan policies | Conditional hardware behavior |
| Pool failover rules | Conditional behavior under failure |
| Pool retry policy | Conditional behavior under failure |

`wallet.minimumPayout` and `hardware.reservedCpuCores` / `hardware.reservedGpus` remain Configuration: they are static values (a threshold amount, a fixed allocation list), not conditional rules about when the system is allowed to act.

## Consequences

- The Configuration Registry (`core/configuration_authority/src/registry.ts`) contains no profitability, thermal, power, scheduling, or failover keys.
- These values have no owner until a future approved Policy Authority specification implements `core/policy_engine/`. They are not silently dropped — this ADR and `docs/phase-02/configuration-policy-boundary.md` are the record of record until then.
- Any later attempt to add these keys to the Configuration Registry is a governance violation of this ADR and requires a superseding decision.
