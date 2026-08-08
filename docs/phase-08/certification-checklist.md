# Phase 08 — Certification Checklist (IDA)

**Specification:** `specs/PHASE-08-institutional-data-authority.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria (§19)

| Criterion | Certified | Evidence |
|---|---|---|
| Every domain has exactly one registered schema | YES | `SchemaManager.register()` throws `DuplicateSchemaError`; `tests/schemaManager.test.ts` |
| All SQL confined to one file | YES | `sqliteStorageProvider.ts` only; `StorageProvider` interface elsewhere |
| Every write is validated, transactional, and audited | YES | `DataAuthority.create/update/delete`; `tests/crud.test.ts`, `tests/auditTrail.test.ts` |
| Reads apply pending migrations transparently | YES | `applyMigrationsOnRead()`; `tests/migrations-integration.test.ts` |
| Concurrent updates cannot silently overwrite each other | YES | Monotonic `revision` counter; `tests/concurrency.test.ts` |
| Backups are real, atomic, and validated before restore | YES | `VACUUM INTO` / `PRAGMA integrity_check`; `tests/backup-recovery.test.ts` |
| Sensitive fields never appear unredacted in audit records | YES | `redactSensitiveFields()`; `tests/auditTrail.test.ts` |
| Tests pass | YES | 13 files / 60 tests (383 total), `npx vitest run` |
| Documentation is complete | YES | `core/data_authority/README.md`, this directory |

## Institutional Completion Standard (§20 contract)

| Requirement | Certified |
|---|---|
| No placeholder or incomplete implementations | YES — `DataMigrationRunner` and `KnowledgeGraph` are real, fully functional generic mechanisms with nothing currently registered, not stubs |
| No authority persists through a private mechanism | YES — every persisted domain is a registered `DomainSchema` governed by `DataAuthority` |
| No SQL outside the storage provider | YES — `sqliteStorageProvider.ts` is the only file containing SQL |
| Audit trail is structurally immutable | YES — `DataAuditTrail` exposes no update or delete method |
| Two real bugs found by the test suite, fixed before certification | YES — see `docs/phase-08/implementation-summary.md` §4 |

## Architect's Enhancement (§22 — Institutional Knowledge Model)

| Requirement | Certified |
|---|---|
| Typed, bidirectionally-queryable relationship graph | YES — `KnowledgeGraph.link()` / `relatedFrom()` / `relatedTo()` |
| Generic across domains and relationship types | YES — no hardcoded pairing logic; `tests/knowledgeGraph.test.ts` demonstrates all four spec-named example pairings without any domain-specific code |
| Implemented in full, not reserved | YES — unlike Phase 05's EICE, the spec names IKM as core Phase 08 scope |

## Certification Statement

Phase 08 — Institutional Data Authority (IDA), including the Institutional Knowledge Model (IKM) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08. Type-check (src + tests), build, and the full 383-test suite (60 for IDA) pass.
