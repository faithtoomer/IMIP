# IMIP PHASE 01

# Institutional System Architecture & Runtime Blueprint

## Master Runtime Specification

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Specification Only

---

# 1. Purpose

Define the complete runtime architecture of the Institutional Mining Intelligence Platform (IMIP).

This specification establishes:

* Runtime topology
* Authority hierarchy
* Decision pipeline
* Event pipeline
* Data ownership
* Dependency rules
* Runtime lifecycle
* Capability registration
* Plugin discovery
* AI integration points

No production mining logic shall be implemented during this phase.

This phase creates the architectural backbone for every future phase.

---

# 2. Mission

The Institutional Mining Intelligence Platform (IMIP) shall operate as an intelligent orchestration platform.

It does not perform mining directly.

Instead it coordinates:

* Hardware
* Mining adapters
* Mining software
* Decision intelligence
* Machine learning
* Profitability
* Thermal safety
* Power management
* Workload management
* Dashboard
* External APIs

The architecture must remain independent of any individual cryptocurrency.

---

# 3. Architectural Principles

The runtime shall be:

* Event-driven
* Authority-based
* Capability-driven
* Plugin-oriented
* Coin-agnostic
* Deterministic
* Explainable
* Observable
* Horizontally scalable
* AI-augmented (never AI-controlled)

---

# 4. Runtime Topology

Cursor shall define the following runtime topology.

```text
User
 │
 ▼
Dashboard
 │
 ▼
REST / WebSocket API
 │
 ▼
Decision Intelligence Engine
 │
 ▼
Authority Coordination Layer
 │
 ├── Configuration
 ├── Hardware
 ├── Telemetry
 ├── Profitability
 ├── Scheduler
 ├── Thermal
 ├── Power
 ├── Health
 ├── Plugin Registry
 ├── Workload
 └── Security
 │
 ▼
Plugin Manager
 │
 ├── CPU Plugins
 └── GPU Plugins
 │
 ▼
Mining Adapter Layer
 │
 ▼
Mining Software
 │
 ▼
Mining Pools
```

No authority may bypass this runtime.

See `architecture/diagrams/runtime-topology.md`.

---

# 5. Runtime Layers

Cursor shall formally define the following runtime layers.

## Layer 1 — Presentation Layer

Responsibilities: Dashboard, CLI, API, Notifications.

## Layer 2 — Decision Layer

Responsibilities: Decision Intelligence Engine, Decision Graph, Explainability, Policy Evaluation.

## Layer 3 — Institutional Authority Layer

Contains every institutional authority. Authorities own all operational decisions.

## Layer 4 — Capability Layer

Contains: Capability Registry, Plugin Registry, Hardware Registry, Mining Registry.

## Layer 5 — Plugin Layer

Contains mining implementations. No platform logic.

## Layer 6 — Mining Adapter Layer

Responsible for communication with mining software.

## Layer 7 — External Layer

Mining software, Pools, Wallets, Operating System, Drivers.

---

# 6. Runtime Lifecycle

Cursor shall define the runtime lifecycle.

```text
System Boot
    ↓
Configuration Loaded
    ↓
Capability Registry Initialized
    ↓
Hardware Discovery
    ↓
Plugin Discovery
    ↓
Authority Initialization
    ↓
Decision Engine Ready
    ↓
Mining Evaluation
    ↓
Authorization
    ↓
Mining Started
    ↓
Continuous Monitoring
    ↓
Decision Reevaluation
    ↓
Optimization
    ↓
Graceful Shutdown
```

Every stage shall be documented.

---

# 7. Institutional Authority Registry

Cursor shall establish the master authority registry.

Authorities include at minimum:

Configuration Authority, Hardware Authority, Capability Registry Authority, Plugin Registry Authority, Mining Authority, Decision Intelligence Authority, Profitability Authority, Power Authority, Thermal Authority, Health Authority, Scheduler Authority, Telemetry Authority, Database Authority, Security Authority, Workload Authority, Notification Authority, Earnings Authority, Policy Authority, Machine Learning Authority (future).

Each authority shall include:

Mission, Responsibilities, Owned State, Dependencies, Published Events, Consumed Events, Interfaces, Metrics, Health Checks, Certification Requirements.

Implementation is deferred to later phases.

See `architecture/AUTHORITY_REGISTRY.md`.

---

# 8. Dependency Laws

Authorities may only depend on approved interfaces.

No circular dependencies.

No shared mutable state.

No direct plugin interaction.

Authorities communicate only through:

Event Bus, Interfaces, Approved authority contracts.

---

# 9. Capability Registry

Cursor shall reserve the architecture for a Platform Capability Registry.

The registry owns:

Registered Authorities, Registered Plugins, Registered Hardware, Supported Algorithms, Supported Mining Software, AI Models, Decision Policies, Capability Metadata.

The registry becomes the discovery mechanism for the entire platform.

See `architecture/contracts/CAPABILITY_REGISTRY_SPEC.md`.

---

# 10. Event Bus Architecture

Cursor shall define the institutional event model.

Every authority publishes events.

Every authority subscribes only to approved events.

No direct event coupling.

Minimum event categories:

Hardware, Mining, Thermal, Power, Decision, Profitability, Security, Health, AI, Notifications, Scheduler, Configuration.

See `architecture/diagrams/event-flow.md`.

---

# 11. Decision Pipeline

Every mining decision shall follow the institutional decision pipeline.

```text
Hardware State
    ↓
Capability Evaluation
    ↓
Policy Evaluation
    ↓
Workload Evaluation
    ↓
Thermal Evaluation
    ↓
Power Evaluation
    ↓
Profitability Evaluation
    ↓
Decision Intelligence
    ↓
Authorization
    ↓
Mining Authority
    ↓
Mining Adapter
    ↓
Mining Software
    ↓
Mining Pool
```

This pipeline shall never be bypassed.

See `architecture/contracts/DECISION_PIPELINE.md`.

---

# 12. Explainability Pipeline

Every decision shall generate:

Decision, Reason, Evidence, Supporting Metrics, Confidence, Alternative Options, Rejected Alternatives, Timestamp, Responsible Authority, Execution Duration.

These records become part of the permanent audit trail.

See `architecture/contracts/EXPLAINABILITY_PIPELINE.md`.

---

# 13. Runtime State Machine

Cursor shall define institutional runtime states.

Startup, Idle, Evaluating, Authorized, Mining, Paused, Cooling, Maintenance, Shutdown, Recovery, Error.

Transitions shall be explicitly documented.

See `architecture/diagrams/state-machine.md`.

---

# 14. AI Integration Points

Machine learning shall integrate only through approved interfaces.

AI may provide: Predictions, Rankings, Forecasts, Recommendations, Confidence Scores.

AI may not: Control hardware, Override authorities, Override policy, Start mining, Stop mining.

---

# 15. Deliverables

Cursor shall produce:

1. Complete runtime blueprint.
2. Authority relationship diagram.
3. Runtime topology diagram.
4. Event flow diagram.
5. Dependency graph.
6. State machine diagram.
7. Capability registry specification.
8. Plugin discovery architecture.
9. Decision pipeline.
10. Explainability pipeline.

No source code beyond architecture artifacts should be produced.

---

# 16. Institutional Policy Engine (Architect Addition)

Before any mining authority is implemented, one more foundational component is reserved:

```text
core/
    policy_engine/
```

The Policy Engine becomes the single authority for operational rules such as:

* Minimum acceptable profitability
* Maximum GPU temperature
* Allowed mining schedules
* Preferred hardware allocation
* Manual overrides
* Energy-saving modes
* Safety policies

Every decision in IMIP shall be evaluated against policy before execution. This keeps business rules separate from implementation logic and gives the platform one place to change operational behavior without rewriting authorities.

This directory is owned by the Policy Authority defined in §7. It is reserved only in Phase 01; no implementation is introduced.

See `core/policy_engine/README.md` and `architecture/adr/ADR-0004-policy-authority.md`.

---

# 17. Acceptance Criteria

Phase 01 is complete only when:

* The runtime architecture is fully documented.
* All authority boundaries are defined.
* All runtime layers are defined.
* The event architecture is specified.
* The capability registry architecture is specified.
* The runtime lifecycle is documented.
* The dependency graph contains no circular dependencies.
* The decision pipeline is complete.
* The explainability pipeline is complete.
* The architecture is implementation-ready.
* The Policy Authority slot is reserved without implementation.
