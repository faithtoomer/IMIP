# IMIP PHASE 02

# Configuration Authority (Single Source of Truth)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Institutional Engineering Specification**

---

# 1. Mission

The Configuration Authority is the sole owner of every configurable value within IMIP.

No configuration value may exist outside of the Configuration Authority.

The Configuration Authority is the institutional Single Source of Truth (SSOT).

No other authority, plugin, dashboard, API, miner, or subsystem may define, duplicate, or own configuration values.

All runtime configuration flows through this authority.

---

# 2. Objectives

Deterministic, Immutable at runtime unless explicitly authorized, Fully typed, Versioned, Validated, Explainable, Auditable, Extensible, Hot-reload capable (where explicitly permitted), Backward compatible through migrations.

---

# 3. Ownership

Platform, Mining Policies, Electricity, Hardware Policies, Pool Configuration, Wallet Configuration, AI, Dashboard, Database, Telemetry — full key lists as specified in the approved draft. See §16 for the binding scope adjustment applied at implementation time.

---

# 4. Architecture

```text
Configuration Authority
        │
        ▼
Configuration Registry
        │
        ▼
Configuration Validation
        │
        ▼
Configuration Snapshot
        │
        ▼
Approved Read API
        │
   Authorities
```

No authority accesses configuration directly from disk.

---

# 5. Configuration Registry

Every configuration entry includes: unique identifier, category, description, data type, default value, validation rule, range, owner, runtime mutability, version introduced, version deprecated, security classification.

---

# 6. Configuration Categories

Platform, Hardware, Mining, Electricity, Wallet, Pools, AI, Dashboard, Telemetry, Security, Database, Notifications, Plugins, Policies.

---

# 7. Configuration Sources

Deterministic precedence:

1. Command-line arguments
2. Environment variables
3. Configuration file
4. Secure secrets store
5. Built-in defaults

---

# 8. Validation

Type checking, range checking, required fields, cross-field validation, dependency validation, plugin compatibility, hardware compatibility. Invalid configuration prevents activation. No partial activation.

---

# 9. Configuration Snapshot

Immutable runtime snapshot after validation. Authorities read only from this snapshot. Changes require an approved update workflow.

---

# 10. Configuration Events

ConfigurationLoaded, ConfigurationValidated, ConfigurationRejected, ConfigurationUpdated, ConfigurationReloaded, ConfigurationSnapshotCreated.

---

# 11. Security

Wallet credentials, API keys, authentication tokens, and secret values shall never appear in logs, telemetry, exceptions, or explainability records.

---

# 12. Explainability

Every configuration change generates an audit record: timestamp, previous value, new value, reason, initiating authority, validation outcome, approval status. No silent configuration changes.

---

# 13. Plugin Integration

Plugins may declare configuration schemas. Plugins may not own configuration storage. Configuration Authority validates plugin configuration before plugin activation. Plugins receive validated configuration only.

---

# 14. Public Interface

Read-only interfaces: retrieve current configuration, retrieve category, retrieve validated value, retrieve immutable snapshot, subscribe to configuration events, request authorized configuration update. No direct mutation interface is exposed to general consumers.

---

# 15. Error Handling

Fail fast, produce structured diagnostics, explain the cause, prevent unsafe startup, preserve the last known valid configuration when appropriate. No silent fallbacks.

---

# 16. Configuration / Policy Boundary (Architect's Enhancement, Binding)

Configuration answers **"What is the system configured to do?"** Policy answers **"Under what conditions is the system allowed to act?"**

This separation keeps the Configuration Authority focused on system state while the Policy Authority (`core/policy_engine/`, reserved in Phase 01) governs operational behavior.

**Binding scope adjustment:** the following §3 values are conditional/operational rules, not system state, and are therefore **excluded from the Phase 02 Configuration Registry** and deferred to the Policy Authority:

- Profit threshold / minimum profitability
- Mining schedule, auto-start policy, auto-stop policy
- Maximum CPU / GPU utilization
- Thermal limits, power limits, fan policies
- Pool failover rules, retry policy

All other §3 values (platform identity, electricity rates, wallet addresses, pool endpoint lists, AI model settings, dashboard/database/telemetry settings, static hardware reservation) are implemented as Configuration Authority entries.

See `docs/phase-02/configuration-policy-boundary.md` for the complete key-by-key mapping and `architecture/adr/ADR-0006-configuration-policy-boundary.md` for the decision record.

---

# 17. Testing Requirements

Unit tests, validation tests, schema tests, version migration tests, event publication tests, snapshot immutability tests, security masking tests, failure scenario tests.

---

# 18. Acceptance Criteria

Every configuration value has one owner. Runtime snapshots are immutable. Validation is comprehensive. Configuration precedence is deterministic. Plugin configuration is supported. Sensitive data is protected. Events are published correctly. Audit records are generated. Test suite passes. Documentation is complete.

---

# 19. Certification Checklist

- Single Source of Truth established
- No duplicate configuration ownership
- Immutable runtime snapshot
- Deterministic configuration loading
- Complete validation coverage
- Secure handling of secrets
- Full auditability
- Production-ready implementation
