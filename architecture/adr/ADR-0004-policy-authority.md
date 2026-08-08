# ADR-0004: Policy Authority & Policy Engine Reservation

**Status:** Accepted (Reserved)  
**Date:** 2026-08-07  
**Phase:** 01  
**Deciders:** Architectural Authority (Specification)

## Context

Every institutional decision in IMIP (thermal, power, profitability, scheduling, hardware allocation) is ultimately bounded by operational business rules — minimum profitability, maximum temperature, allowed schedules, manual overrides, energy-saving modes, safety limits. Without a single owner for these rules, they would be duplicated or hardcoded across authorities, violating the institutional-service-uniqueness principle.

## Decision

Reserve `core/policy_engine/` as the home of the Policy Authority (already listed in the PHASE-01 §7 Institutional Authority Registry).

The Policy Authority owns:

- Minimum acceptable profitability
- Maximum GPU temperature
- Allowed mining schedules
- Preferred hardware allocation
- Manual overrides
- Energy-saving modes
- Safety policies

Every decision in the institutional Decision Pipeline (`architecture/contracts/DECISION_PIPELINE.md`) shall include a Policy Evaluation stage before execution.

## Phase 01 Scope

- Directory reserved: `core/policy_engine/`
- Implementation deferred to a future approved specification
- No production module written in Phase 01

## Consequences

- Business rules stay separate from implementation logic across every authority.
- Operational behavior can change by updating policy, without rewriting authorities.
- The Decision Pipeline gains a mandatory, non-bypassable Policy Evaluation stage.
