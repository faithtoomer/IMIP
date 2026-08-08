# Plugin Discovery Architecture

**Status:** Architectural Standard  
**Phase:** 01 (defined; not implemented)  
**Authority:** PHASE-01 §15 (Deliverable 8) / `architecture/RUNTIME_ARCHITECTURE.md` §3 (Layers 4–6)

## Purpose

Define how the platform discovers, validates, and registers plugins without ever hardcoding plugin knowledge or inferring functionality from directory names, per `PLUGIN_CONTRACT.md` and `PLUGIN_MANIFEST_STANDARD.md`.

## Discovery Flow

```text
Plugin Manager scans plugins/<class>/<name>/
    ↓
Manifest located and parsed
    ↓
Manifest validated against Plugin Manifest Standard
    ↓ (invalid → rejected, logged, plugin excluded)
Capabilities registered into the Capability Registry (Plugin Registry Authority)
    ↓
Plugin activated under Core Runtime control
    ↓
Health and statistics surfaces consumed by Core services
```

## Ownership

| Concern | Owner |
|---------|-------|
| Discovery + validation | Plugin Registry Authority |
| Registration target | Capability Registry (Capability Layer) |
| Activation + lifecycle control | Mining Authority |
| Communication with mining software | Mining Adapter Layer |

## Rules

1. The platform discovers plugins exclusively through manifests.
2. Invalid or incomplete manifests are rejected; the plugin is excluded from registration.
3. The platform never infers functionality from directory or file names.
4. Authorities never interact with plugins directly — only the Plugin Registry Authority and Mining Authority, through the Plugin Layer and Mining Adapter Layer boundaries, per the Dependency Laws (`RUNTIME_ARCHITECTURE.md` §5).
5. A rejected or unregistered plugin has no capability visibility anywhere in the runtime.

## Phase 01 Note

No plugin discovery code is implemented in Phase 01. This document establishes the discovery architecture only.
