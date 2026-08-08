# Institutional Authority Registry

**Status:** Reserved — Structure Only (Phase 01)  
**Authority:** PHASE-01 §7 / `architecture/RUNTIME_ARCHITECTURE.md` §12

## Purpose

This is the master registry of every institutional authority in IMIP. Authorities own all operational decisions (Runtime Layer 3) and may only communicate through the Event Bus, interfaces, and approved authority contracts.

Full authority contracts (Responsibilities, Owned State, Dependencies, Published Events, Consumed Events, Interfaces, Metrics, Health Checks, Certification Requirements) are **deferred to authority-specific specifications** approved in later phases. Phase 01 fixes the authority list and each authority's one-line mission only.

## Registry

| Authority | Layer | Mission |
|-----------|-------|---------|
| Configuration Authority | Institutional Authority | Owns institutional configuration state and schema for platform and plugins. |
| Hardware Authority | Institutional Authority | Owns hardware discovery, inventory, and capability reporting. |
| Benchmark Authority | Institutional Authority | Owns institutional benchmark catalog, lifecycle orchestration, comparison, explainability, and the Institutional Performance Knowledge Base (IPKB), while delegating certified raw per-device result persistence to IHIS. Implemented as IBIA (`core/benchmark_authority/`, PHASE-21). |
| Hardware Certification Authority | Institutional Authority | Sole authority for deterministic, evidence-driven hardware readiness, reliability, compatibility, and production-eligibility certification, including the Institutional Hardware Trust Model (IHTM). Implemented as IHCA (`core/certification_authority/`, PHASE-23). |
| Capability Registry Authority | Capability | Owns the Platform Capability Registry (PCR); authoritative inventory of platform capabilities. |
| Plugin Registry Authority | Capability | Owns plugin discovery, manifest validation, and plugin registration. |
| Mining Authority | Institutional Authority | Owns authorization and control of mining operations via the Mining Adapter Layer. |
| Decision Intelligence Authority | Decision | Owns the Decision Engine, decision graph, and policy evaluation orchestration. |
| Profitability Authority | Institutional Authority | Owns profitability calculation and evaluation. |
| Power Authority (IPIA) | Institutional Authority | Owns power monitoring, energy cost/efficiency analysis, power budgeting, advisory power recommendations, and the Institutional Energy Digital Twin (IEDT). Implemented as IPIA (`core/power_authority/`, PHASE-16). |
| Thermal Authority (ITIA) | Institutional Authority | Owns thermal telemetry, trend/forecast/anomaly analysis, thermal budgeting, advisory thermal recommendations, and the Institutional Thermal Digital Twin (ITDT). Implemented as ITIA (`core/thermal_authority/`, PHASE-17). |
| Resource Authority (IRIA) | Institutional Authority | Owns resource registry, availability, allocation, reservation, ownership/leasing, utilization, capacity forecasting, and the Institutional Resource Digital Twin (IRDT). Implemented as IRIA (`core/resource_authority/`, PHASE-18). |
| Resource Arbitration Authority (IRAA) | Institutional Authority | Resolves competing resource allocation requests through deterministic, explainable policy decisions while IRIA retains allocation ownership. Implemented as IRAA (`core/arbitration_authority/`, PHASE-22). |
| Health Authority (IHIA) | Institutional Authority | Owns institutional cross-cutting health registry, configurable scoring, reliability/trend analysis, advisory failure forecasting, explainability, and the Institutional Health Digital Twin (IHDT). Implemented as IHIA (`core/health_authority/`, PHASE-20). |
| Scheduler Authority | Institutional Authority | Owns mining schedules and workload timing. |
| Telemetry Authority | Institutional Authority | Owns telemetry collection and distribution. |
| Database Authority | Institutional Authority | Owns data persistence and the permanent audit trail. |
| Security Authority | Institutional Authority | Owns platform security policy and enforcement. |
| Workload Authority | Institutional Authority | Owns workload governance, classification, lifecycle, priorities, advisory placement recommendations, balancing, efficiency analysis, explainability, and the Institutional Workload Digital Twin (IWDT). Implemented as IWIA (`core/workload_authority/`, PHASE-19). |
| Notification Authority | Institutional Authority | Owns institutional notifications and alerting. |
| Earnings Authority | Institutional Authority | Owns earnings tracking and reporting. |
| Policy Authority | Institutional Authority | Owns operational policy evaluation via the Policy Engine (`core/policy_engine/`); every decision is evaluated against policy before execution. |
| Machine Learning Authority (future) | Decision (augmentation) | Owns AI predictions, rankings, forecasts, and confidence scores; augments but never controls decisions. |

## Authority Contract Template (for future per-authority specs)

Every authority-specific specification shall define:

1. Mission
2. Responsibilities
3. Owned State
4. Dependencies
5. Published Events
6. Consumed Events
7. Interfaces
8. Metrics
9. Health Checks
10. Certification Requirements

## Rules

- No authority may be implemented without an approved authority-specific specification under `specs/`.
- No authority may depend on another authority except through the Event Bus, interfaces, or approved authority contracts.
- No circular dependencies between authorities.
- No authority interacts with plugins directly (see `contracts/PLUGIN_DISCOVERY_ARCHITECTURE.md`).

## Phase 01 Constraint

This registry is structural only. No authority logic, state, or interface is implemented in Phase 01.
