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
    events.ts                         Interim publish/subscribe surface
    explainability.ts                  Append-only hardware audit trail
    errors.ts                           Structured, typed error taxonomy
    HardwareAuthority.ts                 Orchestrator: discover -> classify -> assess
                                          -> register -> state/lifecycle -> read API
    index.ts                              Public exports
  tests/                                   75 tests across 11 files. All discovery tests
                                           use FakeDiscoveryProvider — no test depends on
                                           the actual host's hardware.
```

## Usage

```ts
import { HardwareAuthority } from './core/hardware_authority/src/index.js';

const ihis = new HardwareAuthority(); // real systeminformation-backed discovery by default
const snapshot = await ihis.discover();

ihis.getInventory();
ihis.getCategory('gpu');
ihis.getDigitalTwin(deviceId);
ihis.rankForWorkload('gpu-mining'); // "which available hardware is best suited?"

// Authorized mutation workflows only:
ihis.reserve(deviceId, 'allocated for mining', 'Mining Authority');
ihis.recordBenchmark({ deviceId, workload: 'gpu-mining', metric: 'H/s', value: 4200, unit: 'H/s', recordedAt: new Date().toISOString() });
```

## Scope Boundary

IHIS owns hardware discovery, capability, state, lifecycle, and explainability — never mining, scheduling, profitability, power policy, thermal policy, or resource arbitration (§4). Health checks (`assessment.ts`) are purely informational/diagnostic; enforcing thermal/power limits against them is Policy Authority's job (ADR-0006), never IHIS's.

## Governance

- No authority performs independent hardware discovery; all hardware knowledge originates from IHIS.
- No consumer mutates a `DeviceRecord` directly — only through `reserve()`, `releaseReservation()`, `markState()`, `recordFault()`, `recordRecovery()`, `recordBenchmark()`, `allocate()`, `releaseAllocation()`, `retire()`, all fully audited.
- `AsicDiscoveryProvider` and `getCapabilityRegistrations()` are real extension points with nothing registered yet by design (no ASIC backend, no implemented PCR) — see ADR-0008.
