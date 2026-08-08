# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM I — FOUNDATION

## Phase 02

# Institutional Configuration Management System (ICMS)

**Version:** 2.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Critical Foundation Authority

> Supersedes v1.0 of this specification (the original "Configuration Authority" draft). ICMS is the implementation name for the same institutional Configuration Authority defined in `architecture/AUTHORITY_REGISTRY.md` — see ADR-0005.

---

# 1. Mission Statement

ICMS is the constitutional Single Source of Truth (SSOT) for IMIP. It is not responsible for mining or decision making. It is responsible for ensuring every configurable value is defined, owned, validated, versioned, audited, explainable, distributed, and immutable during runtime unless explicitly authorized. No runtime component owns configuration outside of ICMS.

---

# 2. Objectives

SSOT, immutable runtime snapshots, dynamic configuration updates (where permitted), schema versioning, configuration migrations, plugin configuration, secret management, multi-environment deployments, full auditability, explainable configuration lifecycle, enterprise scalability.

---

# 3. Institutional Laws

1. **Single Ownership** — every configuration value has exactly one owner; no duplicate ownership.
2. **Immutable Runtime** — runtime configuration is never modified directly; changes create a new validated snapshot.
3. **Validation Before Activation** — configuration never activates before passing every validation stage.
4. **Explainability** — every value answers: what, who owns it, where it originated, why it's active, when it loaded, which rules approved it, which snapshot contains it.
5. **Deterministic Loading** — loading order always produces identical results.
6. **Secret Isolation** — confidential/restricted/secret configuration never appears in logs, telemetry, exceptions, or dashboards.
7. **No Hidden Defaults** — every default is explicitly registered.

---

# 4. Authority Responsibilities

ICMS owns: configuration architecture, registry, schema, loading, validation, snapshots, migrations, versioning, provenance, auditing, distribution, events, secret resolution.

ICMS does **not** own: mining decisions, runtime scheduling, hardware control, plugin execution, dashboard logic — and, per §20 (binding scope adjustment), operational policy or live operational state.

---

# 5. Architecture

```text
                    Configuration Sources
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
     Defaults          Configuration File     Environment
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    Secret Resolution Layer
                             │
                             ▼
                Configuration Loading Pipeline
                             │
                             ▼
                 Configuration Validation Engine
                             │
                             ▼
                 Configuration Schema Registry
                             │
                             ▼
               Immutable Runtime Configuration
                             │
                             ▼
               Configuration Distribution Service
                             │
                             ▼
                    Institutional Authorities
```

Implemented as `core/configuration_authority/src/ConfigurationAuthority.ts`, orchestrating `sources.ts` → `pipeline.ts` → `migrations.ts` → `snapshot.ts` → `provenance.ts` → the public read API.

---

# 6. Configuration Lifecycle

Definition → Registration → Loading → Validation → Conflict Resolution → Schema Validation → Dependency Validation → Snapshot Creation → Snapshot Activation → Distribution → Runtime Consumption → Audit Logging → Version History → Retirement.

No stage may be skipped.

---

# 7. Configuration Categories

Platform, Mining, Hardware, Electricity, Pools, Wallets, Dashboard, Database, AI, Notifications, Plugins — minimum set. (Telemetry, Security, and Policies remain established categories from v1.0; see `core/configuration_authority/src/types.ts`.)

---

# 8. Configuration Registry

Every entry: unique identifier, category, description, data type, default value, allowed range, validation rules, owner authority, security classification, runtime mutability, version introduced, version deprecated, cross-field validation. The registry is authoritative — `core/configuration_authority/src/registry.ts`.

---

# 9. Configuration Sources

Deterministic precedence: 1. CLI arguments, 2. Environment variables, 3. Secure secrets, 4. Configuration files, 5. Built-in defaults. The active source is recorded for every value (`ResolvedValue.source`, feeding provenance).

---

# 10. Configuration Validation Engine

Nine ordered stages: Syntax, Schema, Type, Range, Cross-field consistency, Authority compatibility, Plugin compatibility, Hardware compatibility, Policy compatibility. Configuration activates only if every stage succeeds. Implemented in `pipeline.ts`; stages 8–9 are real, functioning extension points (`compatibility.ts`) with zero rules registered until a Hardware/Policy Authority exists to supply them — see §22 on the no-placeholder-code contract.

---

# 11. Configuration Snapshot System

Immutable snapshot, content-addressed id (SHA-256 of values, `snapshot.ts`), version number, `SnapshotCreated` + `SnapshotActivated` events, retained history for rollback (`SnapshotStore`, append-only — rollback repoints "current," never deletes). Authorities consume snapshots only; direct mutation is prohibited.

---

# 12. Configuration Provenance

Every value records: current value, original source, owner authority, validation timestamp, snapshot version, override history, migration history, last modified, validation result (`provenance.ts`, `ProvenanceStore`). Permanently retained, masked for confidential/restricted/secret keys on read.

---

# 13. Configuration Security

Five-tier classification: Public, Internal, Confidential, Restricted, Secret. Confidential/Restricted/Secret are masked in logs, telemetry, exceptions, explainability, and provenance (`security.ts` `shouldMask`). See `docs/phase-02/security-classification.md` for the full per-key mapping and rationale, including the note on "encrypted at rest" scope.

---

# 14. Configuration Versioning

`schemaVersion`, `runtimeVersion`, `compatibilityVersion`, `migrationVersion` — `VersionInfo`, exposed via `getVersionInfo()`. Current schema version: `2.0.0` (`CURRENT_SCHEMA_VERSION`).

---

# 15. Configuration Migration

Migration framework (`migrations.ts`, `MigrationRunner`): chained `MigrationDefinition`s applied automatically on load, each producing a `MigrationRecord` (id, from/to schema version, timestamp, affected keys), published as `ConfigurationMigrated` and recorded into affected keys' provenance. Rollback is handled by the snapshot system (§11), not the migration runner. `DEFAULT_MIGRATIONS` ships empty — see ADR-0007 for why zero migrations is the correct current state, not an omission.

---

# 16. Configuration Events

`ConfigurationLoaded`, `ConfigurationValidated`, `ConfigurationRejected`, `SnapshotCreated`, `SnapshotActivated`, `SnapshotRolledBack`, `ConfigurationChanged`, `ConfigurationMigrated`, `SecretResolved` — plus the non-conflicting convenience event `ConfigurationReloaded`. Authorities subscribe instead of polling (`events.ts`).

---

# 17. Public Interfaces

Read-only: `getSnapshot()`, `get(id)`, `getCategory()`, `getProvenance(id)`, `getVersionInfo()`, `getSchema()` / `getSchemaAll()`, `subscribe()`. Mutation only through `requestUpdate()` and `rollback()` — both authorized workflows, both fully audited.

---

# 18. Error Handling

Fail fast, structured diagnostics (`ConfigurationError`, `ConfigurationValidationError`, `ConfigurationSyntaxError`, `ConfigurationRollbackError`), preserve the last known valid snapshot when appropriate, never silently substitute values.

---

# 19. Testing Requirements

Registry, loading/source-precedence, pipeline (all 9 stages), snapshot + rollback, immutability, security masking, migration, version, event, provenance, failure recovery, and performance-smoke tests. 81/81 passing as of this implementation — see `docs/phase-02/certification-checklist.md`.

---

# 20. Configuration / Policy / Operational State Boundary (Architect's Addendum, Binding)

Configuration answers **"what is the platform configured to do?"** Policy answers **"under what conditions is the platform allowed to act?"** Operational State represents the **live condition** of the running platform (temperatures, active miner, current profitability) — owned by future Telemetry/Health/Profitability/Mining authorities, never by ICMS.

This is a binding extension of the two-way split from Phase 02 v1.0 (ADR-0006) into three concepts. See `architecture/adr/ADR-0007-configuration-policy-operational-state.md` and `docs/phase-02/configuration-policy-boundary.md`.

---

# 21. Acceptance Criteria

Every configuration value has one owner. Registry is authoritative. Validation is comprehensive (all nine stages). Snapshots are immutable and rollback-capable. Provenance is complete. Secrets are protected. Events are published correctly. Versioning is implemented. Migration framework exists (even with zero currently-applicable migrations). Public interfaces are read-only. Tests pass. Documentation is complete.

---

# 22. Cursor Implementation Contract

SHALL: implement exactly as specified, preserve SSOT, avoid duplicate ownership, maintain authority boundaries, produce production-ready code, deliver comprehensive tests and documentation.

SHALL NOT: introduce placeholder code (TODO/FIXME/stub returns/incomplete implementations), allow direct runtime mutation, store configuration outside ICMS, duplicate configuration logic elsewhere, bypass validation or snapshot creation, expose secrets through logs/telemetry/exceptions/public interfaces.

**Compliance note:** stages 8–9 (Hardware/Policy compatibility) and the migration framework ship with zero registered rules/migrations. This is not placeholder code — `CompatibilityRegistry` and `MigrationRunner` are complete, tested, real implementations; there is simply nothing to register yet because the Hardware and Policy Authorities don't exist. See ADR-0007.
