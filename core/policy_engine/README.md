# Policy Engine

**Status:** RESERVED — Not Implemented (Phase 01)  
**Location:** `core/policy_engine/`  
**Authority:** PHASE-01 §16 (Architect's Addition) / ADR-0004

## Purpose

The Policy Engine is the single authority for operational rules, owned by the Policy Authority (`architecture/AUTHORITY_REGISTRY.md`):

- Minimum acceptable profitability
- Maximum GPU temperature
- Allowed mining schedules
- Preferred hardware allocation
- Manual overrides
- Energy-saving modes
- Safety policies

## Architectural Rule

Every decision in the institutional Decision Pipeline (`architecture/contracts/DECISION_PIPELINE.md`) is evaluated against policy before execution (Policy Evaluation stage).

Business rules stay separate from implementation logic. Operational behavior changes by updating policy, not by rewriting authorities.

## Phase 01 Constraint

This directory is reserved only.

- No production module is written here in Phase 01.
- No placeholder implementation is introduced.
- Future implementation requires an approved specification under `specs/`.
