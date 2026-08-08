# Phase 02 — Configuration / Policy Boundary Mapping

**Authority:** PHASE-02 §20 / ADR-0006 / ADR-0007

Full key-by-key disposition of every value listed in the original PHASE-02 v1.0 §3 draft. As of v2.0 (ICMS), this is now one half of a three-way split — see ADR-0007 for the added Operational State category and `security-classification.md` for the current 5-tier classification (superseding the "sensitive" tag used below, which now maps to secret/restricted).

## Implemented as Configuration (`core/configuration_authority/src/registry.ts`)

| Category | Keys |
|---|---|
| Platform | name, version, runtimeMode, environment, logLevel, debugMode, locale, timezone |
| Mining | enabled, preferredMode, idleTimeout |
| Electricity | rate, currency, billingModel, timeOfUseSchedule, peakPricing, offPeakPricing |
| Hardware | reservedCpuCores, reservedGpus |
| Pools | endpoints, backupPools, poolPriorities |
| Wallet | addresses (secret), payoutPreferences (restricted), minimumPayout, labels |
| AI | enabled, provider, modelSelection, recommendationConfidenceThreshold, learningMode, historicalWindow |
| Dashboard | refreshInterval, theme, notificationPreferences, metricsDisplayed |
| Database | storageBackend, retentionPeriod, compression, backupInterval |
| Telemetry | samplingInterval, metricsInterval, loggingPolicy, exportPolicy |

44 entries total.

## Deferred to the Policy Authority (not implemented in Phase 02)

| Original §3 value | Deferred as |
|---|---|
| Profit threshold | Policy: minimum-profitability gate |
| Minimum profitability | Policy: minimum-profitability gate |
| Mining schedule | Policy: scheduling rule |
| Auto-start policy | Policy: conditional start rule |
| Auto-stop policy | Policy: conditional stop rule |
| Maximum CPU utilization | Policy: hardware safety limit |
| Maximum GPU utilization | Policy: hardware safety limit |
| Thermal limits | Policy: hardware safety limit |
| Power limits | Policy: hardware safety limit |
| Fan policies | Policy: conditional hardware behavior |
| Pool failover rules | Policy: conditional failure-handling rule |
| Pool retry policy | Policy: conditional failure-handling rule |

These values have no owner until an approved Policy Authority specification implements `core/policy_engine/` (reserved, Phase 01). This table — together with ADR-0006 — is the record that they were considered and intentionally deferred, not omitted by oversight.

## Categories reserved, not yet populated

`security`, `notifications`, `plugins` (populated per-plugin via `pluginConfig.ts`, none registered by core in Phase 02), and `policies` (intentionally empty — policy *values* belong to the Policy Authority, not Configuration).

## Third category: Operational State (ADR-0007)

Live/observed values — current temperature, active miner, current profitability, live hash rate — belong to neither Configuration nor Policy. They are Operational State, owned by future Telemetry/Health/Profitability/Mining Authorities. ICMS's own "which snapshot is active" is the sole self-referential exception and must not expand into a general operational-state store.
