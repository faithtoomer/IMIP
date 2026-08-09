# ADR-0028: Institutional Miner Process Manager

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 28  
**Deciders:** Architectural Authority (Specification)

## Context

IMIP needs one auditable control point for external miner operating-system processes. Adapter communication and process execution are different responsibilities: a future real adapter may communicate through local, network, vendor, or protocol mechanisms, while OS spawning, PID tracking, credentials, output, crash recovery, and termination require a dedicated authority.

## Decision

- Implement IMPM at `core/miner_process_manager/`, composed exclusively from injected ProcessLauncher, security, observability, and resource contracts.
- Give each logical process a stable Process UUID, immutable assigned identity snapshot, guarded lifecycle, scoped control, and tracked PID runtime evidence.
- Add Event Bus category `miner-process`, Data Domain `miner-process-supervision`, nine lifecycle events, explainability, and a Plugin → Workload → Adapter → Process → Resource → Hardware supervision graph.

## Process Management Is Distinct From Adapter Communication

IMPM is below and distinct from IMAF. IMAF defines adapter communication and normalized contract vocabulary; IMPM neither implements `MiningAdapter` nor imports/instantiates `MiningAdapterFramework`. Adapter selection, miner protocol, coin behavior, and configuration translation remain outside IMPM. IMPM also contains no mining strategy or scheduling logic.

## Resource Enforcement Sequence Is Never Bypassed

Every launch executes injected IRIA-shaped operations strictly in this order: availability, reservation, process permission, then launcher spawn. A failure aborts immediately; permission denial returns the reservation when supported. IMPM keeps no competing resource ledger.

## Security Controls Are Non-Negotiable Gates, Not Soft Defaults

Permission check, absolute/allowlisted executable validation, executable-substitution verification, shell/control-character argument rejection, least-privilege environment construction, opaque secret references, and redaction all occur before any output leaves IMPM or any process is spawned. Launcher input is executable plus argument array, never a shell string. No direct Security or Observability Authority implementation dependency exists.

## Restart Policy Has a Hard Ceiling

Restart decisions use injected clock input and deterministic capped geometric backoff. Automatic and crash-recovery paths stop at `maxRetries`; cooldown is enforced; exhaustion transitions to `Degraded` instead of looping. Manual restarts remain explicit control actions and still repeat launch security/resource gates.

## Consequences

- Process tests use fake injected launchers and never invoke real `child_process`.
- A single chokepoint makes process launches, PID supervision, output redaction, crash evidence, scope control, and cleanup testable.
- Future adapters can use IMPM internally without making IMAF a process authority.
- Provider interfaces intentionally trade concrete upstream coupling for clear contractual integration.

## Rejected Alternatives

- **Spawn directly in adapter/framework tests:** rejected; it bypasses lifecycle, security, IRIA, and deterministic test control.
- **Put process management in Scheduling Authority:** rejected; scheduling owns schedules, not mining process execution.
- **Treat security/resource checks as optional defaults:** rejected; they are gates and launch must fail closed.
- **Restart indefinitely:** rejected; it hides failures and risks runaway resource consumption.
- **Log raw commands or output:** rejected; secret redaction is mandatory before capture/emission.
