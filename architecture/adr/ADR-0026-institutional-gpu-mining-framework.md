# ADR-0026: Institutional GPU Mining Framework & GPU Mining Digital Twin

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 26  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP needs a reusable multi-GPU execution layer for future coin plugins without embedding a coin, named miner, real algorithm, vendor SDK, or competing GPU-resource state. GPU identity and capabilities are source-owned by IHIS; GPU VRAM/compute-queue availability and reservations are owned by IRIA; thermal, power, and certification views are owned by ITIA, IPIA, and IHCA. IMAF already owns the backend adapter contract and adapter lifecycle machinery.

A GPU framework must preserve independent device identity and prevent accidental cross-device control. Duplicating VRAM accounting, caching a profile, selecting a primary GPU, or enforcing thermal/power action would violate institutional ownership and make multi-GPU behavior unsafe.

## Decision

- Implement IGMF at `core/gpu_mining_framework/`, orchestrated by `GpuMiningFramework.ts`.
- Compose UUID-scoped GPU mining sessions from injected IHIS-, IRIA-, ITIA-, IPIA-, and IHCA-shaped providers plus an already-selected IMAF `MiningAdapter` contract per session.
- Provide deterministic GPU capability negotiation, VRAM pre-validation, session lifecycle/audit, performance history, advisory telemetry, failure reporting, explainability, Event Bus publication, and append-only GPU Mining Digital Twin records.
- Publish ten events under additive `gpu-mining` EventCategory and reserve `gpu-mining-performance` / `gpu-mining-digital-twin` Data Domains.

## GPU Profile as a Composed View, Not a New Source of Truth

- `GpuProfileComposer` reads fresh upstream snapshots every time and deliberately has no cache, inventory, allocation ledger, telemetry store, or certification store.
- IHIS retains GPU UUID, vendor, model, architecture, driver, compute capability, PCIe, and source health. IRIA retains total/used/available VRAM plus compute-queue allocation/availability. ITIA retains thermal/hotspot/memory/fan sensor state. IPIA retains power/fan status. IHCA retains certification status.
- The composed profile is a defensive read snapshot for negotiation, validation, monitoring, explanation, and twin evidence. It cannot update source state.

## VRAM Allocation Comes from IRIA, Never Duplicated, Pre-Validated Before Request

- `VramManagement` checks a positive workload requirement against composed `vramAvailableMB` before it invokes injected `GpuResourceProvider.reserveVram()`.
- A workload exceeding provider-reported available VRAM is rejected before execution and before a reservation request. A passed check is not an allocation.
- IGMF owns no VRAM counter, queue ledger, allocation registry, or self-grant path. Release is sent only to the same provider using IRIA's grant reservation ID.

## Multi-GPU Identity and Isolation Guarantees

- GPU UUID is first-class in profile composition, resource requests/grants, sessions, session registry, performance records, and Digital Twin records.
- `GpuIdentityRegistry` has deterministic UUID lookup/listing but derives no “primary” meaning from position and makes no homogeneity assumption.
- `GpuIsolationGuard` permits one active claim per GPU UUID. A second concurrent claim fails. Scope validation rejects a session adapter/configuration device reference that differs from the UUID it was granted.
- Sessions on distinct UUIDs may run concurrently; release removes only that session’s own claim and does not affect another GPU.

## IMAF Adapter-Contract Composition

- IGMF imports only IMAF’s published structural contract types and accepts an injected `MiningAdapter` reference in each `GpuMiningConfig`.
- It uses established adapter identity/start/stop/statistics/health controls and does not instantiate `MiningAdapterFramework` or recreate IMAF registry, translation, normalizer, error classifier, secret context, backend config, or adapter lifecycle audit.
- The composition root or future Mining Authority must select/configure/prepare adapters and secret context before an IGMF session begins.

## Safety and Optimization Are Advisory

- Eight GPU failures are detected and published, preserving IMAF normalized error categories where supplied. IGMF never retries/restarts a backend, throttles a GPU, changes a power limit, changes a thermal threshold, changes certification, or reallocates resources itself.
- Optimization recommendations are immutable advisory data. Applying them requires the appropriate authority and policy route outside IGMF.

## Boundaries

- IGMF does **not** discover/inventory hardware, monitor health independently, allocate capacity itself, enforce power/thermal policy, certify hardware, store secrets, authorize mining, schedule workload, or implement a coin plugin.
- IGMF does **not** import or instantiate Hardware, Resource, Power, Thermal, Health, Security, Certification, Arbitration, Benchmark, Workload, or Scheduling Authority implementation classes.
- IGMF does **not** implement the mining adapter contract; it composes injected IMAF `MiningAdapter` references.
- Dependencies cross only through Event Bus publication, exported structural contracts, and injected providers.

## Consequences

- Future Program V plugins receive a stable, vendor-neutral GPU mining surface while device capacity remains centrally governed by IRIA.
- Concurrent GPU work is safe by construction at the framework boundary because UUID identity and exclusive claims are enforced before adapter start.
- GPU Profile/Twin views remain fresh descriptive evidence instead of rival authority databases.
- Deterministic provider and clock injection makes the framework testable with NVIDIA-, AMD-, and Intel-shaped fakes, without real vendor SDKs.
- Program IV is architecturally complete: IMAF (Phase 24), ICMF (Phase 25), and IGMF (Phase 26) hand a backend-neutral execution foundation to Program V plugins.

## Rejected Alternatives

- **Create an IGMF VRAM ledger:** Rejected — duplicates IRIA and risks conflicting ownership.
- **Cache/discover GPU profiles in IGMF:** Rejected — creates a rival hardware/telemetry/certification source of truth.
- **Assume GPU 0 is primary or all GPUs are alike:** Rejected — violates independent multi-GPU identity and produces unsafe behavior.
- **Allow two active sessions on one exclusive UUID:** Rejected — violates GPU workload isolation.
- **Throttle/restart automatically after a detection:** Rejected — bypasses Resource, Power, Thermal, Security, and policy ownership.
- **Instantiate/proxy MiningAdapterFramework:** Rejected — couples frameworks and duplicates IMAF lifecycle ownership.
- **Embed a real coin, algorithm, miner binary, CUDA/OpenCL SDK, or vendor-specific backend:** Rejected — Program V plugins/adapters own those integrations.
