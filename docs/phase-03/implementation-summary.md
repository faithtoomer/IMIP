# Phase 03 — Implementation Summary (IHIS)

**Version:** 1.0  
**Date:** 2026-08-07  
**Specification:** `specs/PHASE-03-hardware-intelligence-system.md`  
**Branch:** `cursor/phase-00-repository-governance-5130`

---

## 1. Executive Summary

Phase 03 implements the Institutional Hardware Intelligence System (IHIS) — IMIP's second production module, and its Hardware Authority. Node.js (ESM) + TypeScript, built on `systeminformation` for real cross-platform hardware discovery, with a full capability-assessment, state/lifecycle, benchmark, and Digital Twin suitability-scoring layer on top.

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Discovery (real + injectable) | `src/discovery.ts` | §5, §15 |
| Classification (raw → DeviceRecord) | `src/classification.ts` | §6 |
| Capability + health assessment | `src/assessment.ts` | §7 |
| Hardware registry (SSOT) | `src/registry.ts` | §1, §8 |
| Runtime state + lifecycle machine | `src/stateMachine.ts` | §9, §10 |
| Benchmark storage | `src/benchmarks.ts` | §11 |
| Digital Twin + suitability scoring | `src/digitalTwin.ts` | Architect's Enhancement |
| Events | `src/events.ts` | §12 |
| Audit trail | `src/explainability.ts` | §13 |
| Orchestrator + public API | `src/HardwareAuthority.ts` | §5, §14 |

75 tests across 11 files (`tests/`), all using an injectable `FakeDiscoveryProvider` for determinism.

---

## 2a. Addendum — Additive Enhancements (2026-08-08)

A follow-up spec revision proposed a more elevated IHIS, overlapping almost entirely with what was already shipped above (same mission, same Laws, same Digital Twin/suitability-scoring concept under a different name). Rather than build a duplicate authority — which would itself violate Law 1 — only the pieces genuinely absent from the original implementation were added:

| Addition | File | Notes |
|---|---|---|
| Allocation tracking (`DeviceRecord.allocation`, `DigitalTwin.allocation`) | `types.ts`, `HardwareAuthority.ts`, `digitalTwin.ts` | `allocate()` now takes an `ownerId`; `releaseAllocation()` clears it |
| `DeviceRegistered` event | `events.ts`, `HardwareAuthority.ts` | Fires once, right after a new device reaches the `registered` lifecycle stage |
| `general-compute` capability + workload | `types.ts`, `assessment.ts`, `digitalTwin.ts` | Every recognized CPU/GPU gets it, independent of mining/AI eligibility |
| Duplicate-id / inventory-inconsistency detection | `integrity.ts` (new) | Runs automatically at the end of every `discover()`; also exposed via `checkIntegrity()` |
| CPU `socket` field | `types.ts`, `discovery.ts`, `classification.ts` | Sourced from `systeminformation` |

Explicitly **not** changed (flagged to the user as needing a decision, not silently applied): the runtime-state model was not restructured to fold in `Discovered`/`Registered` as runtime states, and capability registration into the Platform Capability Registry was not changed from "read surface for later" to "register now" — PCR remains reserved (ADR-0002). Event renames (`CapabilityChanged`→`CapabilityRegistered`, `BenchmarkCompleted`→`BenchmarkUpdated`) were also left as-is since they're cosmetic, not missing functionality.

20 new tests across 4 new files (`allocation.test.ts`, `deviceRegistered.test.ts`, `generalCompute.test.ts`, `integrity.test.ts`) plus extensions to `classification.test.ts` and `failure-scenarios.test.ts`. Total: 95 tests across 15 files for IHIS (176 with ICMS).

---

## 3. Key Decisions

1. **Real discovery via `systeminformation`, not hand-rolled OS shell-outs.** Adopted as a production dependency, same posture as `express`/`pg`/`ws` in the sibling `trading-server`. See ADR-0008.
2. **ASIC discovery and PCR integration are complete extension points, not stubs.** `NoopAsicDiscoveryProvider` and `getCapabilityRegistrations()` are real, tested code with nothing to plug in yet — no ASIC backend exists, no PCR is implemented (still reserved per ADR-0002).
3. **Digital Twin scoring is a deterministic weighted formula, not ML.** `score = (health + availability + reliability) / 3`, gated to 0 if the capability is absent; `confidence` communicates how much real benchmark evidence exists rather than blending guesses into the score.
4. **Runtime state and lifecycle stage are two independent dimensions.** A device can be runtime-`available` (physically usable right now) while still lifecycle-`capability-assessed` (hasn't been benchmarked yet) — matches real-world onboarding rather than forcing benchmark completion before a device can be used.
5. **Physical device removal bypasses the runtime-state transition guard by design.** It's an external fact, not an authority-initiated workflow step.

---

## 4. Verification

```text
npx tsc --noEmit -p tsconfig.json        → clean (src)
npx tsc --noEmit (src + tests combined)   → clean
npm run build                             → dist/ emitted successfully
npx vitest run                            → 28 files, 176 tests, 176 passed (95 for Phase 03 IHIS)
```

---

## 5. Actions Not Performed (By Law)

- No mining, scheduling, profitability, power-policy, or thermal-policy logic (§4 explicit exclusions)
- No benchmark *execution* code — only storage/exposure of results (§11, deferred to a future Mining/Workload Authority)
- No real ASIC discovery backend (no local enumeration API exists for network-attached ASICs)
- No Platform Capability Registry implementation (still reserved, ADR-0002) — only the read surface it will consume
- No Event Bus implementation (interim local emitter, same pattern as ICMS)

---

## 6. Follow-Up

| Item | Status |
|---|---|
| Real ASIC discovery backend (LAN scan + vendor API) | Deferred |
| Platform Capability Registry implementation, consuming `getCapabilityRegistrations()` | Deferred |
| Policy Authority implementation, enforcing thermal/power limits against IHIS's informational health readings | Deferred |
| Benchmark execution workflow (Mining/Workload Authority) feeding `recordBenchmark()` | Deferred |
| Event Bus implementation; retarget `HardwareEventBus` calls | Deferred |
