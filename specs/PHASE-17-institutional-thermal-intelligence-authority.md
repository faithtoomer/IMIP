# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM III — RESOURCE INTELLIGENCE

## Phase 17

# Institutional Thermal Intelligence Authority (ITIA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Resource Intelligence Authority

> ITIA is the implementation name for the "Thermal Authority" entry in `architecture/AUTHORITY_REGISTRY.md` (PHASE-01 §7).

---

# 1. Mission Statement

The Institutional Thermal Intelligence Authority (ITIA) shall serve as the sole authority responsible for monitoring, modeling, analyzing, forecasting, and explaining thermal behavior throughout IMIP. ITIA transforms thermal management from passive temperature monitoring into institutional thermal intelligence. No authority shall independently monitor or analyze platform thermal behavior.

---

# 2. Mission Objectives

Thermal telemetry, profiling, trend analysis, budgeting, forecasting, thermal efficiency analysis, anomaly detection, diagnostics, explainable thermal recommendations, and future predictive thermal optimization support.

---

# 3. Institutional Principles

1. **Single Thermal Authority** — ITIA is the sole owner of thermal intelligence.
2. **Thermal Behavior Is a Managed Resource** — temperature is never viewed in isolation.
3. **Observation Before Recommendation** — recommendations based on measured thermal evidence.
4. **Hardware Protection First** — no recommendation knowingly places hardware outside certified limits.
5. **Explainability** — every assessment answers what/why/device/sensors/trend/recommendation.
6. **Predictive Awareness** — historical thermal behavior informs future recommendations.

---

# 4. Responsibilities

ITIA owns: thermal telemetry, profiles, history, diagnostics, budgets, trend analysis, forecasting, anomaly detection, recommendation generation, thermal explainability, thermal events, and the Institutional Thermal Digital Twin (ITDT).

ITIA does **not** own: fan/clock/voltage control, mining strategy, runtime lifecycle, or hardware discovery.

---

# 5. Runtime Architecture

```text
Hardware Sensors
        │
        ▼
Institutional Thermal Intelligence Authority
        │
        ├──────── Thermal Registry
        ├──────── Sensor Manager
        ├──────── Trend Analyzer
        ├──────── Forecast Engine
        ├──────── Budget Manager
        ├──────── Anomaly Detector
        ├──────── Recommendation Engine
        ├──────── Explainability Engine
        └──────── Institutional Thermal Digital Twin (ITDT)
```

Orchestrated by `ThermalAuthority.ts`. Module: `core/thermal_authority/`.

---

# 6–9. Registry, Domains, Metrics, Budgets

Thermal Profile fields: device UUID/type, current/core/memory/hotspot/VRM/ambient/idle/average/peak temperatures, fan speed, thermal state, last updated. Domains: CPU, GPU, ASIC, Platform. Metrics: instantaneous/average/peak/min temperature, variance, stability, fan utilization, thermal efficiency, time above/below threshold. Budgets (operating/warning/critical targets) originate from Configuration Authority via injectable budget provider; violations publish events.

---

# 10–13. Trends, Forecast, Anomalies, Recommendations

Trend: slope, heat accumulation, cooling rate, cycling frequency, daily/weekly/seasonal trends. Forecast: expected temperature, time-to-warning/critical, cooling requirements, long-term drift — advisory. Anomalies: spikes, sensor failures, cooling degradation, fan anomalies, oscillation, abnormal heating, unexpected idle temps. Recommendations are advisory only.

---

# 14–16. Lifecycle, Events, Explainability

Lifecycle: Discovered → Profiled → Monitored → Analyzed → Forecasted → Recommendations Generated → Archived.  
Events: ThermalProfileCreated, TemperatureUpdated, ThermalWarning, ThermalCritical, ThermalRecovered, ThermalBudgetExceeded, ThermalForecastGenerated, ThermalRecommendationGenerated, ThermalSensorUnavailable, ThermalAnomalyDetected.  
Assessments expose device, sensors, trend, budget, forecast, recommendation, evidence.

---

# 17–22. Interfaces through ICS / Contract

Controlled lookup interfaces; no direct thermal control. Detect missing/invalid sensors, drift, impossible values, forecast failures, registry inconsistencies. Performance metrics exposed to Observability (interim local). Full test suite required. Acceptance and ICS matching Phase 16 standard. Cursor SHALL NOT modify fans/clocks/voltages, duplicate telemetry, make autonomous control decisions, bypass policy/decision authorities, or introduce placeholders. Integrate with IHIS (sensor acquisition via injectable providers), Data Authority (interim history), Observability, and IPIA (cross-domain efficiency via injectable power snapshot provider).

---

# 23. Architect's Enhancement: Institutional Thermal Digital Twin (ITDT)

ITDT models complete thermal behavior combining real-time sensors, historical trends, power consumption (from IPIA), fan performance, ambient conditions, mining workload, hardware characteristics, runtime state, and maintenance history. Descriptive and predictive — never controlling hardware.
