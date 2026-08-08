# Program I — Configuration Catalog

Full detail already lives in `docs/phase-02/configuration-policy-boundary.md` (key-by-key mapping) and `docs/phase-02/security-classification.md` (5-tier classification). This is the consolidated summary.

## 44 Registered Keys by Category

| Category | Keys | Count |
|---|---|---|
| Platform | name, version, runtimeMode, environment, logLevel, debugMode, locale, timezone | 8 |
| Mining | enabled, preferredMode, idleTimeout | 3 |
| Electricity | rate, currency, billingModel, timeOfUseSchedule, peakPricing, offPeakPricing | 6 |
| Hardware | reservedCpuCores, reservedGpus | 2 |
| Pools | endpoints, backupPools, poolPriorities | 3 |
| Wallet | addresses, payoutPreferences, minimumPayout, labels | 4 |
| AI | enabled, provider, modelSelection, recommendationConfidenceThreshold, learningMode, historicalWindow | 6 |
| Dashboard | refreshInterval, theme, notificationPreferences, metricsDisplayed | 4 |
| Database | storageBackend, retentionPeriod, compression, backupInterval | 4 |
| Telemetry | samplingInterval, metricsInterval, loggingPolicy, exportPolicy | 4 |

## Security Classification (5-tier)

| Tier | Count | Masked? |
|---|---|---|
| Public | 29 | No |
| Internal | 13 | No (operational detail, excluded from external surfaces by convention, not redaction) |
| Restricted | 1 (`wallet.payoutPreferences`) | Yes |
| Secret | 1 (`wallet.addresses`) | Yes |
| Confidential | 0 (tier exists, unused today) | Yes |

## The Configuration / Policy / Operational-State Boundary

This is Program I's most consequential taxonomy decision (ADR-0006, extended by ADR-0007) — it governs where *every future* value gets registered, not just today's 44:

| Question the value answers | Owner | Example |
|---|---|---|
| What is the platform configured to do? | Configuration Authority (ICMS) | Wallet addresses, electricity rate, pool endpoints |
| Under what conditions is the platform allowed to act? | Policy Authority (`core/policy_engine/`, reserved) | Minimum profitability, thermal/power limits, schedules |
| What is the platform's live, observed condition right now? | Future Telemetry/Health/Profitability/Mining Authorities | Current temperature, active miner, current profitability |

9 values that a literal reading of the original Phase 02 draft would have put in Configuration are deliberately **not** registered there — profit threshold, minimum profitability, mining schedule, auto-start/stop policy, max CPU/GPU utilization, thermal limits, power limits, fan policies, pool failover/retry rules. They have no owner yet (Policy Authority is reserved) but are named explicitly in `docs/phase-02/configuration-policy-boundary.md`, not silently dropped.

## Schema Versioning

Current schema version `2.0.0` (`CURRENT_SCHEMA_VERSION`, `core/configuration_authority/src/registry.ts`) — bumped from `1.0.0` for the security-classification model upgrade (2-tier → 5-tier). No value shapes changed, so the migration framework (`MigrationRunner`) ships with zero registered migrations for this bump — a real, tested, complete framework with nothing to apply yet, not an unfinished one.
