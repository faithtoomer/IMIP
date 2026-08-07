# Configuration Authority

**Status:** IMPLEMENTED (Phase 02)  
**Location:** `core/configuration_authority/`  
**Authority:** PHASE-02 / ADR-0005 / ADR-0006

## Purpose

The Configuration Authority is IMIP's institutional Single Source of Truth. It is the sole owner of every configurable value in the platform — no other authority, plugin, dashboard, API, or miner may define, duplicate, or own configuration.

## Layout

```text
core/configuration_authority/
  src/
    types.ts            Shared types (ConfigEntry, Snapshot, Events, ...)
    registry.ts          The registry + all default entries (SSOT enforcement)
    sources.ts            Source resolution: cli > env > file > secrets > default
    validate.ts             Type/range/enum/required/cross-field/dependency validation
    snapshot.ts              Immutable runtime snapshot creation (deep freeze)
    events.ts                 Interim publish/subscribe surface (stands in for the
                               institutional Event Bus until it is implemented)
    security.ts                Sensitive-value masking/redaction
    explainability.ts           Append-only, immutable audit trail
    errors.ts                    Structured, fail-fast error types
    pluginConfig.ts                Plugin configuration schema registration + validation
    ConfigurationAuthority.ts       Orchestrator: load -> validate -> snapshot -> read API
    index.ts                        Public exports
  tests/                             Full §17 coverage (registry, sources, validation,
                                     snapshot immutability, events, masking, explainability,
                                     plugin config, failure scenarios, migration)
```

## Usage

```ts
import { ConfigurationAuthority } from './core/configuration_authority/src/index.js';

const authority = new ConfigurationAuthority({ filePath: './imip.config.json' });
const snapshot = authority.load();

authority.get('platform.locale');
authority.getCategory('electricity');
authority.subscribe('ConfigurationUpdated', (payload) => { /* ... */ });

// Only approved mutation path:
authority.requestUpdate('platform.locale', 'fr-FR', 'operator request', 'Dashboard');
```

## Scope Boundary

Per ADR-0006, this registry contains **system-state configuration only**. Conditional/operational rules (profitability thresholds, thermal/power limits, schedules, failover behavior) are deferred to the future Policy Authority (`core/policy_engine/`). See `docs/phase-02/configuration-policy-boundary.md` for the full mapping.

## Governance

- No configuration value may be added outside this registry (`architecture/GOVERNANCE.md` §7, institutional service uniqueness).
- No consumer reads configuration from disk, env, or CLI directly — only through `ConfigurationAuthority`'s read API.
- No direct mutation interface is exposed; `requestUpdate()` is the only approved path and always produces an audit record.
