# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM IV — MINING FRAMEWORK

## Phase 30

# Institutional Mining Plugin Runtime (IMPR)

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Classification:** Institutional Framework

> IMPR is a mechanical execution host for individual plugin instances explicitly handed to it. It is neither the platform plugin inventory nor the authority that authorizes activation.

---

# 1. Mission Statement

The Institutional Mining Plugin Runtime (IMPR) validates and mechanically hosts a specific mining plugin manifest-and-package unit provided by a caller. It constructs a bounded runtime context solely from approved injected interfaces, preserves plugin-instance isolation, and manages the lifecycle of only its transient active working set.

# 2. Architectural Position

```text
Caller hands in exact Manifest + Package
                  ↓
 IMPR: manifest + declared-dependency + certification gate
                  ↓
 isolated approved-interface PluginRuntimeContext
                  ↓
 mechanical lifecycle / delegated IMPM process request / traceability graph
```

IMPR never scans a filesystem, plugin directory, registry, or platform inventory. “Discovered” in its lifecycle means the caller handed in a concrete unit; it never means IMPR searched for one.

# 3. Mission Objectives

1. Load only an explicit manifest/package unit supplied to `load(manifest, package, options)`.
2. Validate manifest structure and declarations, then validate declared dependencies against injected interfaces and IMPR's existing transient working set.
3. Hard-refuse a load without a valid certification record from the injected certification-status provider.
4. Expose only Configuration, Event Bus, Resources, Hardware intelligence, Power, Thermal, Health, Statistics, Mining frameworks, and Security through each context.
5. Isolate contexts and control routes by Plugin Instance UUID.
6. Delegate every process-start request to the injected IMPM-shaped handle.
7. Publish lifecycle evidence and preserve execution traceability.

# 4. Relationship to Plugin Registry Authority / Mining Authority / IMPM / IMPCA

**Plugin Registry Authority:** reserved and still unimplemented. It owns authoritative discovery, manifest validation for registration, and platform-wide plugin inventory. IMPR is not that registry and has no autonomous discovery or inventory role.

**Mining Authority:** reserved and still unimplemented. It owns authorization and control decisions about mining activation. IMPR does not decide whether a plugin is permitted to activate; it mechanically hosts only the exact unit handed to it after its required validation gates.

**IMPM:** IMPR never imports, creates, or spawns a process. `requestProcessStart` delegates the request solely to an injected `ProcessManagerHandle` shaped so a real Miner Process Manager can satisfy it.

**IMPCA (Phase 31):** IMPR does not implement certification logic. Its injected `PluginCertificationStatusProvider` is a placeholder seam. A missing or non-certified record is a hard load refusal; the real Institutional Mining Plugin Certification Authority will be wired through this seam after Phase 31 is implemented.

# 5. Validation and Certification Gate

`manifestValidation` requires a non-empty plugin UUID/version, dependency/capability/interface arrays, only approved runtime interface names, structurally valid dependency declarations, and a package entrypoint object. `dependencyValidation` is intentionally only a declared-versus-available compatibility check: it examines approved injected interfaces and manifests already in IMPR's active working set. It is not a platform dependency solver.

After those checks, `certificationGate` calls the injected status provider. `certified: true` is mandatory. There is no fallback, implicit trust path, or local certification implementation.

# 6. Controlled Runtime Context and Isolation

Each successfully loaded Plugin Instance UUID receives a fresh frozen `PluginRuntimeContext` with exactly ten slots:

```text
configuration | eventBus | resources | hardwareIntelligence | power
thermal | health | statistics | miningFrameworks | security
```

No registry, process manager, filesystem, arbitrary storage, raw hardware-control interface, or another plugin context is reachable through the context. Scope assertions require the matching Plugin Instance UUID before lifecycle, process-delegation, graph-statistics, or explanation control routes proceed.

# 7. Mechanical Lifecycle

The deterministic nominal lifecycle is:

```text
Discovered → Validated → Loaded → Initialized → Ready → Active → Paused
          → Stopping → Stopped → Unloaded
```

`Failed` is explicitly reachable from every non-terminal nominal stage. Guards reject skipped/invalid transitions. All timestamps come from an injected clock; no timer, sleep, or wall-clock call is used by IMPR.

# 8. Process Delegation and Execution Safety

IMPR performs no filesystem writes, has no child-process dependency, and does not expose raw hardware control. A plugin instance's process-start request is forwarded only through `ProcessManagerHandle.launch`; the injected IMPM implementation remains the process-lifecycle/security/resource choke point. Resource and security access are similarly only through their sanctioned injected interfaces, never direct IRIA/ISTA implementation calls.

# 9. Events, Explainability, and Institutional Plugin Execution Graph

IMPR publishes under Event Bus category `mining-plugin-runtime`:

1. `PluginRuntimeLoaded`
2. `PluginRuntimeInitialized`
3. `PluginRuntimeReady`
4. `PluginRuntimeStarted`
5. `PluginRuntimePaused`
6. `PluginRuntimeResumed`
7. `PluginRuntimeStopped`
8. `PluginRuntimeFailed`
9. `PluginRuntimeUnloaded`

Explainability reports validation outcomes, rejection rationale, lifecycle history, current stage, and failure rationale. The queryable Institutional Plugin Execution Graph records:

```text
Plugin → Dependencies → Capabilities → Resources → Workloads → Miner Processes → Statistics
```

# 10. Ownership and Determinism Rules

IMPR's `PluginRuntimeRegistry` is a transient local working set of currently hosted instances. It is explicitly not the reserved platform Plugin Registry Authority and is never a durable or authoritative inventory. Given the same handed-in units, provider outcomes, UUID supplier, and injected clock, validation and lifecycle behavior are deterministic.

# 11. Acceptance Criteria and Test Posture

Phase 30 is complete when tests prove structural and dependency rejection, certification hard refusal/acceptance, the full lifecycle including `Failed`, isolated multi-instance contexts/control, approved-context-only exposure, IMPM-only process delegation, all nine events, explainability, graph traceability, concurrent independent hosting, no direct authority implementation imports/instantiations, and no autonomous discovery API.
