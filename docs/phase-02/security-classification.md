# Phase 02 — Security Classification Mapping

**Authority:** PHASE-02 §13 / `core/configuration_authority/src/security.ts`

## Tiers and masking threshold

| Tier | Masked (logs/telemetry/exceptions/explainability/provenance)? |
|---|---|
| Public | No |
| Internal | No — operational detail, excluded from external surfaces by the consumer, not by ICMS redaction |
| Confidential | Yes |
| Restricted | Yes |
| Secret | Yes |

`shouldMask()` in `security.ts` is the single source of truth for this threshold.

## Registry classification (44 entries)

| Tier | Keys |
|---|---|
| Secret | `wallet.addresses` |
| Restricted | `wallet.payoutPreferences` |
| Internal | `electricity.rate`, `electricity.currency`, `electricity.billingModel`, `electricity.timeOfUseSchedule`, `electricity.peakPricing`, `electricity.offPeakPricing`, `pools.endpoints`, `pools.backupPools`, `pools.poolPriorities`, `database.storageBackend`, `ai.provider`, `ai.modelSelection`, `wallet.labels` |
| Public | Everything else (29 entries): all `platform.*`, all `mining.*`, `hardware.reservedCpuCores`, `hardware.reservedGpus`, all `dashboard.*`, all `telemetry.*`, `ai.enabled`, `ai.recommendationConfidenceThreshold`, `ai.learningMode`, `ai.historicalWindow`, `database.retentionPeriod`, `database.compression`, `database.backupInterval`, `wallet.minimumPayout` |

## "Encrypted at rest where supported" (§13)

ICMS does not itself persist secret values anywhere by default — no config-file writer, no built-in secrets-store writer. The `SecretsProvider` interface is pluggable; encryption-at-rest is the responsibility of whatever concrete provider is wired in later (OS keychain, vault, etc.), which is out of scope until such a provider is implemented. Values that flow through ICMS are always masked before being written to the audit trail or exposed via provenance — nothing sensitive is written to disk by ICMS itself today.
