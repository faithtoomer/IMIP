# Phase 08 — Implementation Summary (IDA)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-08-institutional-data-authority.md`  
**Branch:** `cursor/phase-00-repository-governance-5130`

---

## 1. Executive Summary

Phase 08 implements the Institutional Data Authority (IDA) — Program II's first phase and IMIP's first real persistence layer, plus the Institutional Knowledge Model (IKM) Architect's Enhancement, built in full rather than deferred. IDA is a schema-governed, transactional, audited, migration-capable, backup/recoverable persistence authority over Node's built-in `node:sqlite`, storage-technology-independent by construction (Law 2).

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Domain/schema/record types | `src/types.ts` | §6, §9 |
| Typed error taxonomy | `src/errors.ts` | §17 |
| Storage abstraction (Law 2) | `src/storageProvider.ts` | §5 |
| Real SQLite backend | `src/sqliteStorageProvider.ts` | §7 |
| Schema governance | `src/schemaManager.ts` | §9 |
| Schema migration runner | `src/migrations.ts` | §10 |
| Transactions + nested savepoints | `src/transactionManager.ts` | §8 |
| Self-hosted, structurally-immutable audit trail | `src/auditTrail.ts` | §13 |
| Institutional Knowledge Model | `src/knowledgeGraph.ts` | §22 |
| Sensitive-field redaction | `src/security.ts` | §13 |
| Orchestrator (CRUD, retention, backup/recovery, metrics) | `src/DataAuthority.ts` | §8, §10, §14, §15, §16 |

60 tests across 13 files (`tests/`).

---

## 3. Key Decisions

1. **All SQL confined to one file** (`sqliteStorageProvider.ts`) — every other module depends only on `StorageProvider`. See ADR-0011.
2. **`node:sqlite`'s built-in `DatabaseSync`** as the default backend — no new dependency.
3. **`version` (schema conformance) and `revision` (concurrency counter) are separate fields** — caught and separated before shipping, during `update()`'s initial design.
4. **Optimistic concurrency compares `revision`, not `updatedAt`** — a real bug (below).
5. **Governance columns resolve to real SQL columns; everything else resolves through `json_extract`** — a real bug (below).
6. **Audit recording is always its own transaction**, mirroring the pattern IDA itself defines for every authority.
7. **IKM is built now, not deferred** — the spec names it as core scope, unlike Phase 05's reserved EICE.

See ADR-0011 for full rationale.

---

## 4. Real Bugs Found and Fixed During Testing

Both were caught by the test suite before certification, not discovered later.

1. **Optimistic concurrency accepted stale writes.** The initial `update()` compared `expectedUpdatedAt` against the record's `updatedAt` timestamp. Two updates to the same record executing within the same millisecond produce identical `new Date().toISOString()` values, so the stale-write check silently passed — `concurrency.test.ts`'s "a stale expectedUpdatedAt is rejected" test failed with "expected function to throw an error, but it didn't." Fixed by introducing a monotonic per-record `revision` counter (starts at 1 on create, incremented on every update) and comparing that instead — immune to clock resolution regardless of write throughput.
2. **Governance-field queries silently matched nothing.** `buildWhere()` and the `ORDER BY` clause routed every query field — including governance fields like `createdAt` and `lifecycleStage` — through `json_extract(data, '$.field')`. Those fields live in real SQL columns, not inside the `data` JSON blob, so any filter or sort on them matched zero rows. Caught by `retention.test.ts`'s `purge()` test: a `createdAt` cutoff filter that should have matched 2 records matched 0. Fixed with a single `resolveColumn()` helper, used by both the WHERE-clause builder and the sort clause, that resolves known governance fields to their real column and falls back to `json_extract` (with safe-identifier validation preserved) for everything else.

---

## 5. Verification

```text
npx tsc --noEmit -p tsconfig.json         → clean (src)
npx tsc --noEmit (src + tests combined)    → clean
npx vitest run core/data_authority         → 13 files, 60 tests, 60 passed
npx vitest run                             → 69 files, 383 tests, 383 passed (60 new for Phase 08)
npm run build                              → dist/ emitted successfully, including core/data_authority
```

---

## 6. Actions Not Performed (By Law)

- No mining, scheduling, hardware-discovery, profitability, or decision-making logic in IDA (§4 explicit exclusions)
- No Postgres/MySQL/other `StorageProvider` implementation — the interface is ready, `SqliteStorageProvider` is the only concrete implementation shipped
- No 'database'-backed `EventPersistence` wiring for the Event Bus — orthogonal to this phase, remains a documented extension point from ADR-0009
- No Telemetry Authority integration (doesn't exist yet) — `getMetrics()` is the read surface it will consume

---

## 7. Follow-Up

| Item | Status |
|---|---|
| A second `StorageProvider` implementation (e.g. Postgres), when a real deployment needs one | Deferred — zero changes needed anywhere outside the new file |
| Telemetry Authority consuming `getMetrics()` | Deferred |
| Wiring `EventPersistence`'s 'database' mode to IDA | Deferred — orthogonal to Phase 08, documented in ADR-0009 |
| Real domains beyond the 18 named (as new authorities emerge) | Registered incrementally, no framework changes required |
