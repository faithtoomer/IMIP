# ADR-0005: Configuration Authority as Institutional SSOT

**Status:** Accepted  
**Date:** 2026-08-07  
**Phase:** 02  
**Deciders:** Architectural Authority (Specification)

## Context

Before any other authority is implemented, IMIP needs one place that owns every configurable value. Without it, later authorities would each invent their own configuration handling, producing duplicate and conflicting sources of truth — the same failure mode the trading engine predecessor was built to avoid.

## Decision

Implement the Configuration Authority (`core/configuration_authority/`) as the institutional Single Source of Truth:

- A registry of every configuration key, each with exactly one owner, a type, a default, and a runtime-mutability classification.
- Deterministic source precedence: CLI args → env vars → config file → secure secrets store → built-in defaults.
- Full validation (type, range, required, cross-field, dependency) before any value becomes active; invalid startup configuration fails fast.
- An immutable runtime snapshot; all reads go through the snapshot, never through disk/env/CLI directly.
- A local, interim publish/subscribe event surface (`ConfigurationLoaded`, `Validated`, `Rejected`, `Updated`, `Reloaded`, `SnapshotCreated`) standing in for the institutional Event Bus until it exists.
- Mandatory redaction of sensitive values in logs, telemetry, exceptions, and audit records.
- An append-only, immutable audit trail for every configuration change.
- A single authorized mutation path (`requestUpdate`) — no other interface can mutate configuration.
- Plugin configuration schemas, namespaced under `plugins.<id>.*`, validated the same way as core entries.

## Consequences

- Every future authority reads configuration exclusively through this module.
- Adding a configuration value is a registry registration, not a new ad hoc mechanism.
- The Event Bus, when implemented, replaces the interim `ConfigEventBus` without changing Configuration Authority call sites.
- The Database Authority, when implemented, becomes the durable home for the audit trail; the interim JSONL sink is an optional bridge, not the source of truth.
