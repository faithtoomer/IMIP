# ADR-0008: Hardware Intelligence System & Digital Twin Suitability Scoring

**Status:** Accepted  
**Date:** 2026-08-07  
**Phase:** 03  
**Deciders:** Architectural Authority (Specification)

## Context

A conventional mining platform enumerates hardware by device name and hardcodes per-model logic. PHASE-03 explicitly rejects that: the Decision Intelligence Engine must never ask "do I have an RTX 5070," only "which available hardware has the highest suitability score for this workload." That requires two things: (1) a capability-first data model (Law 2), and (2) a real scoring mechanism over that model — not a lookup table.

Two supporting engineering decisions also needed a record:

1. **Real hardware discovery requires a real dependency.** Hand-rolling OS-specific shell-outs (`wmic`, `lscpu`, `system_profiler`) to parse CPU/GPU/memory/storage/motherboard/network data would be slower to build, more fragile, and effectively a worse reimplementation of an already-solid, actively maintained cross-platform library. `systeminformation` (npm) was adopted for `core/hardware_authority/src/discovery.ts`, mirroring how the sibling `trading-server` already depends on `express`/`pg`/`ws` for its own infrastructure concerns.
2. **ASIC discovery and PCR integration have no real backend to call yet.** ASICs are network-attached, not locally enumerable by any OS API; the Platform Capability Registry remains reserved (ADR-0002). Both are implemented as complete, real, currently-empty extension points rather than stubs — the same pattern established for hardware/policy compatibility checking in ICMS (ADR-0007).

## Decision

- Adopt `systeminformation` as the production discovery backend (`SystemInformationDiscoveryProvider`), with per-category failure isolation — one category's failure never aborts discovery of the others, and previous inventory for that category is preserved (§15).
- All discovery is injectable (`DiscoveryProvider` interface); tests exclusively use a synthetic `FakeDiscoveryProvider` and never depend on the sandbox's actual hardware.
- `NoopAsicDiscoveryProvider` returns `[]` by design; `getCapabilityRegistrations()` is the real read-surface a future PCR implementation will consume, not a stub of one.
- Implement the Digital Twin (`digitalTwin.ts`) as a deterministic, explainable weighted-factor formula: `score = (healthFactor + availabilityFactor + reliabilityFactor) / 3` when the device has the requested capability, `0` otherwise. `confidence` (low/medium/high) reflects whether real benchmark evidence exists for that workload — an unbenchmarked device can still score well on capability/health/availability, but is flagged as lower-confidence rather than silently blended with benchmarked devices.
- `rankForWorkload()` sorts devices by this score descending — the literal implementation of the Architect's Enhancement's reframed question.

## Consequences

- No future authority needs to special-case a GPU model name; capability and suitability data are always queried, never hardcoded.
- When a real ASIC discovery backend or the Platform Capability Registry is implemented, they plug into existing extension points (`AsicDiscoveryProvider`, `getCapabilityRegistrations()`) with no changes to `HardwareAuthority`'s public API.
- Suitability scores will improve in confidence (not retroactively change in kind) as real benchmark data accumulates — the scoring formula does not need to change when that happens, only its inputs.
