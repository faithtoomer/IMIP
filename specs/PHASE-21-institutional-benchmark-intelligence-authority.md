# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM III — RESOURCE INTELLIGENCE

## Phase 21

# Institutional Benchmark Intelligence Authority (IBIA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Institutional Intelligence Authority

> IBIA is the implementation name for the “Benchmark Authority” entry in `architecture/AUTHORITY_REGISTRY.md`.

---

# 1. Mission Statement

The Institutional Benchmark Intelligence Authority (IBIA) shall serve as the sole authority responsible for designing, executing, validating, storing, comparing, and explaining benchmark operations throughout IMIP. Benchmarking is institutional evidence, not a one-time performance test. No authority shall independently execute or record benchmark results.

---

# 2. Mission Objectives

Benchmark Registry; Benchmark Catalog; Benchmark Execution; Benchmark Validation; Benchmark History; Comparative Analysis; Explainable Benchmark Reports.

---

# 3. Responsibilities

IBIA owns: Benchmark Registry; Benchmark Profiles; Benchmark Catalog; Execution History; Performance Baselines; Comparison Engine; Benchmark Recommendations; Benchmark Events; and the Institutional Performance Knowledge Base (IPKB).

IBIA does **not** own: Resource allocation; Mining; Hardware discovery; Scheduling; Decision making.

IBIA consumes hardware, power, thermal, resource, and workload information only through dependency-injected provider contracts. It must not import or instantiate another authority's concrete class.

---

# 4. Relationship to IHIS (Phase 03)

IHIS remains the certified single source of truth for raw, per-device `BenchmarkResult` persistence in `core/hardware_authority/src/benchmarks.ts`. Its `BenchmarkRegistry.record()`, `forDevice()`, and `summarize()` interfaces remain unchanged and are not reimplemented by IBIA.

IBIA is the orchestration layer above that certified store. It owns benchmark type/version definitions, the benchmark lifecycle, validation evidence, historical and comparative analysis, regression detection, explainability, advisory recommendations, and IPKB-level correlations. At the lifecycle `Stored` stage, IBIA calls an injected `HardwareBenchmarkStore` adapter shaped exactly like IHIS's existing registry; it does not keep a competing raw per-device result array.

The prospective rule that no authority independently executes or records benchmark results is therefore applied without rewriting certified Phase 03 ownership: no authority may introduce a second raw benchmark store. IBIA's catalog, lifecycle, comparison, and IPKB records are higher-level institutional artifacts persisted through the existing `benchmark-results` Data Authority domain, not a replacement for IHIS raw result persistence.

---

# 5. Benchmark Categories

IBIA supports a data-driven category/type catalog:

- **Hardware:** CPU, GPU, ASIC, Memory, Storage.
- **Mining:** RandomX, ZelHash, KHeavyHash, SHA-256, and future mining algorithms.
- **Platform:** Runtime, Database, Storage, Event Bus, Scheduler.

No category receives a hard-coded authority class. Catalog definitions declare category, component kinds, metric, unit, version, and whether higher or lower values are better.

---

# 6. Benchmark Registry and Catalog

Each benchmark lifecycle record stores: UUID, Benchmark Type, Component, Version, Date, Duration, Result reference, Environment, Hardware Profile, Power Profile, and Thermal Profile. The run registry is keyed by UUID/type/component/version and is authoritative for IBIA orchestration state.

The Benchmark Catalog is authoritative for benchmark type/version definitions. It supports creation, lookup, category filtering, update through re-registration, and removal. Benchmark results are standardized before verification and persist their raw per-device representation only through IHIS.

---

# 7. Benchmark Lifecycle

Created → Validated → Scheduled → Executed → Verified → Stored → Compared → Archived.

Every transition is validated and recorded in an append-only lifecycle audit trail. `Scheduled` represents an externally confirmed schedule only; IBIA never creates a schedule or directs the Scheduler Authority. A benchmark failure is a published event and auditable condition, not an unapproved ninth lifecycle state.

---

# 8. Benchmark Intelligence

IBIA produces performance trends, regression detection, improvement analysis, historical comparisons, efficiency analysis, and advisory recommendation generation.

Comparisons select a compatible historical baseline by benchmark type, component, and version. They are metric-direction aware, so both throughput/hashrate and lower-is-better latency benchmarks are interpreted correctly. Recommendations are advisory institutional evidence only; they do not allocate resources, change configuration, schedule work, mine, or make a decision.

---

# 9. Benchmark Events

IBIA publishes: BenchmarkStarted, BenchmarkCompleted, BenchmarkFailed, BenchmarkVerified, BenchmarkCompared, BenchmarkRegressionDetected, and BenchmarkRecommendationGenerated.

All Phase 21 benchmark events use the institutional Event Bus `benchmark` category. The local event surface may mirror to the institutional bus without blocking benchmark orchestration.

---

# 10. Explainability

Every benchmark answers:

1. What was measured?
2. Why?
3. Under what conditions?
4. Compared to what baseline?
5. What changed?
6. What recommendation resulted?

Answers include lifecycle evidence and clearly identify provider-derived power, thermal, resource, workload, runtime, hardware, and configuration context without claiming ownership of source measurements.

---

# 11. Architect's Enhancement: Institutional Performance Knowledge Base (IPKB)

Rather than treating benchmark outcomes as isolated records, IBIA maintains an IPKB that relates benchmark outcomes to hardware configurations, resource utilization, power consumption, thermal behavior, workload characteristics, mining algorithms, runtime versions, and configuration changes.

The IPKB can answer questions including:

- Which configuration consistently delivers the highest hashrate per watt?
- Did a runtime update improve or regress mining performance?
- Which GPU model performs best for Flux under identical power and thermal conditions?
- Which benchmark regressions correlate with configuration or driver changes?

The IPKB transforms benchmarking into a continuously growing institutional knowledge system for future Decision Intelligence, Profitability Intelligence, and Machine Learning authorities, while preserving strict separation of responsibilities.

---

# 12. Acceptance Criteria

Phase 21 is complete only when: Benchmark Registry is authoritative; benchmark execution envelopes are standardized; historical comparisons function; regression detection works; events publish; explainability is complete; IPKB correlations are queryable; tests pass; documentation is complete.
