# Institutional Configuration Management System (ICMS)

**Status:** IMPLEMENTED (Phase 02, v2.0)  
**Location:** `core/configuration_authority/`  
**Authority:** PHASE-02 / ADR-0005 / ADR-0006 / ADR-0007

## Purpose

ICMS is IMIP's institutional Single Source of Truth. It is the sole owner of every configurable value in the platform — no other authority, plugin, dashboard, API, or miner may define, duplicate, or own configuration. ICMS is the implementation of the "Configuration Authority" entry in `architecture/AUTHORITY_REGISTRY.md` — not a separate authority.

## Layout

```text
core/configuration_authority/
  src/
    types.ts            Shared types (ConfigEntry, Snapshot, Provenance, Migration, ...)
    registry.ts          The registry + all 44 default entries (SSOT enforcement)
    sources.ts            Source resolution: cli > env > secrets > file > default
    validate.ts             Type/range/enum/required/cross-field checks (shared helper)
    pipeline.ts              9-stage validation pipeline (syntax -> policy-compatibility)
    compatibility.ts          CompatibilityRegistry extension point (hardware/policy stages)
    snapshot.ts                Immutable, content-addressed snapshot + SnapshotStore (rollback)
    provenance.ts                Per-key ProvenanceStore (source, owner, history, snapshot ver.)
    migrations.ts                  MigrationRunner framework (chained, audited)
    events.ts                       Interim publish/subscribe surface (stands in for the
                                     institutional Event Bus until it is implemented)
    security.ts                      5-tier classification + masking/redaction
    explainability.ts                 Append-only, immutable change audit trail
    errors.ts                          Structured, fail-fast error types
    pluginConfig.ts                     Plugin configuration schema registration + validation
    ConfigurationAuthority.ts            Orchestrator: sources -> migrate -> validate -> snapshot
                                          -> activate -> provenance -> read API
    index.ts                              Public exports
  tests/                                   81 tests across 13 files — registry, source precedence,
                                           pipeline (all 9 stages), snapshot/rollback, events,
                                           security masking, explainability, provenance, migrations,
                                           versioning, plugin config, failure scenarios, performance
```

## Usage

```ts
import { ConfigurationAuthority } from './core/configuration_authority/src/index.js';

const authority = new ConfigurationAuthority({ filePath: './imip.config.json' });
const snapshot = authority.load();

// Optional (Phase 05): mirror every event onto the shared Institutional Event Bus
// (core/event_bus/) without changing anything above — pass `eventBus` in options.
// See docs/phase-05/event-bus-connection.md.

authority.get('platform.locale');
authority.getCategory('electricity');
authority.getProvenance('wallet.addresses'); // masked — secret tier
authority.getVersionInfo();
authority.subscribe('ConfigurationChanged', (payload) => { /* ... */ });

// Only approved mutation paths:
authority.requestUpdate('platform.locale', 'fr-FR', 'operator request', 'Dashboard');
authority.rollback(snapshot.version, 'revert bad change', 'Dashboard');
```

## Scope Boundary

Per ADR-0006 and ADR-0007, ICMS owns **configuration (system state) only** — not Policy (conditional operational rules) and not Operational State (live/observed platform condition). See `docs/phase-02/configuration-policy-boundary.md` for the full key mapping.

## Governance

- No configuration value may be added outside this registry (`architecture/GOVERNANCE.md` §7, institutional service uniqueness).
- No consumer reads configuration from disk, env, or CLI directly — only through `ConfigurationAuthority`'s read API.
- No direct mutation interface is exposed; `requestUpdate()` and `rollback()` are the only approved paths, both fully audited and provenance-tracked.
- `hardwareCompatibility` / `policyCompatibility` extension points ship with zero registered checkers by design (no Hardware/Policy Authority exists yet) — see ADR-0007 and PHASE-02 §22.
