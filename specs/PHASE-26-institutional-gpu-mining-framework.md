# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 26

# Institutional GPU Mining Framework (IGMF)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Institutional Framework

> IGMF is the multi-GPU execution layer above IMAF. It is not the future Mining Authority and contains no coin plugin or miner binary logic.

---

# 1. Mission Statement

The Institutional GPU Mining Framework (IGMF) provides the standardized execution, monitoring, optimization-telemetry, and resource-integration layer for GPU-based cryptocurrency mining across supported GPU vendors and architectures. It supports multiple GPUs concurrently while remaining independent of coins, mining software, and backend syntax.

---

# 2. Architectural Position

```text
Coin Plugin → GPU Mining Framework → Mining Adapter Framework → GPU Miner Backend → GPU
```

A future coin plugin owns coin intelligence. An IMAF adapter owns backend syntax, process behavior, and backend lifecycle. IGMF owns UUID-scoped mining-session coordination, composed GPU views, deterministic compatibility checks, IRIA-requested GPU resource consumption, normalized performance history, advisory recommendations, failure reporting, and digital-twin evidence.

---

# 3. Mission Objectives

GPU discovery integration; multi-GPU identity management; capability negotiation; IRIA resource integration; VRAM awareness; algorithm compatibility; normalized hashrate/performance intelligence; power and thermal integration; GPU workload isolation; adapter-contract composition; explainability; and GPU Mining Digital Twin evidence.

---

# 4. Institutional Principles

1. **Law 1 — No Coin or Miner Logic in Core:** Algorithm, pool protocol, wallet, and backend are opaque identifiers or references. IGMF contains no Flux logic, real algorithm, named miner, vendor SDK, executable, or binary configuration syntax.
2. **Law 2 — GPU Profile Is a Read View:** `GpuProfileComposer` reads source-owned snapshots through injected providers on each call. It has no cache and is not discovery, allocation, telemetry, or certification storage.
3. **Law 3 — IRIA Allocates:** IGMF pre-validates required VRAM against provider-reported available VRAM, then requests a VRAM/compute-queue grant from injected IRIA-shaped `GpuResourceProvider`. It has no VRAM or queue allocation ledger and never self-grants resources.
4. **Law 4 — UUID Is First-Class:** Every GPU, resource request, grant, session, history record, and digital-twin record is UUID-keyed. Sorting is only for deterministic display; no GPU is primary and no GPUs are assumed identical.
5. **Law 5 — Isolation Is Explicit:** One active session may exclusively claim a GPU UUID. A session may only reference the UUID it was granted, and a GPU workload cannot claim/control a second UUID.
6. **Law 6 — Detection Reports; Authorities Govern:** IGMF publishes thermal/power/failure observations and advisory recommendations. It never changes institutional power, thermal, certification, or resource policy, and never restarts/recoveries a miner automatically.
7. **Law 7 — IMAF Is the Backend Boundary:** IGMF consumes injected `MiningAdapter`-conforming references, one per session where appropriate. It never imports/instantiates `MiningAdapterFramework` or recreates adapter configuration, translation, normalization, registry, or lifecycle ownership.
8. **Law 8 — Deterministic Read Logic:** Given identical provider views, adapter declaration/output, configuration, and injected clock values, profile composition, VRAM pre-validation, capability negotiation, recommendations, and records are deterministic.

---

# 5. Responsibilities and Non-Responsibilities

IGMF owns GPU mining-session lifecycle/audit records; UUID identity registry read view; deterministic capability negotiation; VRAM pre-validation before an IRIA request; UUID isolation guard; normalized GPU performance history; advisory optimization telemetry; GPU failure-condition reports; GPU-mining events; explainability; and append-only GPU Mining Digital Twin records.

IGMF does **not** own GPU discovery/inventory, health monitoring, resource availability/allocation/reservation state, power/thermal state or policy, certification decisions, secrets, mining authorization, scheduling, workload selection, backend registry, backend configuration translation, backend process implementation, a coin plugin, or an algorithm implementation.

---

# 6. Relationship to IHIS / IRIA / IPIA / ITIA / IHCA / IMAF

**IHIS / Hardware Authority** owns GPU discovery, UUID, vendor, model, architecture, driver, compute capability, PCIe data, raw health, and inventory. IGMF receives an IHIS-shaped `GpuHardwareProvider` view, does not import IHIS types/classes, and never creates or changes inventory records.

**IRIA / Resource Authority** owns `gpu`, `gpu-memory`, and `gpu-queue` availability, reservations, allocations, ownership, utilization, contention, and release. IGMF reads allocation/availability through `GpuResourceProvider`, validates required VRAM before execution, and asks that provider to reserve/release a structural grant. Its registry is a session registry, never an allocation ledger.

**IPIA / Power Authority** owns GPU power telemetry, budgets, power limits, policy, and recommendations. IGMF reads a `GpuPowerProvider` snapshot, calculates efficiency, and publishes `GpuPowerWarning`; it shall not directly override institutional power policies.

**ITIA / Thermal Authority** owns GPU temperatures, hotspot/memory sensors, fan telemetry, budgets, policy, and recommendations. IGMF reads a `GpuThermalProvider` snapshot and publishes `GpuThermalWarning`; it shall not directly override institutional thermal policies.

**IHCA / Certification Authority** owns GPU certification status and certification evidence. IGMF reads injected `CertificationStatusProvider` output and does not certify, revoke, or alter certification.

**IMAF / Mining Adapter Framework** owns the adapter contract, backend registry, adapter lifecycle/audit, translation, normalization, error classification, and adapter readiness. IGMF receives an already-selected `MiningAdapter` contract via injection and invokes established `identify`, `start`, `stop`, `statistics`, and `health` methods. It owns neither IMAF lifecycle nor adapter implementation.

All six boundaries are crossed only through exported structural interfaces, Event Bus publication, and dependency injection. No source-authority implementation is imported, instantiated, or directly called.

---

# 7. GPU Profile and Memory Integration

Every GPU mining resource exposes a composed GPU Profile: GPU UUID; Vendor; Model; Architecture; total/used/available VRAM; Driver; Compute capability; PCIe information; allocated/available compute queues; temperature including hotspot and memory temperature; Power; Fan status; and Certification status.

`GpuProfileComposer` is read-through and defensive. Hardware identity is from IHIS-shaped input, allocation/VRAM/queue state from IRIA-shaped input, thermal/fan values from ITIA-shaped input, power/fan-status values from IPIA-shaped input, and certification from IHCA-shaped input. It intentionally stores no independent source-of-truth profile.

`VramManagement` is validation plus provider invocation only. It rejects a workload whose positive required VRAM exceeds `GpuProfile.vramAvailableMB` **before** `reserveVram()` is called. A successful pre-validation is not a grant; only IRIA's returned `GpuResourceGrant` authorizes use.

---

# 8. Multi-GPU Architecture, Configuration, and Capability Negotiation

`GpuIdentityRegistry` lists and looks up known GPUs by UUID independently. It never derives meaning from enumeration order, treats no device as “GPU 0 primary,” and permits N simultaneous sessions on distinct GPU UUIDs.

`GpuMiningConfig` carries GPU UUID selection, opaque algorithm, pool configuration, opaque wallet reference, worker identity, intensity, memory configuration, power-policy reference, performance-policy reference, and injected IMAF adapter reference. Backend-specific flags remain inside adapters. Raw wallet/pool credentials are rejected.

Before resource reservation, deterministic GPU negotiation evaluates Vendor, Architecture, Driver, VRAM, Compute capability, Algorithm, Miner support, Resource availability, and Certification status. It returns stable ordered pass/fail checks and reasons; a failing check invokes no IRIA reservation or adapter start.

---

# 9. GPU Isolation and Lifecycle

The active-session-per-GPU-UUID `GpuIsolationGuard` is integrated with the GPU Mining Session Registry. A second concurrent claim on the same UUID is rejected. `assertGpuScope()` rejects any adapter/configuration device reference that differs from the UUID grant. Stopped/failed sessions release their claim; retained session audit records do not constitute future ownership.

The phase calls this a “9-stage” lifecycle. Its explicit nominal sequence contains nine stages and is implemented exactly:

```text
Requested → GPU Compatibility Verified → Resource Reserved → Configured → Prepared → Started → Running → Monitored → Stopped
```

`Failed` is a separate explicit exception state reachable from active stages. `Monitored` may receive repeated observations. Configured/Prepared state means an already-selected adapter and IRIA grant are ready; it does not recreate IMAF adapter lifecycle/translation work.

---

# 10. Performance, Optimization, and Failure Handling

IGMF records hashrate, accepted/rejected/invalid shares, derived hashrate stability, power consumption, hashrate/watt, temperature, hotspot, memory temperature, fan speed, uptime, and source normalized statistics. Division by zero remains undefined, never fabricated.

Optimization telemetry may recommend power-efficiency review, workload intensity, GPU selection, memory utilization, or algorithm configuration. All recommendations have `advisory: true`; they do not apply changes or override institutional power/thermal policy.

IGMF detects Driver failures, GPU disappearance, CUDA/OpenCL errors, VRAM exhaustion, Thermal throttling, Power-limit violations, Miner crashes, and Pool failures from source views and adapter signals. Where applicable it preserves IMAF `NormalizedError` categories. Detection reports events only: IGMF does not restart a miner, reallocate VRAM, throttle a GPU, or enforce a policy.

---

# 11. Events, Explainability, and Digital Twin

IGMF publishes `GpuMiningRequested`, `GpuMiningPrepared`, `GpuMiningStarted`, `GpuMiningStopped`, `GpuMiningFailed`, `GpuHashrateUpdated`, `GpuEfficiencyUpdated`, `GpuThermalWarning`, `GpuPowerWarning`, and `GpuDegraded` under the additive Event Bus `gpu-mining` category.

Explainability reports lifecycle stage/history, deterministic compatibility reasons, isolation rejection rationale, and each detected failure condition. It does not make an authorization or policy decision.

The append-only GPU Mining Digital Twin records the chain:

```text
GPU Identity → Architecture → Algorithm → Configuration → Hashrate → Power → Temperature → Efficiency → Reliability
```

It is queryable by GPU UUID, algorithm, and session. It is descriptive evidence for future Profitability and Machine Learning programs, not a control plane or replacement authority database.

---

# 12. Program IV Completion

Phase 26 completes **Program IV — Mining Framework**: Phase 24 supplied the Mining Adapter Framework, Phase 25 supplied the CPU Mining Framework, and Phase 26 supplies the GPU Mining Framework. Program IV now hands off a backend-neutral, CPU/GPU execution foundation to **Program V coin/mining plugins**. Program V may supply coin intelligence and adapter integrations through these published boundaries; it does not alter Program IV ownership.

---

# 13. Acceptance Criteria

Phase 26 is complete when GPU mining has a standardized coin-agnostic framework; multi-GPU sessions remain UUID-isolated; NVIDIA/AMD/Intel-shaped fake-provider coverage demonstrates vendor-neutral composition; VRAM is pre-validated and IRIA-governed; thermal/power/certification views are injected; statistics are normalized through IMAF output; all eight failure conditions and ten events are covered; the Digital Twin is queryable; no prohibited authority import exists; documentation is complete; and tests pass without regression.
