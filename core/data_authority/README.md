# Institutional Data Authority (IDA)

**Status:** IMPLEMENTED (Phase 08)  
**Location:** `core/data_authority/`  
**Authority:** PHASE-08 / ADR-0011

## Purpose

IDA is the sole institutional authority for persistent platform knowledge — not "a database," but the authority that owns persistence, data governance, lifecycle, integrity, versioning, retention, access, transactions, backups, recovery, explainability, and security for every domain that needs to survive a process restart. No authority persists state through its own private storage mechanism.

## Layout

```text
core/data_authority/
  src/
    types.ts                  DataDomain (18), DomainSchema, DataRecord, QueryOptions,
                                DataAuditRecord, RelationshipRecord, DataAuthorityMetrics, ...
    errors.ts                   Structured, typed error taxonomy
    storageProvider.ts            StorageProvider — the Law 2 abstraction (all SQL forbidden
                                   outside sqliteStorageProvider.ts)
    sqliteStorageProvider.ts        The real, default backend — node:sqlite (DatabaseSync)
    schemaManager.ts                  SchemaManager — SSOT for per-domain schemas + validation
    migrations.ts                      DataMigrationRunner — chained schema migrations
    transactionManager.ts                Real BEGIN/COMMIT/ROLLBACK + nested SAVEPOINTs
    auditTrail.ts                         DataAuditTrail — self-hosted, structurally immutable
    knowledgeGraph.ts                      KnowledgeGraph — the Architect's Enhancement (§22)
    security.ts                             Sensitive-field redaction for audit records
    DataAuthority.ts                         The orchestrator — CRUD, transactions, retention,
                                              backup/recovery, metrics
    index.ts                                  Public exports
  tests/                                       60 tests across 13 files
```

## Usage

```ts
import { DataAuthority } from './core/data_authority/src/index.js';

const ida = new DataAuthority(); // in-memory by default; { filePath } for on-disk
ida.registerDomainSchema({
  domain: 'benchmark-results',
  version: 1,
  fields: [
    { name: 'name', type: 'string', required: true, unique: true },
    { name: 'value', type: 'number', required: true },
  ],
});

const record = ida.create('benchmark-results', { name: 'gpu-1', value: 42 }, 'Hardware Authority');

// Optimistic concurrency — compares a monotonic revision counter, not updatedAt:
ida.update('benchmark-results', record.id, { name: 'gpu-1', value: 43 }, 'Hardware Authority', {
  expectedRevision: record.revision,
});

// Atomic multi-record operations:
ida.transaction(() => {
  ida.create('benchmark-results', { name: 'gpu-2', value: 10 }, 'X');
  ida.create('benchmark-results', { name: 'gpu-3', value: 20 }, 'X');
});

// The Institutional Knowledge Model — link any two entities, in any two domains:
ida.knowledge.link('hardware-inventory', 'gpu-1', 'has-capability', 'capability-registry', 'gpu-mining');
ida.knowledge.relatedFrom('hardware-inventory', 'gpu-1');

// Backup, validate, restore:
ida.backup('./backup.db');
ida.validateBackup('./backup.db');
ida.restore('./backup.db');

ida.getMetrics();
ida.close();
```

## Scope Boundary

IDA owns schema governance, CRUD, transactions (incl. nested/savepoint semantics), optimistic concurrency, retention/purge, backup/recovery, the audit trail, read-time schema migration, and entity relationships — never business logic, decision-making, mining, scheduling, or hardware management (§4).

## Governance

- All SQL lives in exactly one file (`sqliteStorageProvider.ts`); every other module depends only on the `StorageProvider` interface (Law 2).
- `version` (schema conformance) and `revision` (optimistic-concurrency counter) are separate fields — a record's schema can migrate without ever looking like a concurrency conflict, and vice versa.
- Concurrency control compares `revision`, a monotonic integer, not `updatedAt` — timestamp resolution cannot cause a false pass under concurrent writes.
- Governance fields (`id`, `version`, `revision`, `lifecycleStage`, `createdAt`, `updatedAt`) query against real SQL columns; every other field queries through `json_extract` against the opaque `data` blob — both paths validate field names against a safe-identifier pattern before interpolation.
- Audit recording is always its own transaction, separate from the data-changing transaction it describes (Law 5/Law 6) — a failed write still produces a permanent audit record.
- `DataAuditTrail` exposes no update or delete method for any reason — immutability is structural, not conventional.
- The Institutional Knowledge Model (`knowledge`) is generic — no hardcoded relationship types or domain pairings — and is implemented in full, not reserved.
