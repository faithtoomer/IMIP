# ADR-0030: Institutional Mining Plugin Runtime

**Status:** Accepted  
**Date:** 2026-08-09  
**Phase:** 30  
**Deciders:** Architectural Authority (Specification)

## Context

Mining plugins need a bounded execution host after a caller has selected a concrete plugin unit. That host must not quietly become a second discovery registry, an activation-authorization decision maker, a hardware/process bypass, or an unbounded plugin capability surface.

## Decision

- Implement IMPR in `core/mining_plugin_runtime/` as a peer institutional framework with validation, certification gate, isolated runtime context, guarded lifecycle, events, explainability, transient working-set registry, process delegation, and execution graph modules.
- Add Event Bus category `mining-plugin-runtime` and logical Data Domain `mining-plugin-runtime-registry` additively.
- Require the caller to supply `load(manifest, package, options)`; do not add scanning, directory enumeration, registry enumeration, or autonomous discovery APIs.
- Use structural injected provider contracts only; do not import or instantiate authority/framework implementation classes.

## Runtime Executes, It Does Not Decide Trust or Inventory

IMPR is a mechanical execution host, not the authoritative inventory of plugins and not the decision maker for activation authorization. The reserved, still-unimplemented Plugin Registry Authority owns discovery and inventory. The reserved, still-unimplemented Mining Authority owns mining activation/control decisions. IMPR holds only a transient local working set of instances it is actively executing after a caller handed them in.

## Certification Is a Hard Gate Via Injected Provider, Never Bypassed

A manifest/package unit passes structural and declared-versus-available dependency checks before IMPR asks `PluginCertificationStatusProvider` for a record. No record or `certified: false` stops loading and records `Failed`. IMPR does not manufacture a certification, infer trust, or implement certification rules. The provider is intentionally the Phase 31 IMPCA integration seam.

## Process Starts Always Delegate to IMPM, Never Spawned Directly

IMPR has no `child_process` import, launcher, or OS process creation code. Its only start path delegates through injected `ProcessManagerHandle.launch`, letting Phase 28 IMPM remain the security/resource-governed process lifecycle choke point. This preserves no direct ISTA/IRIA bypass and makes IMPR's role mechanical rather than operationally privileged.

## No Autonomous Discovery — Operates Only on Explicitly Handed-In Plugin Instances

There is no `scan`, `discover`, or `discoverAll` API. The initial `Discovered` lifecycle state records receipt of an explicit unit, not a platform search. Dependency checking is intentionally not a resolver: it compares only what the manifest declares against approved injected interfaces and already-loaded manifests in IMPR's own working set.

## Controlled Context and Isolation

Each Plugin Instance UUID gets a fresh frozen context with exactly ten injected slots: Configuration, Event Bus, Resources, Hardware intelligence, Power, Thermal, Health, Statistics, Mining frameworks, and Security. No process manager, registry, another plugin context, raw hardware-control surface, filesystem facility, or arbitrary write surface is provided. Instance UUID scope guards prevent one plugin instance from controlling another.

## Deterministic Lifecycle and Traceability

The guarded nominal lifecycle is `Discovered → Validated → Loaded → Initialized → Ready → Active → Paused → Stopping → Stopped → Unloaded`, with `Failed` reachable from every non-terminal stage. All time is injected. The Institutional Plugin Execution Graph records the queryable chain `Plugin → Dependencies → Capabilities → Resources → Workloads → Miner Processes → Statistics` without taking ownership of any linked entity.

## Consequences

- A selected plugin can execute with a small auditable provider surface.
- Discovery, authoritative inventory, and authorization remain available for their designated future authorities rather than being duplicated.
- Certification remains mandatory today without prematurely implementing Phase 31.
- OS process lifecycle stays singularly governed by IMPM.
- Multi-plugin execution is independently traceable and isolated.

## Rejected Alternatives

- **Allow IMPR to find plugin packages itself:** rejected; that would implement the reserved Plugin Registry Authority.
- **Let certification be advisory at runtime:** rejected; a non-certified plugin would breach the trust boundary.
- **Expose Miner Process Manager or raw process spawn in the context:** rejected; it expands plugin privilege and bypasses IMPM governance.
- **Expose direct hardware-control or filesystem-write APIs:** rejected; neither is an approved IMPR context capability.
- **Make IMPR decide activation authorization:** rejected; that duplicates the reserved Mining Authority.
