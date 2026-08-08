# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 14

# Institutional Backup, Recovery & Resilience Authority (IBRRA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Core Infrastructure Authority

> The last foundational infrastructure authority before Program II moves into specialized platform capabilities. Not "backup and restore" — operational resilience: the platform recovers from failure deterministically, explainably, and auditably. See ADR-0017.

---

# 1. Mission Statement

IBRRA is the sole authority for backup management, recovery orchestration, resilience planning, disaster preparedness, and recovery verification. No authority implements independent backup or recovery mechanisms.

---

# 2. Mission Objectives

Backup orchestration, backup scheduling integration, backup validation, recovery orchestration, snapshot management, restore verification, disaster recovery planning, recovery auditing, backup retention, recovery testing, explainable recovery, a real extension point for future fleet disaster recovery.

---

# 3. Institutional Principles

1. **Single Recovery Authority** — IBRRA is the sole owner of backup and recovery operations.
2. **Recoverability First** — a backup is not valid until verified as recoverable; verification is mandatory, not optional, in `createBackup()`.
3. **Backup Independence** — backup files live in ISMA-managed storage, logically independent from the live runtime.
4. **Explainability** — every backup/recovery answers what/why/where/when/verified/why-recovery/succeeded via `explainBackup()`/`explainRecovery()`.
5. **Recovery Integrity** — a compatibility or integrity check failure halts recovery (`failed`), never a silent partial recovery.
6. **Deterministic Recovery** — the same verified recovery point restores to the same state, via the same real handler methods every time.

---

# 4. Responsibilities

IBRRA owns: backup orchestration, snapshot management, restore orchestration, recovery verification, the Backup Registry, recovery planning, disaster recovery workflows, backup retention coordination, recovery auditing, recovery diagnostics, backup events. IBRRA does **not** own: data persistence, storage infrastructure, runtime lifecycle, mining, business logic, or scheduling policies.

**Reflexive Law 1 compliance**: IBRRA never re-implements the persistence/storage mechanics it orchestrates. Every domain handler wraps an already-real, already-certified authority's own methods — IDA's `backup()`/`validateBackup()`/`restore()` (Phase 08), ICMS's `SnapshotStore`/`activate()` (Phase 02), ISMA's `allocate()` (Phase 09), IHIS's `getInventory()` (Phase 03), IRBLM's `getCertificationStatus()` (Phase 07). See ADR-0017 for the full pre-implementation review that established this.

---

# 5. Runtime Architecture

```text
Authorities
        │
        ▼
Institutional Backup, Recovery & Resilience Authority
        │
        ├──────── Backup Registry
        ├──────── Domain Backup Handlers (real, per-domain orchestration)
        ├──────── Recovery Engine (deny-unless-verified)
        ├──────── Institutional Recovery Graph (§23)
        └──────── Audit Manager
                    │
                    ▼
Institutional Data Authority / Institutional Storage Management Authority
(+ Configuration Authority, Hardware Authority, Runtime Bootstrap, when supplied)
```

---

# 6. Backup Domains

A real, runtime-extensible `BackupDomainRegistry` (matching IOLA's/INCA's category-registry pattern) seeded with the 7 named domains. `plugin-registry`/`capability-registry` are real, honest, zero-producer handlers (both authorities remain reserved, ADR-0002) — not fabricated data.

---

# 7. Backup Registry

Every field §7 requires. `recoveryCompatibilityVersion` is sourced from ICMS's real `platform.version` config value when available, `'unknown'` otherwise — never fabricated.

---

# 8. Backup Types

`full`, `manual`, `scheduled`, and `snapshot` are real and fully functional. `incremental`/`differential` are registered, honest types that throw `UnsupportedBackupTypeError` — no incremental/differential primitive exists anywhere in IDA or ISMA today (both only support full snapshots); fabricating one would violate the no-placeholder standard. See ADR-0017.

---

# 9. Recovery Points

Immutable once created (`InstitutionalRecoveryGraph.registerRecoveryPoint()`, never mutated after). `domainSchemaVersions` is populated from IDA's real, per-domain `DomainSchema.version` values captured at backup time.

---

# 10. Backup Lifecycle

```text
created → validated → stored → verified → available → archived → expired → purged
```

Extended with `failed` (reachable from any non-terminal stage) beyond the spec's literal 8-node diagram — required for §17/§20 to be a real, reachable state.

---

# 11. Recovery Workflow

```text
requested → backup-selected → compatibility-verified → integrity-verified → executed → validated → certified → operational
```

Also extended with `failed`. "Compatibility Verified" checks the backup's `recoveryCompatibilityVersion` against ICMS's real current `platform.version`. "Platform Certified" queries IRBLM's real `getCertificationStatus()` when a `RuntimeOrchestrator` is supplied — never a fabricated flag. Recovery halts (`failed`) if the source backup isn't `verified` (Law 2), if compatibility fails, if re-verified integrity fails, or if any domain restore that's actually `supported` genuinely fails.

---

# 12. Verification

Checksum validation and integrity verification are real for every domain (SHA-256, reused from ISTA's crypto services rather than a third duplicate hashing implementation). "Restore simulation" for the database domain is a real, non-destructive round-trip test (`tests/handlers.test.ts` demonstrates restoring into a second, throwaway `DataAuthority` instance without touching the live one). Verification results are permanently recorded via `ResilienceAuditTrail`.

---

# 13. Disaster Recovery

Hardware/software/configuration/database recovery are all real, via the domain handlers above. Complete-platform recovery is a multi-domain `createBackup()`/`requestRecovery()` call spanning every registered handler.

---

# 14. Backup Events

The 10 named events, registered under a new, additive `'resilience'` `EventCategory` — no existing category fit (`'database'`/`'storage'` are already IDA's/ISMA's own concerns; backup/recovery is a distinct cross-cutting concept), the same additive-widening precedent as ISMA's `'storage'` (ADR-0012).

---

# 15. Explainability

`explainBackup()`/`explainRecovery()` return the record plus its full transition history together.

---

# 16. Public Interfaces

`createBackup()`, `verifyBackup()`, `requestRecovery()`, `explainBackup()`/`explainRecovery()`, `getMetrics()`, plus `registry`/`graph`/`audit`/`domains` read surfaces.

---

# 17. Error Handling

`UnregisteredBackupDomainError`, `NoDomainHandlersError`, `UnsupportedBackupTypeError`, `BackupNotFoundError`, `RecoveryNotFoundError`, `RecoveryPointNotFoundError`, `NoBackupDestinationError`, `UnverifiedBackupError`, `InvalidBackupTransitionError`, `InvalidRecoveryTransitionError` — all typed. A domain handler throwing during backup fails that backup as a whole (`failed`), never a crash.

---

# 18. Performance Metrics

`getMetrics()`: backupCount, backupFailureCount, recoveryCount, recoveryFailureCount, averageBackupDurationMs, averageRecoveryDurationMs, averageVerificationDurationMs, recoveryReadinessScore (a real ratio of verified-to-total registered backups). Exposed to the Institutional Observability & Logging Authority.

---

# 19. Testing Requirements

54 tests across 9 files: domain registry, lifecycle transitions (both backup and recovery state machines), the Backup Registry, domain handlers (real gzip+SHA-256 JSON backups, real IDA backup/restore round-trip, honest noop/unsupported-restore handling), the Institutional Recovery Graph, the immutable audit trail, the event mirror, and the orchestrator end-to-end — full backup lifecycle, handler-failure containment, re-verification detecting tampering, Law-2 unverified-backup refusal, a genuine multi-step recovery reaching `operational`, a real end-to-end IDA data round-trip (write → backup → mutate → restore → confirm reverted), real platform-version-mismatch detection, real ISMA storage wiring, metrics, explainability, and real IEB/IOLA integration.

---

# 20. Acceptance Criteria

All backup operations flow through IBRRA. The Backup Registry is authoritative. Recovery points are immutable. Backup verification is mandatory. Recovery workflows are deterministic and halt on any real failure. Disaster recovery procedures are implemented via real domain handlers. Backup events are published. Explainability is complete. Tests pass. Documentation is complete.

---

# 21. Institutional Completion Standard (ICS) / Compliance Note

No placeholder implementations: every domain handler wraps a real, already-certified authority's real method; `incremental`/`differential` backup types are honestly unsupported rather than fabricated; the noop handlers for reserved domains (Plugin/Capability Registry) return honest zero-byte results, not invented data. A pre-coding spec review (explicitly requested) found that IDA, ICMS, ISMA, and IRBLM all already have real backup/recovery/certification primitives IBRRA must orchestrate, not duplicate — this shaped the entire module's architecture.

---

# 23. Architect's Enhancement: Institutional Recovery Graph (IRG)

**Implemented in full**, per clear direction ("recommend building into the architecture from the outset"). `InstitutionalRecoveryGraph` models recovery points, platform versions, and real per-domain schema versions. Answers the spec's own example questions directly: `compatibleWith()` ("which recovery point is compatible with the current platform version?"), `diff()` ("what changed between two recovery points?"), `requiresMigration()` ("can this backup safely restore onto the current runtime without schema migration?"). Plugin/Capability Registry version tracking is a real, ready extension — `domainSchemaVersions` already generalizes to any domain the moment those registries exist and have real version concepts.
