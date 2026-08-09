# ADR-0029: Institutional Mining Statistics Framework

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 29  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP requires a platform-wide telemetry layer that can turn already-normalized mining observations into trusted institutional evidence. The platform needs common metric identity/provenance, quality control, anomaly evidence, cross-entity aggregation, and historical rollups without making adapters own institutional analytics or making persistence/storage concerns leak into mining frameworks.

## Decision

- Implement IMSF in `core/mining_statistics_framework/` as a peer institutional framework with canonical schema, quality, anomaly, aggregation, rollup, explainability, session registry, events, and telemetry graph modules.
- Represent every ingest as an immutable canonical `StatisticsMetric` with a stable Metric UUID and explicit collection status.
- Add Event Bus category `mining-statistics` and logical Data Domains `mining-statistics` and `mining-statistics-rollup`.
- Use injected `StatisticsDataProvider`, `StatisticsRetentionProvider`, clock, and UUID contracts; do not import or instantiate upstream authority implementations.

## Statistics Framework Is Distinct From Adapter Normalization

IMAF's `NormalizedStatistics` is the per-adapter layer that translates one miner's raw output into a common shape. IMSF accepts that already-normalized vocabulary only as an input contract and maps numeric fields into canonical institutional records. It does not parse raw output, encode adapter-specific translation, infer units, or duplicate IMAF normalization logic. Canonical provenance, quality, anomalies, multi-level aggregates, rollups, and graph traceability are therefore a separate institutional concern above IMAF.

IMPM may supply a miner process UUID as provenance, but IMSF never imports, invokes, or manages Miner Process Manager. Process lifecycle and telemetry analysis remain separate ownership domains.

## IMSF Never Reimplements Persistence or Retention

Canonical metrics and rollups are written via a minimal DataAuthority-shaped provider contract. Retention and explicit archive requests are sent through a StorageAuthority-shaped provider contract. IMSF has no database implementation, transaction manager, schema engine, filesystem access, expiration rule, deletion path, archive creator/validator, or storage lifecycle transition table. Provider adapters at a composition root decide how a real authority fulfills these contracts.

## Anomaly Detection Quarantines Rather Than Silently Drops or Silently Accepts

Invalid values become `rejected` canonical records with a distinct reason. Plausible but suspicious values become `quarantined` canonical records with `AnomalyRecord` evidence. Both remain traceable; rejected records do not feed accepted calculations and quarantined records are excluded by default but can be deliberately included in investigation. This preserves forensic evidence without contaminating institutional aggregates.

## Deterministic Analytics

Anomaly thresholds are explicit configuration values. Rolling baseline selection is sorted by timestamp and Metric UUID. Aggregates are pure over sorted input records, and UTC rollup bucketing uses a specified Monday-start week. IMSF receives time from an injected clock and uses no timers or sleeps, so identical inputs/configuration/clock produce identical analytic decisions.

## Consequences

- Platform telemetry gains one canonical institutional schema without coupling to a specific miner or adapter.
- Quality failures and anomalies are visible through events and explainability instead of becoming missing data.
- Cross-device, workload, process, plugin, adapter/algorithm, pool, and platform views have reproducible arithmetic.
- Durable logical records and physical retention remain owned by their designated authorities.
- The causal Hardware → Resource → Workload → Miner Process → Adapter → Algorithm → Pool → Statistics chain is queryable without making IMSF own the linked entities.

## Rejected Alternatives

- **Add aggregates and anomalies to IMAF:** rejected; IMAF owns per-adapter raw normalization, not platform-wide institutional statistics.
- **Let every mining framework persist its own history:** rejected; it would fragment canonical records and bypass DataAuthority ownership.
- **Delete suspicious values immediately:** rejected; it loses forensic evidence and hides operational risk.
- **Treat anomalous values as normal by default:** rejected; it silently contaminates aggregate and historical evidence.
- **Implement local retention/archive logic:** rejected; it conflicts with StorageAuthority's exclusive retention, archival, and lifecycle ownership.
