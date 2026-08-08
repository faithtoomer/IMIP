# ADR-0021: Institutional Benchmark Intelligence Authority & Institutional Performance Knowledge Base

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 21  
**Deciders:** Architectural Authority (Specification)

## Context

IHIS (Phase 03) already owns the certified raw per-device `BenchmarkRegistry`, including `BenchmarkResult` recording, per-device retrieval, and summaries. Phase 03 explicitly treats benchmark execution policy as outside the raw store. IMIP now requires a single institutional workflow for benchmark cataloging, validation, comparison, regression detection, explainability, and cross-authority correlations without replacing IHIS's certified storage or coupling authorities directly.

The Phase 21 wording that IBIA is the sole authority for benchmark operations and that no authority may independently execute or record results appears to conflict with the existing certified IHIS raw store. This ADR resolves that conflict before implementation.

## Decision

- Implement IBIA at `core/benchmark_authority/`, orchestrated by `BenchmarkAuthority.ts`.
- Maintain a data-driven Benchmark Catalog keyed by benchmark type and version. Definitions describe hardware, mining, and platform categories, component kinds, metrics, units, and directionality without category-specific authority classes.
- Maintain a Benchmark Run Registry keyed by UUID/type/component/version for lifecycle orchestration evidence: Created → Validated → Scheduled → Executed → Verified → Stored → Compared → Archived.
- Treat `Scheduled` as externally confirmed scheduling evidence only. IBIA has no Scheduler Authority dependency, scheduling method, allocation method, mining method, or decision/action method.
- Publish the seven required events through `BenchmarkEventBus`, locally and optionally mirrored to the institutional Event Bus under the new `benchmark` EventCategory.
- Implement historical comparisons, direction-aware regression detection, trend analysis, and strictly advisory recommendations.
- Implement the IPKB as a higher-level catalog/comparison/correlation/history artifact associated with the existing `benchmark-results` Data Authority domain.

## Formal IHIS Boundary Resolution

- **IHIS retains raw result persistence.** `core/hardware_authority/src/benchmarks.ts` remains unchanged. `BenchmarkRegistry.record()`, `forDevice()`, and `summarize()` remain the sole certified raw per-device `BenchmarkResult` storage and read API.
- **IBIA does not import or instantiate `HardwareAuthority` or `BenchmarkRegistry`.** It receives a small dependency-injected `HardwareBenchmarkStore` interface with the same structural `record`/`forDevice`/`summarize` shape. The production composition root may adapt IHIS's existing `benchmarks` property to that interface.
- **Stored has an exact meaning.** When a verified IBIA run enters `Stored`, IBIA calls the injected IHIS-shaped store's `record()` method. IBIA does not maintain another raw result array.
- **IBIA owns orchestration and institutional intelligence.** Its catalog, lifecycle audit records, comparisons, recommendations, and IPKB correlations are not a competing per-device store. They relate the certified outcome to provider-published hardware configuration, power, thermal, resource, workload, algorithm, runtime, and configuration-change evidence.
- **“No independent recording” applies prospectively to competing raw stores.** No authority other than the certified IHIS raw store may create an alternate raw benchmark registry. IBIA is the institutional owner of benchmark lifecycle and intelligence, while IHIS remains the certified raw persistence implementation.

## Boundaries

- IBIA does **not** discover hardware, own hardware state, or duplicate IHIS benchmark summaries.
- IBIA does **not** allocate or reserve resources, calculate resource availability, or invoke Resource Authority functionality directly.
- IBIA does **not** own power or thermal measurement, constraints, budgets, or sensor logic; it consumes injected source signals only.
- IBIA does **not** govern workload lifecycle or execution. It consumes workload evidence only.
- IBIA does **not** schedule, mine, alter configuration, or make decisions. Its recommendations are advisory.
- Direct authority-to-authority calls are prohibited. Dependencies cross boundaries only through provider contracts, published interfaces, or Event Bus events.

## Consequences

- IMIP gains a single explainable benchmark lifecycle and institutional comparison surface while retaining one certified raw per-device benchmark store.
- Production composition supplies thin adapters to IHIS and signal authorities; IBIA remains independently testable with structural fakes.
- Benchmark results become reusable institutional knowledge rather than isolated performance samples.
- The pre-existing `benchmark-results` Data Domain is used for IPKB/comparison/history persistence. No duplicate or renamed domain is required.
- The additive `benchmark` EventCategory isolates benchmark events without overloading hardware, health, workload, or scheduler categories.

## Rejected Alternatives

- **Replacing IHIS `BenchmarkRegistry`:** Rejected — would break certified Phase 03 ownership and create migration risk without a need.
- **Keeping a second raw result array inside IBIA:** Rejected — produces conflicting per-device source of truth.
- **Calling `HardwareAuthority` directly:** Rejected — violates authority isolation, prevents independent testing, and creates compile-time coupling.
- **Giving IBIA scheduler, allocator, mining, or decision methods:** Rejected — collapses institutional responsibility boundaries.
- **Treating failure as a ninth lifecycle state:** Rejected — the approved lifecycle has eight states; failures are events and audit conditions.
