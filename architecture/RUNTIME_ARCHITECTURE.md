# IMIP Runtime Architecture

**Version:** 1.0  
**Phase:** 01  
**Status:** Binding  
**Authority:** Institutional Engineering Specification PHASE-01

---

## 1. Purpose

This document establishes the permanent runtime architecture for the Institutional Mining Intelligence Platform (IMIP). Every future authority implementation depends on these rules. They may not be altered without architectural approval.

---

## 2. Runtime Topology

The runtime follows a single, fixed topology: Presentation → Decision → Institutional Authority → Capability → Plugin → Mining Adapter → External.

No authority, plugin, or interface may bypass this runtime.

See `diagrams/runtime-topology.md` for the full diagram.

---

## 3. Runtime Layers

| Layer | Name | Contains |
|-------|------|----------|
| 1 | Presentation | Dashboard, CLI, API, Notifications |
| 2 | Decision | Decision Intelligence Engine, Decision Graph, Explainability, Policy Evaluation |
| 3 | Institutional Authority | Every institutional authority; owns all operational decisions |
| 4 | Capability | Capability Registry, Plugin Registry, Hardware Registry, Mining Registry |
| 5 | Plugin | Mining implementations only; no platform logic |
| 6 | Mining Adapter | Communication with mining software |
| 7 | External | Mining software, pools, wallets, OS, drivers |

---

## 4. Runtime Lifecycle

```text
System Boot → Configuration Loaded → Capability Registry Initialized → Hardware Discovery
  → Plugin Discovery → Authority Initialization → Decision Engine Ready → Mining Evaluation
  → Authorization → Mining Started → Continuous Monitoring → Decision Reevaluation
  → Optimization → Graceful Shutdown
```

Every stage is binding. Skipping a stage is a governance violation.

---

## 5. Dependency Laws

- Authorities may only depend on approved interfaces.
- No circular dependencies.
- No shared mutable state.
- No direct plugin interaction by an authority.
- Authorities communicate only through: Event Bus, Interfaces, Approved authority contracts.

See `diagrams/dependency-graph.md`.

---

## 6. Event Bus Architecture

- Every authority publishes events.
- Every authority subscribes only to approved events.
- No direct event coupling between authorities.
- Minimum event categories: Hardware, Mining, Thermal, Power, Decision, Profitability, Security, Health, AI, Notifications, Scheduler, Configuration.

See `diagrams/event-flow.md`.

---

## 7. Decision Pipeline

Every mining decision follows the fixed institutional decision pipeline defined in `contracts/DECISION_PIPELINE.md`. This pipeline shall never be bypassed.

---

## 8. Explainability Pipeline

Every decision produces an explainability record as defined in `contracts/EXPLAINABILITY_PIPELINE.md`. These records form the permanent audit trail, owned by the Database Authority.

---

## 9. Runtime State Machine

Institutional runtime states: Startup, Idle, Evaluating, Authorized, Mining, Paused, Cooling, Maintenance, Shutdown, Recovery, Error.

See `diagrams/state-machine.md` for transitions.

---

## 10. AI Integration Points

AI may provide: Predictions, Rankings, Forecasts, Recommendations, Confidence Scores.

AI may not: Control hardware, Override authorities, Override policy, Start mining, Stop mining.

AI integrates only through approved Decision Layer interfaces. AI is augmentation, never authority.

---

## 11. Policy Authority (Phase 01 Addition)

`core/policy_engine/` is reserved for the Policy Authority.

Every decision in the Decision Pipeline shall be evaluated against policy before execution (Policy Evaluation stage). Policy owns: minimum acceptable profitability, maximum GPU temperature, allowed mining schedules, preferred hardware allocation, manual overrides, energy-saving modes, safety policies.

See `adr/ADR-0004-policy-authority.md` and `core/policy_engine/README.md`.

**Phase 01 status:** Reserved only. Not implemented.

---

## 12. Authority Registry

The master list of institutional authorities, their mission, and their (deferred) contracts is maintained in `AUTHORITY_REGISTRY.md`.

---

## 13. Phase 01 Status

This document defines architecture only. No runtime code, authority implementation, plugin discovery code, or AI integration code is introduced in Phase 01.
