# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 28

# Institutional Miner Process Manager (IMPM)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Classification:** Institutional Authority

> IMPM is the sole authority for the safe lifecycle of external mining OS processes. It is below IMAF: adapters communicate with miners; IMPM creates, supervises, restarts, and terminates the actual process.

---

# 1. Mission Statement

The Institutional Miner Process Manager safely creates, launches, supervises, monitors, controls, restarts, and terminates external mining processes executed by IMIP. Its mission objectives are process creation, isolation, lifecycle control, resource enforcement, stdout/stderr capture, exit-code analysis, crash detection, restart management, process health evidence, cleanup, and process security.

# 2. Architectural Position

```text
Plugin → Workload → IMAF Adapter → IMPM → Injected ProcessLauncher → OS Miner Process
                           │               │
                           └─ communicates ─┘ manages safely
```

IMPM contains neither mining strategy nor scheduling. It never selects a workload, algorithm, coin, pool, adapter, or hardware target.

# 3. Process Lifecycle

The guarded nominal lifecycle is:

```text
Requested → Validated → Prepared → Spawned → Starting → Running → Degraded → Stopping → Stopped → Archived
```

`Failed` is an explicit distinct state reachable from every non-terminal active stage. Transitions are checked by `assertLifecycleTransition`; failures are recorded, emitted, and explained rather than silently dropped. Controlled restart recovery explicitly re-enters validation and repeats every hard pre-launch gate.

# 4. Process Identity and Isolation

Each logical managed process receives a stable Process UUID and tracks parent workload UUID, adapter UUID, plugin UUID, launch PID, start time, redacted command identity, runtime state, and exit status. The identity registry freezes identity snapshots and never regenerates the Process UUID for a logical process.

The identity registry enforces one active process per parent-workload/adapter tuple and `assertProcessScope` requires the owning caller to reference the exact Process UUID before control. IMPM tracks all launcher-returned PIDs and performs deterministic live-PID sweeps to identify untracked or duplicate processes for cleanup.

# 5. Relationship to IMAF / ISTA / IOLA / IRIA

**IMAF:** IMPM is a distinct lower-level process authority. IMAF adapters know how to communicate with a miner; IMPM knows how to safely manage the operating-system process an adapter may use. IMPM only type-imports IMAF normalized-error vocabulary and does not implement `MiningAdapter`, import, or instantiate `MiningAdapterFramework`.

**ISTA:** permissions, secret-reference handling, executable verification, least-privilege environment construction, and redaction are provided through injected `SecurityPermissionProvider` contracts. IMPM never imports or instantiates Security Authority.

**IOLA:** all stdout, stderr, exit, and diagnostics output is redacted and routed through injected `ObservabilitySink`. IMPM never imports or instantiates Observability Authority.

**IRIA:** resource availability, reservation, and process permission are injected provider contracts. IMPM owns no allocation ledger and never bypasses IRIA. The required sequence is exactly:

```text
Resource Availability → Resource Reservation → Process Permission → Miner Launch
```

No mining or scheduling logic is contained in IMPM, and IMPM does not import scheduling authority code.

# 6. Security and Resource Gates

Before every launch, IMPM checks launch permission; rejects relative paths, traversal, non-allowlisted executables, shell metacharacters, and control characters; verifies the executable again to prevent substitution; and constructs only an explicit environment-variable allowlist. `ProcessLauncher.spawn` accepts executable plus argument array only, never a shell command string. Secret references are opaque and all outward identity, output, diagnostics, and errors pass redaction before capture or emission.

Resource availability, reservation, and process authorization are non-bypassable ordered gates. Any rejection aborts before `ProcessLauncher.spawn`; a failed process-permission gate releases a returned reservation where the provider supports release.

# 7. Restart, Supervision, and Output

Manual, automatic-policy, and crash-recovery restart paths are supported. Backoff is a deterministic capped geometric function; clock injection prevents timers or sleeping in tests. Automatic/crash paths enforce cooldown and a hard maximum retry ceiling. When exhausted, the process becomes `Degraded` with `restart-exhausted` evidence rather than restarting indefinitely.

Output capture records redacted stdout, stderr, startup/shutdown diagnostics, exit codes, and signals to IOLA-shaped observability. Exit/callback support is provided by the injected launcher, so tests never create OS processes.

# 8. Events, Explainability, and Supervision Graph

IMPM publishes: `MinerProcessRequested`, `MinerProcessCreated`, `MinerProcessStarted`, `MinerProcessReady`, `MinerProcessDegraded`, `MinerProcessStopped`, `MinerProcessFailed`, `MinerProcessRestarted`, and `MinerProcessTerminated`, under Event Bus category `miner-process`.

Explainability describes lifecycle history, resource/security rejection, and deterministic restart decisions. The queryable supervision graph records:

```text
Plugin → Workload → Adapter → Process → Resource → Hardware
```

It answers why a resource is consuming capacity by tracing the responsible plugin, workload, adapter, process, resource, and hardware. `miner-process-supervision` is the corresponding additive Data Domain.

# 9. Acceptance Criteria and Test Posture

Phase 28 is complete when every miner launch flows through injected ProcessLauncher and hard security/resource gates; duplicate and cross-process control are rejected; identities and output are redacted; failures, exits, retries, and termination are explicit; orphan cleanup is deterministic; concurrent processes remain isolated; all nine events, supervision tracing, and no-direct-authority-import boundary coverage are tested; and no production test uses `child_process`.
