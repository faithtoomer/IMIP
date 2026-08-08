# Institutional Hardware Intelligence System (IHIS)

**Status:** IMPLEMENTED (Phase 03)  
**Location:** `core/hardware_authority/`  
**Authority:** PHASE-03 / ADR-0008

## Purpose

IHIS is IMIP's sole authority for hardware discovery, capability assessment, state, lifecycle, and explainability. It is the implementation of the "Hardware Authority" entry in `architecture/AUTHORITY_REGISTRY.md` — not a separate authority. No other authority may discover or own hardware state directly.

## Layout

```text
core/hardware_authority/
  src/
    types.ts            Shared types (DeviceRecord, DigitalTwin, RuntimeState, ...)
    discovery.ts          DiscoveryProvider interface + systeminformation-backed default
                           implementation, with per-category failure isolation
    classification.ts       Raw discovery -> DeviceRecord[] (identity + category info)
    assessment.ts             Capability assessment + informational health checks
                               (deterministic rules, never device-name lookups)
    registry.ts                 HardwareRegistry — SSOT keyed by deviceId
    stateMachine.ts                Runtime state + lifecycle stage transition tables
    benchmarks.ts                   BenchmarkRegistry (stores/exposes; doesn't execute)
    digitalTwin.ts                   Suitability scoring + Digital Twin assembly
                                      (incl. general-compute workload, allocation)
    integrity.ts                      Duplicate-id and inventory-inconsistency detection
    events.ts                          Interim publish/subscribe surface
    explainability.ts                   Append-only hardware audit trail
    errors.ts                            Structured, typed error taxonomy
    HardwareAuthority.ts                  Orchestrator: discover -> classify -> assess
                                           -> register -> state/lifecycle -> read API
    index.ts                               Public exports
  tests/                                    176 tests across 15 files (95 for IHIS; 81 for
                                            ICMS). All discovery tests use
                                            FakeDiscoveryProvider — no test depends on the
                                            actual host's hardware.
```

## Usage

```ts
import { HardwareAuthority } from './core/hardware_authority/src/index.js';

const ihis = new HardwareAuthority(); // real systeminformation-backed discovery by default
const snapshot = await ihis.discover();

// Optional (Phase 05): mirror every event onto the shared Institutional Event Bus
// (core/event_bus/) without changing anything above — pass `eventBus` in options.
// See docs/phase-05/event-bus-connection.md.

ihis.getInventory();
ihis.getCategory('gpu');
ihis.getDigitalTwin(deviceId);
ihis.rankForWorkload('gpu-mining'); // "which available hardware is best suited?"

// Authorized mutation workflows only:
ihis.reserve(deviceId, 'allocated for mining', 'Mining Authority');
ihis.recordBenchmark({ deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });
ihis.allocate(deviceId, 'monero-plugin', 'assigned to monero mining', 'Mining Authority');
ihis.checkIntegrity(); // duplicate-id / inconsistent-state diagnostics, on demand
```

## Additions Beyond the Original Phase 03 Implementation

A later spec revision asked for IHIS to go further than the shipped v1.0. Only the pieces genuinely absent from the original implementation were added (no renames, no restructuring of the runtime-state model, no changes to how the Platform Capability Registry integration is deferred):

- **Allocation tracking** — `DeviceRecord.allocation` / `DigitalTwin.allocation` record who a device is currently allocated to (`allocate(deviceId, ownerId, reason, authority)`), not just that its lifecycle stage advanced.
- **`DeviceRegistered` event** — fires once, right after a newly discovered device advances to the `registered` lifecycle stage.
- **`general-compute` capability + workload** — every recognized CPU and GPU is assessed as general-compute capable and receives a suitability score for it, independent of mining/AI eligibility.
- **Duplicate/inconsistency detection** (`integrity.ts`) — `detectDuplicateDeviceIds()` catches two raw devices colliding on the same `deviceId`; `detectInventoryInconsistencies()` flags impossible state combinations (e.g. a retired device that isn't offline). Both run automatically at the end of every `discover()` (publishing `HardwareFaultDetected` + an audit record) and are exposed on demand via `checkIntegrity()`.
- **CPU `socket` field** on `CpuInfo`/`RawCpuInfo`, sourced from `systeminformation`.

## Scope Boundary

IHIS owns hardware discovery, capability, state, lifecycle, and explainability — never mining, scheduling, profitability, power policy, thermal policy, or resource arbitration (§4). Health checks (`assessment.ts`) are purely informational/diagnostic; enforcing thermal/power limits against them is Policy Authority's job (ADR-0006), never IHIS's.

## Governance

- No authority performs independent hardware discovery; all hardware knowledge originates from IHIS.
- No consumer mutates a `DeviceRecord` directly — only through `reserve()`, `releaseReservation()`, `markState()`, `recordFault()`, `recordRecovery()`, `recordBenchmark()`, `allocate()`, `releaseAllocation()`, `retire()`, all fully audited.
- Integrity issues (duplicate ids, inconsistent state) are detected and surfaced (audit + `HardwareFaultDetected`), never silently corrected or hidden.
- `AsicDiscoveryProvider` and `getCapabilityRegistrations()` are real extension points with nothing registered yet by design (no ASIC backend, no implemented PCR) — see ADR-0008.
