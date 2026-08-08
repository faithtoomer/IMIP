# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 08

# Institutional Data Authority (IDA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Foundational Authority

> Phase 08 is Program II's first phase. Program I (Phases 00–07) is certified complete — see `docs/program-1-certification/`. IDA is the sole owner of persistent platform knowledge: not "a database," but the institutional authority governing persistence, lifecycle, integrity, versioning, retention, access, transactions, backup/recovery, explainability, and security for every domain that needs to survive a process restart.

---

# 1. Mission Statement

IDA is the sole institutional authority for persistent data. No authority persists state through its own private storage mechanism; every domain that needs durability is a registered `DomainSchema` governed by IDA, backed by a storage-technology-independent abstraction (Law 2).

---

# 2–4. Objectives, Principles, Responsibilities

IDA owns: schema governance and versioning, CRUD with validation, transactions (including nested/savepoint semantics), optimistic concurrency, retention/purge, backup and recovery, the full audit trail of every write, and read-time schema migration. IDA does **not** own business logic, decision-making, mining, scheduling, or hardware management — it is a governed persistence substrate other authorities write through, not a business-rules engine.

---

# 5. Storage Independence (Law 2)

All SQL lives in exactly one file, `sqliteStorageProvider.ts`, behind the `StorageProvider` interface (`storageProvider.ts`). `DataAuthority` and every other module in `core/data_authority/src/` interact only with that interface — swapping the backing store (e.g. to Postgres) means writing one new class, with zero changes anywhere else. The default implementation is Node's built-in `node:sqlite` (`DatabaseSync`) — no external dependency required.

---

# 6. Data Domains

18 institutional data domains (`DataDomain` in `types.ts`): `configuration`, `capability-registry`, `plugin-registry`, `hardware-inventory`, `hardware-digital-twins`, `runtime-state`, `event-history`, `decision-history`, `profitability-history`, `benchmark-results`, `mining-sessions`, `wallet-metadata`, `pool-metadata`, `telemetry`, `notifications`, `ai-models`, `explainability-records`, `audit-logs`. Every persisted record carries the same governance envelope (`DataRecord`) regardless of domain — one generic repository, parameterized by domain, not one hand-written repository class per domain.

---

# 7. Persistence Layer

`SqliteStorageProvider` stores each record's `data` as an opaque JSON blob alongside real governance columns (`id`, `version`, `revision`, `lifecycle_stage`, `created_at`, `updated_at`) in a per-domain table (`domain_<name>`). Queries against fields inside `data` use SQLite's JSON1 `json_extract`; queries against governance fields (e.g. `createdAt`, `lifecycleStage`) resolve to their real column instead — both paths are validated against a safe-identifier pattern before interpolation (SQL-injection defense).

---

# 8. Transactions

`TransactionManager.runInTransaction()` — the outermost call issues a real `BEGIN`/`COMMIT`/`ROLLBACK`; any call nested inside an active transaction instead issues `SAVEPOINT`/`RELEASE SAVEPOINT`/`ROLLBACK TO SAVEPOINT`, so a failure inside a nested `DataAuthority.transaction()` call rolls back only its own work without aborting the outer transaction. Exposed publicly via `DataAuthority.transaction()` for multi-record atomic operations.

---

# 9. Schema Governance

`SchemaManager` — every domain has exactly one registered `DomainSchema` (duplicate registration throws), each field typed (`string | number | boolean | json | timestamp`), optionally `required`/`unique`/`sensitive`. `validate()` runs type/required checks plus an optional custom `schema.validate?.()` for cross-field rules. `DataRecord.version` tracks which schema version a record's `data` currently conforms to — deliberately **not** the concurrency-control counter (see §8/§16).

---

# 10. Migration & Retention

`DataMigrationRunner` chains registered `DataMigrationDefinition`s (mirrors ICMS's migration pattern) and is applied transparently by `DataAuthority.get()`/`find()` the first time a record is read after its schema version has advanced — migrated data is written back, so the migration runs at most once per record. `DataAuthority.purge()` deletes records whose `createdAt` predates a cutoff, recording one `'purge'` audit entry per deleted record (§13).

---

# 11. Access Governance

Every read and write goes through `DataAuthority`'s typed public methods (`create`/`update`/`delete`/`get`/`find`/`count`/`exists`); there is no path to the underlying storage that bypasses schema validation or audit recording.

---

# 12. Query Interface

Backend-independent `QueryOptions` (`filters`/`sortBy`/`sortDirection`/`limit`/`offset`) with typed `QueryFilter` operators (`eq`/`ne`/`gt`/`gte`/`lt`/`lte`/`contains`) — the same interface regardless of what `StorageProvider` is behind it.

---

# 13. Audit Trail

`DataAuditTrail` is self-hosted: every audit entry is itself a `DataRecord` in the `'audit-logs'` domain, persisted through the exact same `StorageProvider` as everything else. Law 6 (immutable audit trail) is enforced structurally — the class exposes no update or delete method for any reason. Audit recording always runs in its own transaction, deliberately separate from the data-changing transaction it describes: a failed `create`/`update`/`delete` still produces a permanent audit record, which would not survive if it were rolled back together with the change it failed to make. Sensitive fields (`FieldDefinition.sensitive`) are redacted before being written into `previousValue`/`newValue`.

---

# 14. Backup & Recovery

`backup()`/`createRecoveryCheckpoint()` use SQLite's `VACUUM INTO` for an atomic, consistent snapshot to a destination file; `validateBackup()` opens the snapshot and runs `PRAGMA integrity_check`. `restore()` validates the backup first, then closes and replaces the live storage connection, re-establishing every previously registered domain table — refusing to restore from an unvalidated or missing file rather than silently proceeding.

---

# 15. Telemetry & Metrics

`getMetrics()`: write/read/transaction counts, average query latency, average transaction duration, storage size in bytes, and migration count — a read surface for a future Telemetry Authority, matching the pattern established in Phases 05/07.

---

# 16. Optimistic Concurrency

Concurrency control compares a monotonic per-record `revision` counter (starts at 1 on create, incremented on every update) — not `updatedAt`. Wall-clock timestamps only have millisecond resolution; two writes to the same record can legitimately land in the same millisecond, which would let a timestamp-based check silently pass a stale write through. `update()` accepts an optional `expectedRevision`; a mismatch throws `OptimisticConcurrencyError` and leaves the stored data unchanged.

---

# 17. Error Handling

`UnknownDomainError`, `DuplicateSchemaError`, `SchemaValidationError`, `DuplicateRecordError`, `RecordNotFoundError`, `OptimisticConcurrencyError`, `InvalidQueryFieldError`, `BackupFailedError` — all typed subclasses of `DataAuthorityError` with a stable `code`.

---

# 18. Testing Requirements

60 tests across 13 files: schema governance, migrations (unit + `DataAuthority`-level integration), the SQLite storage provider (CRUD, JSON filtering, SQL-injection field-name rejection, transactions/savepoints, real backup/restore round-trips, relationship queries), CRUD, audit trail (including sensitive-field redaction and structural immutability), transactions (including nested rollback), optimistic concurrency, retention/purge, backup & recovery, the Knowledge Graph, metrics, and performance smoke tests.

---

# 19. Acceptance Criteria

Every domain has exactly one registered schema. All SQL is confined to one file. Every write is validated, transactional, and audited. Reads apply pending migrations transparently. Concurrent updates cannot silently overwrite each other. Backups are real, atomic, and validated before restore. Sensitive fields never appear unredacted in audit records. Tests pass. Documentation complete.

---

# 20. Cursor Implementation Contract — Compliance Note

No placeholder implementations. The zero-migration `DataMigrationRunner` and zero-registration `KnowledgeGraph` are real, fully functional generic mechanisms with nothing currently plugged in — not stubs — matching the pattern already established for ASIC discovery (IHIS) and database persistence (IEB).

---

# 22. Architect's Enhancement: Institutional Knowledge Model (IKM)

**Implemented in full** (not deferred, unlike Phase 05's EICE) — `knowledgeGraph.ts`. A typed, bidirectionally-queryable relationship graph (`fromDomain`/`fromId`/`relationshipType`/`toDomain`/`toId`) between any two entities, possibly across domains. Generic by design, like IRBLM's dependency graph: it does not hardcode the specific relationship types the spec names as examples (Hardware ↔ Capabilities, Plugins ↔ Capabilities, Decisions ↔ Explainability, Mining Sessions ↔ Profitability) — any two entities in any two domains can be linked today, and every example pairing works the moment those domains have real data, with zero changes to `KnowledgeGraph` itself.
