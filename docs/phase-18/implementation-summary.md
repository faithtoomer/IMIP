# Phase 18 — Implementation Summary (IRIA)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-18-institutional-resource-intelligence-authority.md`  
**Branch:** `cursor/program-iii-resource-intelligence-a927`

---

## 1. Executive Summary

Phase 18 implements the Institutional Resource Intelligence Authority (IRIA) — IMIP's resource governance module bridging hardware intelligence and future workload intelligence. TypeScript ESM (NodeNext, strict), with injectable provider interfaces for hardware inventory, power, and thermal constraints.

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Types and capacity model | `src/types.ts` | §6–8 |
| Injectable providers | `src/providers.ts` | §23 |
| Resource registry (SSOT) | `src/registry.ts` | §6 |
| Lifecycle state machine | `src/lifecycle.ts` | §8 |
| Availability evaluation | `src/availability.ts` | §9 |
| Allocation engine | `src/allocation.ts` | §10 |
| Reservation manager | `src/reservation.ts` | §11 |
| Ownership / leasing | `src/ownership.ts` | §12 |
| Utilization metrics | `src/utilization.ts` | §13 |
| Capacity forecast | `src/forecast.ts` | §14 |
| Advisory recommendations | `src/recommendations.ts` | §5 |
| History store | `src/history.ts` | §17 |
| Institutional Resource Digital Twin | `src/digitalTwin.ts` | §24 |
| Events | `src/events.ts` | §15 |
| Audit trail | `src/explainability.ts` | §5 Principle 5 |
| Error taxonomy | `src/errors.ts` | §17 |
| Metrics collector | `src/metrics.ts` | §17 |
| Orchestrator + public API | `src/ResourceAuthority.ts` | §5 |

78 tests across 13 files (`tests/`), all using injectable fakes for determinism.

---

## 3. Key Decisions

1. **Hardware is not a resource.** IRIA consumes allocatable units from `HardwareInventoryProvider`; it does not import IHIS directly.
2. **Power/thermal via injectable interfaces.** `PowerConstraintProvider` and `ThermalConstraintProvider` supply blocking signals and profile refs without coupling to IPIA/ITIA modules.
3. **Deterministic candidate selection.** When multiple resources qualify, selection sorts by `resourceId` ascending — identical state yields identical outcomes.
4. **IRDT is advisory.** `rankCandidatesForWorkload`, `underutilizedHealthy`, and `getRecommendations` inform future workload intelligence; IRIA never schedules or mines.
5. **Abstract capacity units.** All capacity is expressed as dimensionless governance units within a resource profile, keeping cross-type allocation logic uniform.

---

## 4. Verification

```text
npx vitest run core/resource_authority   → 13 files, 78 tests, 78 passed
```

---

## 5. Actions Not Performed (By Law)

- No mining strategy or workload scheduling logic (§4 explicit exclusions)
- No direct imports of hardware/power/thermal authority modules
- No allocation outside IRIA orchestrator
- No root README / AUTHORITY_REGISTRY / specs README updates (per task scope)

---

## 6. Follow-Up

| Item | Status |
|---|---|
| Wire IRIA to live IHIS inventory feed via approved integration adapter | Deferred |
| Connect power/thermal providers to IPIA/ITIA when implemented | Deferred |
| Event Bus implementation; retarget `ResourceEventBus` calls | Deferred |
| Workload Intelligence Authority consuming IRDT rankings | Deferred |
