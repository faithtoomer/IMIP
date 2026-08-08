# Program I — Capability Catalog

Source of truth: `HardwareCapability` (`core/hardware_authority/src/types.ts`), assessed by `assessment.ts`'s deterministic rules (Law 2 — capability before identity, never a device-name lookup).

## The 12 Capabilities

| Capability | Assessed for | Rule |
|---|---|---|
| `cpu-mining` | CPU | Always, once any CPU is discovered |
| `gpu-mining` | GPU | VRAM is reported |
| `asic-mining` | ASIC | Always, once any ASIC is discovered (none discoverable today — see `known-assumptions-and-extension-points.md`) |
| `ai-inference` | GPU | CUDA vendor, or ≥4GB VRAM |
| `ai-training` | GPU | CUDA vendor and ≥8GB VRAM |
| `virtualization` | CPU | Virtualization support reported |
| `general-compute` | CPU, GPU | Always, for any recognized CPU or GPU (added in the Phase 03 addendum) |
| `benchmarking` | CPU, GPU | Always |
| `thermal-monitoring` | CPU, GPU | A temperature sensor is reported |
| `power-monitoring` | GPU | A power limit is reported |
| `fan-control` | GPU | Fan support is reported |
| `hardware-telemetry` | Every category (CPU/GPU/ASIC/Memory/Storage/Motherboard/Network) | Always |

Memory, Storage, Motherboard, and Network devices are only ever `hardware-telemetry` capable — never mining/AI/compute capable, by design (§7 boundary).

## How Capabilities Reach a Future Capability Registry

`HardwareAuthority.getCapabilityRegistrations(): { deviceId, capability }[]` is the read surface (`core/hardware_authority/src/HardwareAuthority.ts`) — a flat list of every device's every assessed capability. No Capability Registry exists yet to consume it (ADR-0002, still reserved), so nothing calls this method today except tests. It is real, tested code with a real consumer contract, not a stub.

## Workload Suitability (Digital Twin)

Every capability except `benchmarking`, `thermal-monitoring`, `power-monitoring`, `fan-control`, and `hardware-telemetry` doubles as a **workload** that `computeSuitability()` scores: `cpu-mining`, `gpu-mining`, `asic-mining`, `ai-inference`, `ai-training`, `virtualization`, `general-compute` (`WORKLOAD_CAPABILITIES` in `digitalTwin.ts`). `rankForWorkload(workload)` returns every capable device sorted by suitability score — the literal implementation of "which available hardware is best suited for this workload," per the Phase 03 Architect's Enhancement.
