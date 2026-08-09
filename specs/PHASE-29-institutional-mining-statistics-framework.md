# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 29

# Institutional Mining Statistics Framework (IMSF)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Classification:** Institutional Framework

> IMSF is the institutional statistics layer above adapter normalization. It does not parse, translate, or re-normalize raw miner output.

---

# 1. Mission Statement

The Institutional Mining Statistics Framework (IMSF) provides the canonical, institutional-grade statistics layer for mining telemetry across IMIP. Its responsibilities are canonical schema construction, deterministic data-quality validation, anomaly detection, multi-level aggregation, and historical analysis. IMSF ingests already-normalized observations and makes their provenance, quality, and aggregate impact auditable.

# 2. Architectural Position

```text
Raw Miner Output → IMAF Adapter NormalizedStatistics / IMPM-managed process evidence
                                      ↓
                  IMSF Canonical Metrics → Aggregates → Historical Rollups
                                      ↓              ↓
                         injected DataAuthority-shaped / StorageAuthority-shaped providers
```

IMSF is not a miner adapter, process manager, hardware/resource controller, pool client, database, archive manager, or retention engine. It is a peer institutional framework that consumes published or injected contracts only.

# 3. Mission Objectives

1. Construct a canonical immutable metric record for each ingested observation.
2. Reject implausible values with a precise quality reason before they can contribute to accepted aggregates.
3. Detect deterministic hashrate, share-rejection-rate, and efficiency anomalies and quarantine rather than silently accept, silently drop, or mutate evidence.
4. Aggregate consistently per device, workload, miner process, plugin, adapter/algorithm, pool, and platform.
5. Compute minute, hour, day, and week rollups.
6. Persist metrics and rollups through an injected logical-data contract and delegate storage retention/archive policy through an injected storage contract.
7. Preserve traceability through the Institutional Mining Telemetry Graph.

# 4. Canonical Statistics Schema

Every ingestion is assigned one immutable `StatisticsMetric` snapshot with:

- Metric UUID and timestamp;
- source identifier;
- workload UUID, adapter UUID, and optional miner process UUID;
- hardware UUID/identifier and optional resource UUID;
- optional plugin UUID and pool identifier;
- algorithm identifier;
- metric type, value, and unit;
- confidence score; and
- collection status: `collected`, `rejected`, or `quarantined`.

`ingestionId` is an optional stable producer-event key. Re-delivery of the same key returns the already-assigned immutable metric, rather than assigning another Metric UUID. A state transition is represented by a new frozen snapshot retaining the same UUID; no assigned metric object is mutated.

# 5. Relationship to IMAF / IMPM / DataAuthority / StorageAuthority

**IMAF:** `NormalizedStatistics` is IMAF's per-adapter raw-normalization layer. IMSF may type-reference that shape and can construct canonical metrics from already-normalized numeric fields, but it never parses raw miner output, applies adapter-specific mappings, or repeats normalization logic. IMSF is the institutional layer above IMAF: canonical schema, quality, anomaly detection, aggregation, and historical rollups.

**IMPM:** a miner process UUID may be carried as provenance when process-managed evidence is ingested. IMSF is a peer authority: it neither imports nor invokes Miner Process Manager and owns no process lifecycle or supervision action.

**DataAuthority:** IMSF persists canonical records and computed rollups only through the injected `StatisticsDataProvider` structural contract, shaped after logical data creation/query semantics. IMSF never imports, instantiates, or reimplements DataAuthority, a database, transactions, schemas, or audit storage.

**StorageAuthority:** IMSF sends rollups to the injected `StatisticsRetentionProvider` for retention and explicit archive delegation. It never imports, instantiates, or reimplements StorageAuthority retention, archive validation, deletion, expiry, or lifecycle transition rules.

# 6. Data Quality and Anomaly Detection

The deterministic data-quality gate rejects missing canonical semantics, invalid timestamps, NaN/Infinity, confidence outside `[0, 1]`, negative hashrate, other non-negative measurements below zero, and decreasing cumulative accepted/rejected share counts. Rejected metrics retain a canonical rejection record but are excluded from accepted aggregate and rollup calculations.

Anomaly detection uses a bounded rolling baseline per source/metric and explicit injected configuration:

- hashrate drop ratio;
- hashrate spike ratio;
- share rejection-rate threshold; and
- efficiency proportional-deviation threshold.

Anomalous metrics are retained and marked `quarantined`, together with immutable `AnomalyRecord` evidence. They are not silently accepted, dropped, or deleted. By default, quarantined data is excluded from aggregates; callers may explicitly include it for investigation.

# 7. Aggregation

`aggregateMetrics` is a pure function of its input records. It deterministically orders records by timestamp and Metric UUID and produces count, sum, average, minimum, maximum, latest value/timestamp, and contributing Metric UUIDs for each metric type/unit group at all required levels:

```text
Device | Workload | Miner Process | Plugin | Adapter/Algorithm | Pool | Platform
```

No aggregation operation changes a canonical metric, controls mining, or allocates hardware resources.

# 8. Historical Analysis and Rollups

IMSF performs UTC bucketing at minute, hour, day, and Monday-start week granularity, then calculates deterministic aggregate rollups. `computeRollups` is pure. `persistAndRetainRollups` sends each computed rollup to the injected data provider and delegates retention to the injected retention provider; explicit archive requests are likewise delegated. IMSF has no ad hoc deletion, expiry, archive, or lifecycle path.

# 9. Events, Explainability, and Telemetry Graph

IMSF publishes under Event Bus category `mining-statistics`:

1. `StatisticsCollected`
2. `StatisticsValidated`
3. `StatisticsRejected`
4. `HashrateUpdated`
5. `ShareStatisticsUpdated`
6. `EfficiencyUpdated`
7. `StatisticsAnomalyDetected`

Explainability reports whether a metric was accepted, rejected, or quarantined; gives the rejection/anomaly rationale; and identifies the metrics and deterministic arithmetic that formed an aggregate.

The Institutional Mining Telemetry Graph records the causal chain:

```text
Hardware → Resource → Workload → Miner Process → Adapter → Algorithm → Pool → Statistics
```

The graph is queryable from a metric, hardware identifier, or workload UUID, so a statistic can be traced to its producing hardware and its provenance can be inspected before aggregate/rollup decisions.

# 10. Determinism and Ownership Rules

All thresholds are configuration values, all times come from an injected clock, and no IMSF test path uses a real timer, sleep, or wall-clock read. Aggregation and bucketing are pure/deterministic for the same input set. Session registry state is transient only; durable and physical storage remain external injected authority responsibilities.

# 11. Acceptance Criteria and Test Posture

Phase 29 is complete when every ingested statistic has canonical provenance; invalid data is rejected with distinct reasons; anomalies are deterministically quarantined; every required aggregation level produces known deterministic output; all four rollup granularities are correct and delegated to the providers; all seven events publish; explainability and graph traceability work; multi-source ingestion remains isolated; and an authority-boundary test proves IMSF has no direct forbidden authority imports or instantiations.
