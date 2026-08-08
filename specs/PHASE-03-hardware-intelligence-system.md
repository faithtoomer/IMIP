# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM I — FOUNDATION

## Phase 03

# Institutional Hardware Intelligence System (IHIS)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Critical Foundation Authority

> IHIS is the implementation name for the "Hardware Authority" entry in `architecture/AUTHORITY_REGISTRY.md` (PHASE-01 §7) — the same pattern established by ICMS for the Configuration Authority (ADR-0005).

---

# 1. Mission Statement

IHIS is the sole authority for hardware discovery, hardware intelligence, capability assessment, state management, and lifecycle awareness in IMIP. It maintains a complete, continuously updated digital representation of every hardware component available to the platform. No other authority may directly discover, own, or maintain hardware state. All hardware knowledge originates from IHIS.

---

# 2. Objectives

Automatic discovery, inventory management, capability classification, benchmarking (storage/exposure, not execution), health monitoring, resource availability tracking, runtime state management, device lifecycle management, hardware event publication, explainable hardware intelligence.

---

# 3. Institutional Principles

1. **Single Ownership** — IHIS is the sole owner of hardware knowledge; no independent discovery elsewhere.
2. **Capability Before Identity** — the platform reasons about capabilities (GPU / CUDA / 12GB VRAM / mining-capable), never device names.
3. **Immutable Discovery Snapshot** — discovery produces immutable inventory snapshots; runtime state is tracked separately.
4. **Explainability** — every device answers what it is, what it can do, its health, its state, why it's available, who owns it, which plugin can use it.
5. **Hardware Independence** — no vendor assumptions; extensible by construction.

---

# 4. Responsibilities

IHIS owns: discovery, inventory, registry, capability assessment, hardware state, benchmark registry, device health, driver awareness, resource allocation metadata, hardware events, hardware explainability.

IHIS does **not** own: mining, scheduling, profitability, power policy, thermal policy, resource arbitration.

---

# 5. Architecture

```text
Operating System
    ↓
Hardware Discovery Layer            (discovery.ts — systeminformation-backed, injectable)
    ↓
Hardware Classification Engine      (classification.ts)
    ↓
Capability Assessment Engine        (assessment.ts)
    ↓
Hardware Registry                   (registry.ts — SSOT, keyed by deviceId)
    ↓
Hardware State Manager              (stateMachine.ts — runtime state + lifecycle stage)
    ↓
Hardware Event Publisher            (events.ts)
    ↓
Institutional Authorities
```

Orchestrated by `HardwareAuthority.ts`.

---

# 6. Hardware Categories

CPU, GPU (multi-GPU supported), ASIC (architecture-ready, empty by design — no local ASIC exists to discover), Memory, Storage, Motherboard, Network. Field lists match `core/hardware_authority/src/types.ts`'s `CpuInfo`/`GpuInfo`/`AsicInfo`/`MemoryInfo`/`StorageInfo`/`MotherboardInfo`/`NetworkInfo`. Fields the underlying discovery library cannot reliably report (e.g. full cache hierarchy, ECC status) are `undefined` rather than fabricated.

---

# 7. Hardware Capability Assessment

Deterministic rules in `assessment.ts` — capability is derived from observed data (VRAM present → gpu-mining; CUDA vendor or ≥4GB VRAM → ai-inference; CUDA and ≥8GB VRAM → ai-training; thermal sensor present → thermal-monitoring; etc.), never from a device-name lookup table (Law 2). Capabilities are exposed via `getCapabilityRegistrations()` as the read surface a future Platform Capability Registry implementation will consume — the PCR itself remains reserved (ADR-0002).

---

# 8. Hardware Registry

Every device: deviceId, category, identity, capabilities, health, lifecycle stage, runtime state, discovery/update timestamps, owning authority, security classification. `HardwareRegistry.upsert()` enforces exactly one entry per deviceId — re-discovery updates, never duplicates.

---

# 9. Runtime State

`available | reserved | busy | benchmarking | mining | ai-workload | offline | faulted | maintenance`, tracked independently from lifecycle stage. All transitions validated against `RUNTIME_STATE_TRANSITIONS` in `stateMachine.ts`; illegal transitions throw `HardwareStateTransitionError`. Physical device removal is the one exception — an external fact, not an authority-initiated transition, so it bypasses the guard by design (documented in `HardwareAuthority.discover()`).

---

# 10. Hardware Lifecycle

`discovered → registered → capability-assessed → benchmarked → available → allocated → released → retired`, strictly forward one stage at a time (`assertLifecycleTransition`), plus an allocate/release cycle and multi-stage-reachable retirement. Every transition is audited.

---

# 11. Benchmark Framework

`BenchmarkRegistry` stores and exposes results (latest + best per workload). Benchmark *execution* is out of scope — a future Mining/Workload Authority concern — matching the spec's own text.

---

# 12. Hardware Events

`HardwareDiscovered`, `HardwareRemoved`, `HardwareUpdated`, `DeviceAvailable`, `DeviceReserved`, `DeviceReleased`, `CapabilityChanged`, `DriverChanged`, `BenchmarkCompleted`, `HardwareFaultDetected` — `events.ts`, interim local bus standing in for the institutional Event Bus (same pattern as ICMS).

---

# 13. Explainability

`HardwareAuditTrail` (append-only) plus `getDigitalTwin()` together answer every question in §3 Law 4 for any device.

---

# 14. Public Interfaces

`getInventory()`, `getDevice()`, `getCategory()`, `getByCapability()`, `getState()`, `getHealth()`, `getBenchmarks()`, `getDigitalTwin()`, `getSuitability()`, `rankForWorkload()`, `subscribe()` — all read-only. Mutation only through `reserve()`, `releaseReservation()`, `markState()`, `recordFault()`, `recordRecovery()`, `recordBenchmark()`, `allocate()`, `releaseAllocation()`, `retire()`.

---

# 15. Error Handling

Per-category discovery failures are caught individually and never abort the overall `discover()` call; the previous inventory for that category is preserved and a `HardwareFaultDetected` event fires (`HardwareDiscoveryError`). Illegal state/lifecycle transitions throw typed errors (`HardwareStateTransitionError`, `HardwareLifecycleError`) rather than silently succeeding or crashing.

---

# 16. Testing Requirements

75 tests across 11 files: registry, classification (all 7 categories incl. multi-GPU and ASIC-empty-by-design), capability/health assessment, state + lifecycle transitions, end-to-end discovery (new/updated/removed devices, partial-category-failure resilience), benchmarks, digital twin + suitability scoring, events, explainability, failure recovery, performance smoke tests. All discovery tests use an injectable `FakeDiscoveryProvider` — no test depends on the actual host's hardware.

---

# 17. Acceptance Criteria

Every device discovered and registered exactly once. Capability assessment complete. Runtime state tracked. Inventory snapshots immutable. Events published correctly. Explainability complete via Digital Twin + audit trail. Read-only interfaces implemented. Tests pass. Documentation complete.

---

# 18. Cursor Implementation Contract — Compliance Note

ASIC discovery (`NoopAsicDiscoveryProvider`) and the eventual Platform Capability Registry integration (`getCapabilityRegistrations()`) are real, complete, functioning code with nothing to plug in yet — not placeholder code. See ADR-0008.

---

# Architect's Enhancement: Digital Twin & Suitability Scoring

Implemented in `digitalTwin.ts`. Each device's twin combines identity, capabilities, health, performance profile (from `BenchmarkRegistry`), operational state, reliability history (`ReliabilityRecord`, error/recovery counts → `stabilityScore`), and efficiency profile into a set of per-workload `SuitabilityScore`s — a deterministic, explainable weighted-factor formula (health × availability × reliability), not machine learning. `confidence` reflects how much real benchmark evidence backs the number (low/medium/high) rather than folding an unbenchmarked guess into the score itself. `rankForWorkload()` is the literal implementation of *"which available hardware has the highest suitability score for the requested workload"* — see ADR-0008.
