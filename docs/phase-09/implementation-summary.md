# Phase 09 — Implementation Summary (ISMA)

**Version:** 1.0  
**Date:** 2026-08-08  
**Specification:** `specs/PHASE-09-institutional-storage-management-authority.md`  
**Branch:** `cursor/phase-00-repository-governance-5130`

---

## 1. Executive Summary

Phase 09 implements the Institutional Storage Management Authority (ISMA) — Program II's second phase and IMIP's first authority for physical storage infrastructure, cleanly separated from the Institutional Data Authority's (Phase 08) ownership of logical data. It also retrofits IDA and ICMS with an additive, opt-in `storageAuthority` option so Law 3 ("no authority hardcodes filesystem paths") holds for all three authorities, not just ones built after ISMA — a scope decision the user made explicitly mid-specification.

---

## 2. What Was Built

| Concern | File | § |
|---|---|---|
| Domain/entry/event types | `src/types.ts` | §6, §7, §13 |
| Typed error taxonomy | `src/errors.ts` | §16 |
| Storage registry (SSOT) | `src/registry.ts` | §7 |
| Synchronous allocator | `src/allocator.ts` | §8 |
| Real capacity measurement + health | `src/capacity.ts` | §9 |
| Real whole-machine discovery | `src/discovery.ts` | §9 |
| Real retention enforcement | `src/retention.ts` | §10 |
| Real checksummed archival | `src/archive.ts` | §11 |
| Lifecycle transition table | `src/lifecycle.ts` | §12 |
| Institutional Storage Topology | `src/topology.ts` | §22 |
| Event mirror onto the IEB | `src/events.ts` | §13 |
| Orchestrator | `src/StorageAuthority.ts` | §15 |

44 tests across 11 files (`tests/`), plus 9 retrofit-integration tests in `core/data_authority/tests/storage-authority-integration.test.ts` (4) and `core/configuration_authority/tests/storage-authority-integration.test.ts` (5).

Retrofit changes to already-certified modules: `core/data_authority/src/DataAuthority.ts` (`DataAuthorityOptions.storageAuthority`/`storagePurpose`), `core/configuration_authority/src/ConfigurationAuthority.ts` (`ConfigurationAuthorityOptions.storageAuthority`), `core/event_bus/src/types.ts` (`EventCategory` gains `'storage'`).

---

## 3. Key Decisions

1. **ISMA owns physical storage; IDA owns logical data — the user drew this boundary before the spec was written**, renaming "Storage Authority" to "Institutional Storage Management Authority" specifically to avoid ownership overlap with Phase 08.
2. **`allocate()`/`release()`/`resolve()` are synchronous** — a hard constraint from IDA's/ICMS's existing synchronous constructors, not a style preference.
3. **IDA and ICMS are retrofitted, not exempted** — the user explicitly asked to revise Law 3 so it holds for all three authorities ("with the two already built and conflicted can we revise this law to ensure that they all match?"), resolved via an additive, opt-in `storageAuthority` option that changes nothing for existing callers.
4. **ISMA mirrors onto the IEB (ADR-0009 §6), not IRBLM's direct-publish pattern** — dictated by decision #2's synchronous-API constraint.
5. **A new `'storage'` `EventCategory` was added**, rather than reusing `'database'` — reusing it would have blurred the exact ownership line decision #1 draws.
6. **Two complementary real capacity sources**: `fs.statfsSync` (built-in, sync, per-entry) and `systeminformation.fsSize()` (async, whole-machine, already a platform dependency via IHIS).
7. **`release()` deregisters without deleting files** — physical deletion is a distinct, explicit operation (`enforceRetention()`/`archive()`).

See ADR-0012 for full rationale.

---

## 4. Verification

```text
npx tsc --noEmit -p tsconfig.json         → clean (src, including the ISMA module and the IDA/ICMS retrofit)
npx tsc --noEmit (src + tests combined)    → clean
npx vitest run core/storage_authority      → 11 files, 44 tests, 44 passed
npx vitest run                             → 82 files, 436 tests, 436 passed (53 new for Phase 09:
                                              44 in storage_authority + 9 retrofit-integration tests)
npm run build                              → dist/ emitted successfully, including core/storage_authority
```

No test or type-check failures surfaced during this phase — the design followed established, already-verified precedents closely enough (allocator idiom from the registry pattern, mirror pattern from ADR-0009, sync/async split already proven necessary by IDA/ICMS) that nothing needed a fix-after-red cycle.

---

## 5. Actions Not Performed (By Law)

- No database schemas, transactions, or business-entity logic in ISMA (§4 explicit exclusions)
- No retrofit of the audit-log JSONL sink (`ConfigurationAuthorityOptions.auditLogPath`) — it remains purely caller-supplied, since it is explicitly documented as an interim, opt-in bridge pending a future audit authority, not a default-expected storage location
- No IRBLM (`core/runtime_bootstrap`) adapter for ISMA — not requested this phase; ISMA is usable standalone or wired manually, the same posture IDA (Phase 08) currently has
- No cloud-backed or multi-volume storage — the Institutional Storage Topology (§22) is built so this can be added later without a public-interface change

---

## 6. Follow-Up

| Item | Status |
|---|---|
| IRBLM adapter for ISMA (and IDA) | Deferred — plugs into the existing generic dependency-graph framework with no orchestrator changes |
| Telemetry Authority consuming `getMetrics()` | Deferred |
| Automatic storage balancing / archive relocation / multi-volume support | Deferred — explicitly the kind of capability the Institutional Storage Topology is designed to support later |
| `auditLogPath` retrofit for ICMS | Deferred — orthogonal, pending a real audit/database authority for that specific sink |
