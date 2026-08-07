# Plugin Manifest Standard

**Status:** Architectural Standard  
**Phase:** 00 (defined; not implemented)  
**Authority:** PHASE-00 Repository Governance

## Purpose

The platform discovers plugins exclusively through manifests. Directory names are organizational only and are never used to infer functionality.

## Minimum Manifest Information

Every plugin manifest shall declare:

| Field | Description |
|-------|-------------|
| Plugin ID | Stable unique identifier |
| Version | Plugin version |
| Capability Type | Capability class (CPU, GPU, ASIC, or future class) |
| Supported Hardware | Hardware targets supported by the plugin |
| Supported Algorithms | Mining algorithms supported |
| Miner Backend | Backend miner/adapter identity |
| Health Endpoints | Plugin-local health reporting surfaces |
| Statistics Interface | Statistics/metrics interface declaration |
| Configuration Schema | Schema for plugin-local configuration |

## Discovery Rules

1. Manifests are the sole discovery mechanism.
2. The platform shall never infer functionality from directory names.
3. Invalid or incomplete manifests are rejected.
4. Accepted manifests feed the Platform Capability Registry (when implemented).

## Phase 00 Note

No plugin manifests are created in Phase 00. Manifest files are an implementation concern for future approved specifications. This document establishes the standard only.
