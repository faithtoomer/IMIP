# Phase 09 — Certification Checklist (ISMA)

**Specification:** `specs/PHASE-09-institutional-storage-management-authority.md`  
**Date:** 2026-08-08  
**Implementation Authority:** Cursor

## Acceptance Criteria (§19)

| Criterion | Certified | Evidence |
|---|---|---|
| Every storage domain is manageable by ISMA | YES | `StorageDomain` (8 values); `tests/allocator.test.ts` allocates across multiple domains |
| Filesystem paths are abstracted | YES | `allocate()`/`resolve()`; no consumer constructs a path directly |
| Storage registry is operational | YES | `StorageRegistry`; `tests/registry.test.ts` |
| Capacity monitoring functions correctly | YES | Real `fs.statfsSync` measurement; `tests/capacity.test.ts` |
| Retention policies are enforced | YES | Real file deletion by age/count; `tests/retention.test.ts` |
| Archive management is implemented | YES | Real copy + SHA-256 + tamper detection; `tests/archive.test.ts` |
| Storage events are published | YES | 10 `STORAGE_EVENTS`, mirrored onto the real IEB; `tests/events.test.ts` |
| Explainability is complete | YES | Institutional Storage Topology; `tests/topology.test.ts` |
| Tests pass | YES | 11 files / 44 tests (436 total), `npx vitest run` |
| Documentation is complete | YES | `core/storage_authority/README.md`, this directory |

## Institutional Completion Standard (§20 contract)

| Requirement | Certified |
|---|---|
| No placeholder or incomplete implementations | YES — capacity, discovery, retention, and archival all operate against real files and real OS-level calls |
| Law 3 revised and enforced for all three affected authorities | YES — IDA and ICMS retrofitted with an additive `storageAuthority` option (ADR-0012), not exempted |
| No overlap with IDA's ownership of logical data | YES — `StorageEntry` carries no schema/query/transaction semantics |
| Retrofit is non-breaking | YES — all 383 pre-existing IDA + ICMS tests pass unmodified; `storageAuthority` is opt-in |

## Architect's Enhancement (§22 — Institutional Storage Topology)

| Requirement | Certified |
|---|---|
| Continuously queryable map of every managed storage resource | YES — `StorageTopology.describe()`/`byDomain()` |
| Domain, hierarchy, capacity, and health surfaced together | YES |
| Explainability query (`whyDegraded`) | YES |
| Implemented in full, not reserved | YES — the spec names it as core Phase 09 scope |

## Certification Statement

Phase 09 — Institutional Storage Management Authority (ISMA), including the retrofit of IDA and ICMS for Law 3 compliance and the Institutional Storage Topology (IST) — is **CERTIFIED COMPLETE** for repository `faithtoomer/IMIP` as of 2026-08-08. Type-check (src + tests), build, and the full 436-test suite (53 new for Phase 09) pass.
