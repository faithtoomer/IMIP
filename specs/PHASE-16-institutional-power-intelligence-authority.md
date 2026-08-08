# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM III — RESOURCE INTELLIGENCE

## Phase 16

# Institutional Power Intelligence Authority (IPIA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Resource Intelligence Authority

> IPIA is the implementation name for the "Power Authority" entry in `architecture/AUTHORITY_REGISTRY.md` (PHASE-01 §7) — the same pattern established by ICMS for the Configuration Authority and IHIS for the Hardware Authority.

---

# 1. Mission Statement

The Institutional Power Intelligence Authority (IPIA) shall serve as the sole authority responsible for monitoring, governing, analyzing, optimizing, and explaining electrical power consumption throughout IMIP. IPIA transforms electrical power from a passive metric into an actively managed institutional resource. No authority shall independently monitor or control platform power consumption.

---

# 2. Mission Objectives

Power monitoring, profiling, budgeting, optimization recommendations, allocation recommendations, energy efficiency analysis, cost-aware power management, power history, explainable power decisions, and future dynamic power optimization support.

---

# 3. Institutional Principles

1. **Single Power Authority** — IPIA is the sole owner of power intelligence.
2. **Power Is a Managed Resource** — managed with the same rigor as CPU, GPU, memory, and storage.
3. **Measurement Before Optimization** — decisions based on measured data, never assumptions.
4. **Policy Governed** — IPIA measures and recommends; policy determines allowable actions.
5. **Explainability** — every power-related decision answers what/why/which/measurements/policy/outcome.
6. **Hardware Protection** — optimization shall never knowingly violate certified hardware operating limits.

---

# 4. Responsibilities

IPIA owns: power telemetry, device/platform power profiles, power history, energy cost calculations, power budgeting, power allocation recommendations, efficiency calculations, power events, power diagnostics, power explainability, and the Institutional Energy Digital Twin (IEDT).

IPIA does **not** own: mining strategy, thermal management, hardware discovery, runtime lifecycle, profitability decisions, hardware overclocking, or direct power-limit mutation.

---

# 5. Runtime Architecture

```text
Hardware Sensors / Telemetry Providers
        │
        ▼
Institutional Power Intelligence Authority
        │
        ├──────── Power Registry
        ├──────── Telemetry Collector
        ├──────── Cost Engine
        ├──────── Efficiency Engine
        ├──────── Budget Manager
        ├──────── Diagnostics Engine
        ├──────── Recommendation Engine
        ├──────── Explainability Engine
        └──────── Institutional Energy Digital Twin (IEDT)
```

Orchestrated by `PowerAuthority.ts`. Module: `core/power_authority/`.

---

# 6. Power Registry

Every monitored device shall have a Power Profile (device UUID, type, current/average/peak/idle/max rated power, efficiency profile, cost profile, last updated, health status). The registry is authoritative.

---

# 7–9. Domains, Metrics, Cost

Monitor CPU, GPU, ASIC, and System domains. Collect instantaneous/average/peak watts, daily/monthly energy, energy per session/benchmark, and device efficiency. Historical metrics retained. Cost analysis integrates electricity rates and time-of-use pricing from Configuration Authority (injectable pricing provider).

---

# 10–12. Budgets, Efficiency, Recommendations

Configurable platform/GPU/CPU (and future rack/fleet) budgets; violations publish events. Efficiency metrics (hashes/watt, shares/kWh, revenue/kWh, cost/share, trends) are descriptive. Recommendations are **advisory only** — never execute hardware control.

---

# 13–15. Lifecycle, Events, Explainability

Lifecycle: Discovered → Profiled → Monitored → Analyzed → Optimized (Recommended) → Archived.  
Events: PowerProfileCreated, PowerUsageUpdated, PowerBudgetExceeded, PowerBudgetRecovered, EfficiencyCalculated, CostUpdated, RecommendationGenerated, PowerSensorUnavailable, PowerHealthChanged.  
Every assessment exposes device, measured values, trend, cost, efficiency, budget status, recommendation, and supporting measurements.

---

# 16–18. Interfaces, Errors, Performance

Controlled lookup interfaces for power/cost/efficiency/budget/history/recommendation/profile. Detect missing sensors, invalid/impossible telemetry, budget/cost failures, device communication failures. Track telemetry latency, registry update frequency, recommendation time, historical query performance, sensor availability, calculation latency.

---

# 19–21. Testing, Acceptance, ICS

Registry, telemetry, cost, budget, efficiency, recommendation, event, explainability, history, performance, and failure-recovery tests required. Phase complete only when profiles exist for monitored devices, registry is authoritative, telemetry/cost/efficiency/budget/recommendations/events/explainability work, tests pass, and documentation is complete. ICS: architecturally compliant, fully implemented/integrated/documented/typed/tested, runtime verified, performance benchmarked, explainability verified, production certified. Partial implementations prohibited.

---

# 22. Cursor Implementation Contract

Cursor SHALL implement IPIA exactly as specified; centralize power monitoring/analysis; maintain authoritative Power Registry; produce advisory recommendations only; integrate with Configuration Authority (pricing), Data Authority (historical persistence — interim local history until Database Authority exists), and Observability (interim metrics). Cursor SHALL NOT modify hardware power limits, duplicate telemetry elsewhere, make autonomous optimization decisions, bypass policy/decision authorities, or introduce placeholders.

---

# 23. Architect's Enhancement: Institutional Energy Digital Twin (IEDT)

IEDT continuously models platform electrical behavior relating hardware, real-time power, historical trends, electricity pricing, runtime state, mining sessions, benchmarks, efficiency, cost, and policy constraints. It is descriptive, predictive, and explainable — never directly controlling hardware.
