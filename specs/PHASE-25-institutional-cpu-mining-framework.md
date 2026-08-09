# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 25

# Institutional CPU Mining Framework (ICMF)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Institutional Framework

> ICMF is the CPU execution layer above IMAF. It is not the future Mining Authority and does not implement a coin plugin.

---

# 1. Mission Statement

The Institutional CPU Mining Framework (ICMF) provides the standardized execution, monitoring, CPU-placement, optimization-telemetry, and resource-integration layer for CPU-based cryptocurrency mining. It gives coin-specific plugins a coin-agnostic CPU mining capability without embedding a cryptocurrency, a named miner, or a mining algorithm in framework core.

---

# 2. Architectural Position

```text
Coin Plugin → CPU Mining Framework → Mining Adapter Framework → CPU Mining Backend → CPU
```

A coin plugin owns coin intelligence. An IMAF adapter owns backend syntax, process behavior, and backend lifecycle behavior. ICMF owns a CPU mining-session view, algorithm compatibility evaluation, placement planning for resources IRIA already granted, normalized performance intelligence, advisory recommendations, and safety-condition reporting.

---

# 3. Mission Objectives

CPU capability composition; CPU mining configuration; IRIA-integrated thread reservation; affinity and NUMA placement; CPU utilization and hashrate monitoring; efficiency analysis; power and thermal integration; adapter-contract integration; explainability; safety reporting; and CPU Performance Digital Twin training-data records.

---

# 4. Institutional Principles

1. **Law 1 — No Coin or Algorithm in Core:** ICMF uses generic `CpuAlgorithmProfile` contracts. It ships no real coin, RandomX, or production algorithm implementation. `test-algo-fixture` is explicitly a test fixture only.
2. **Law 2 — Resource Authority Allocates:** ICMF requests a thread reservation through an injected IRIA-shaped `CpuResourceProvider`; it has no allocation ledger and never self-grants a logical processor.
3. **Law 3 — CPU Profile Is a Read View:** CPU Profile composition reads injected source views on every call. It is not raw hardware discovery, a source telemetry store, or a replacement authority profile.
4. **Law 4 — Placement Is Not Allocation:** Thread management selects affinity, cores, logical processors, SMT usage, and NUMA placement only from an existing IRIA grant.
5. **Law 5 — Safety Reports; Authorities Govern:** ICMF detects and publishes unsafe conditions. It does not change power, thermal, resource, security, or policy state.
6. **Law 6 — Adapter Contract Is the Backend Boundary:** ICMF consumes an already-supplied IMAF `MiningAdapter` contract and calls its existing `start`, `stop`, `statistics`, and `health` methods. It neither imports nor instantiates `MiningAdapterFramework`, nor recreates IMAF registry/translation/normalization lifecycle machinery.
7. **Law 7 — Deterministic Read Logic:** Identical injected provider values, configuration, normalized adapter outputs, and injected-clock values produce the same profile, compatibility result, placement plan, safety report, recommendation set, and twin record.

---

# 5. Responsibilities and Non-Responsibilities

ICMF owns: CPU mining-session lifecycle/audit records; generic algorithm-profile registry; compatibility checks; affinity and NUMA placement plans; normalized CPU performance history; advisory optimization telemetry; safety-condition reports; CPU-mining events; explainability; and CPU Performance Digital Twin records.

ICMF does **not** own CPU discovery, inventory, health monitoring, resource allocation state, power/thermal profiles or policy, certification decisions, secret storage, mining authorization, coin intelligence, worker scheduling, backend registry, backend configuration translation, or backend process implementation.

---

# 6. Relationship to IHIS / IRIA / IPIA / ITIA / IHCA / IMAF

**IHIS / Hardware Authority** owns CPU discovery, UUID, architecture, physical/logical core detail, cache, instruction flags, NUMA topology, raw capability data, and provider-published hardware health signal. ICMF receives an IHIS-shaped `CpuHardwareProvider` view and never discovers, updates, or persists a CPU inventory record.

**IRIA / Resource Authority** owns `cpu`, `cpu-core`, and `cpu-pool` availability, reservations, allocations, ownership, utilization, contention, and release. ICMF requests/release a structural thread reservation only through injected `CpuResourceProvider`; its Thread Management module may place only granted logical processors. A placement plan is not a reservation or allocation ledger.

**IPIA / Power Authority** owns CPU power state, budgets, policy, and recommendations. ICMF reads a provider-supplied `CpuPowerProvider` view, calculates mining efficiency, and reports excessive-power conditions. It does not set a limit, reduce power, or alter policy.

**ITIA / Thermal Authority** owns CPU thermal state, budgets, policy, sensors, and recommendations. ICMF reads a provider-supplied `CpuThermalProvider` view and reports excessive-temperature conditions. It does not throttle, cool, or change a threshold.

**IHCA / Certification Authority** owns hardware certification status and certification evidence. ICMF reads an injected `CertificationStatusProvider` view; it does not certify, revoke, or alter a certification.

**IMAF / Mining Adapter Framework** owns the adapter contract, backend registry, adapter lifecycle audit, capability negotiation, adapter translation, statistics normalization, backend error classification, and adapter readiness records. ICMF receives a selected `MiningAdapter`-conforming object through dependency injection, requires preconfigured/prepared adapter context from the composition root, and invokes its established backend controls. ICMF owns no adapter lifecycle logic and does not instantiate `MiningAdapterFramework`.

All six relationships are structural provider/contract boundaries. No source authority class is imported, instantiated, or called directly.

---

# 7. CPU Profile

Every CPU mining resource exposes the composed CPU Profile: CPU UUID; core count; thread count; architecture; instruction sets; cache; NUMA topology; available threads; allocated threads; current utilization; thermal state; power state; and certification status.

`CpuProfileComposer` reads each injected provider at composition time and returns a defensive snapshot. It has no cache and creates no independent discovery or profile store. This mirrors a Digital Twin-style composition rather than ownership of source state.

---

# 8. CPU Mining Configuration and Thread Management

`CpuMiningConfig` includes: generic algorithm profile; IRIA thread-allocation request; affinity preference; backend-adapter reference; pool configuration; opaque wallet reference; worker identity; performance mode; and resource limits. Raw wallet addresses, passwords, and credentials are prohibited; references are resolved by ISTA/adapter context outside ICMF.

Thread management supports thread count, thread affinity, core affinity, logical-processor selection, SMT awareness, and NUMA-aware placement. It validates and plans only against `CpuThreadGrant.grantedThreadIds`. It does not call a reserve method, manufacture a thread ID, or assume all CPU threads are available.

---

# 9. Algorithm Abstraction

A `CpuAlgorithmProfile` declares an opaque algorithm ID, required instruction sets, memory requirements, and thread characteristics. The algorithm registry supports multiple profiles, and its compatibility evaluator deterministically checks instruction-set, memory, and thread requirements against a composed CPU Profile and requested/granted capacity.

The repository contains only `TEST_ALGORITHM_PROFILE`, a non-production `test-algo-fixture` used to demonstrate the abstraction. It does not represent RandomX or any real mining algorithm.

---

# 10. Lifecycle

The phase request calls this a “9-stage” lifecycle. The explicitly listed sequence contains nine nominal stages, which ICMF implements exactly:

```text
Requested → Validated → Resources Reserved → Configured → Prepared → Started → Running → Monitored → Stopped
```

The explicit enumeration is Requested (1), Validated (2), Resources Reserved (3), Configured (4), Prepared (5), Started (6), Running (7), Monitored (8), and Stopped (9). `Failed` is a separate explicit exception state reachable from active stages. `Monitored` may receive repeated monitoring observations without another transition.

Adapter configuration/preparation belongs to IMAF or the composition root. ICMF's Configured and Prepared stages mean that an already-selected IMAF adapter reference and an IRIA-granted placement plan are ready; they do not recreate adapter configuration translation or backend preparation logic.

---

# 11. Performance Intelligence and Optimization Telemetry

ICMF records hashrate, hashrate per thread, hashrate per watt, CPU utilization, shares, rejections, error rate, uptime, thermal impact, and power consumption. Hashrate/thread and hashrate/watt are derived deterministically with zero denominators left undefined.

Optimization telemetry may recommend a thread count, affinity strategy, NUMA placement, performance mode, or utilization adjustment. Recommendations are advisory-only data. Applying any change must go through Resource, Power, Thermal, Security, and Policy authorities as applicable; ICMF has no mutation path for those systems.

---

# 12. Safety Controls

ICMF detects and publishes the following conditions: excessive CPU temperature; excessive CPU power; resource contention; hardware health degradation; miner crash; pool failure; and invalid configuration. It uses composed/injected authority signals and normalized adapter reports only.

Detection is reporting, not enforcement. ICMF does not throttle a CPU, change a power budget, alter thermal policy, revoke a resource, restart a backend, or change institutional security/policy state. Downstream owners decide any remediation.

---

# 13. Events and Explainability

ICMF publishes: `CpuMiningRequested`, `CpuMiningPrepared`, `CpuMiningStarted`, `CpuMiningStopped`, `CpuMiningFailed`, `CpuHashrateUpdated`, `CpuMiningEfficiencyUpdated`, and `CpuMiningDegraded` under the additive Event Bus `cpu-mining` category.

Explainability describes current lifecycle stage/history, algorithm-compatibility checks, and every safety-condition detection with source signal and rationale. Events may be mirrored to the institutional Event Bus without changing lifecycle ownership.

---

# 14. Architect's Enhancement — CPU Performance Digital Twin

ICMF maintains queryable, append-only CPU mining performance records chaining:

```text
CPU → Algorithm → Threads → Affinity → Hashrate → Power → Temperature → Efficiency
```

These are descriptive historical training-data records for future ML optimization. They do not replace source hardware/power/thermal data and cannot autonomously alter a mining session or institutional policy.

---

# 15. Acceptance Criteria

Phase 25 is complete when ICMF provides a standardized CPU-mining framework; multiple abstract CPU algorithms and adapters are supportable; IRIA-sourced resource allocation is enforced; CPU Profile is composed rather than independently discovered; power/thermal/certification views are integrated through injected providers; performance and efficiency telemetry are normalized; safety is reporting-only; no coin-specific logic exists; the Digital Twin is queryable; boundaries are tested with fake providers; and tests pass without regressions.
