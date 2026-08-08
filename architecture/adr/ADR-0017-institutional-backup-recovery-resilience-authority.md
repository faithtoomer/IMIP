# ADR-0017: Institutional Backup, Recovery & Resilience Authority

**Status:** Accepted  
**Date:** 2026-08-08  
**Phase:** 14  
**Deciders:** Architectural Authority (Specification), User (naming/scope framing)

## Context

The user framed Phase 14 around operational resilience, not "backup and restore": deterministic, explainable, auditable recovery from hardware failure, software failure, operator mistakes, and data corruption. Before writing code, per the user's explicit instruction ("review the following for duplication, redundancies, conflicts, and contradictions"), the spec was checked against every authority its own runtime diagram (§5) names as a dependency: the Institutional Data Authority and the Institutional Storage Management Authority.

That review found something more consequential than in any prior phase: **the backup and recovery primitives IBRRA's spec describes already exist and are already real**, in four separate places:

1. IDA (Phase 08) already has real `backup()`/`validateBackup()`/`createRecoveryCheckpoint()`/`restore()`, using SQLite's `VACUUM INTO` and integrity checks.
2. ISMA (Phase 09) already has real `archive()`/`validateArchive()`/`allocate()`, with SHA-256 checksums.
3. ICMS (Phase 02) already has a real, immutable, content-addressed `SnapshotStore` with `rollback()`.
4. IRBLM (Phase 07) already has real `getRuntimeState()`/`getCertificationStatus()`/`certifyRuntime()`.

Building IBRRA's own SQLite dump logic, its own checksummed archival, or its own configuration-snapshot mechanism would have directly violated IBRRA's own Law 1 ("no authority shall implement independent backup or recovery mechanisms"), applied reflexively to IBRRA itself. So the entire module was designed around one governing decision: IBRRA is a real cross-authority catalog and orchestration layer, not a fifth persistence mechanism.

§23's wording ("recommend building into the architecture from the outset") was clear enough — combined with the user's consistent "build now" answer for every prior Architect's Enhancement (Phase 10 through 13) — to proceed without re-asking.

## Decisions

1. **Every domain backup handler wraps an already-real method on an already-certified authority.** `createDataAuthorityHandler` calls IDA's real `backup()`/`validateBackup()`/`restore()`. `createConfigurationHandler` calls ICMS's real, already-public `snapshots.current()`/`snapshots.activate()`. `createHardwareHandler`/`createRuntimeHandler` capture IHIS's/IRBLM's real live state as an honest historical record. IBRRA contains zero SQL, zero checksumming-from-scratch for these domains, zero snapshot-mechanics reimplementation.
2. **`incremental`/`differential` backup types are registered but throw `UnsupportedBackupTypeError`, not fabricated.** No incremental/differential primitive exists anywhere in IDA or ISMA — both only support full snapshots. Faking a strategy that doesn't correspond to any real underlying capability would violate the no-placeholder standard more than declining to support it.
3. **Restore is honestly optional per domain, tracked via a `supported` flag distinct from `success`.** Hardware inventory and runtime state reflect live physical/process state that cannot be meaningfully restored from a historical snapshot — those handlers report `supported: false` (a real, expected non-capability), which the orchestrator's failure detection deliberately excludes from counting as a genuine recovery failure (`supported && !success`).
4. **A new, additive `'resilience'` `EventCategory` was added** (the same precedent as ISMA's `'storage'`, ADR-0012) — no existing category fit, since `'database'`/`'storage'` are already IDA's/ISMA's own concerns and backup/recovery is a distinct cross-cutting one.
5. **SHA-256 hashing is reused from ISTA's crypto services (`sha256Hex`)**, not implemented a third time (ISMA's `archive.ts` already has one, non-exported). A tiny, pure, stateless utility function is a reasonable cross-authority reuse.
6. **Real gzip compression via `node:zlib`** for JSON-serializable domain backups — no new dependency, genuinely functional, not a fabricated `compressionStatus` field.
7. **The "Platform Certified" recovery step queries IRBLM's real `getCertificationStatus()`**, never a fabricated boolean — when no `RuntimeOrchestrator` is supplied, `certifiedOperational` stays honestly `undefined` rather than defaulting to a guessed value.
8. **Recovery halts on any real failure** (unverified source backup, version incompatibility, re-verification failure, or a genuine domain restore failure) — Law 5 "Recovery Integrity" prohibits partial/inconsistent recovery, so `requestRecovery()` transitions to `failed` and stops rather than continuing past a failed check.
9. **A real bug was caught and fixed during testing**: `requestRecovery()`'s initial implementation called `transitionRecovery(record, 'requested', ...)` immediately after constructing the record with `status: 'requested'` already set — attempting to "transition" a record into the state it already started in, which the recovery lifecycle's transition table correctly rejects (`'requested'` isn't a valid target from `'requested'`). Fixed by recording the initial `requested` step directly as part of the record's construction, not as a state-machine transition, and starting the actual transition chain from `requested → backup-selected`.

## Consequences

- IDA, ICMS, ISMA, and IRBLM remain the sole owners of their respective persistence/storage/certification mechanics — IBRRA adds a governance and orchestration layer on top, never a competing implementation.
- Adding a new backup domain (e.g. once Plugin Registry or Capability Registry are implemented) is a `registerDomainHandler()` call wrapping that authority's own real methods — the same pattern already established for all four current handlers.
- The Institutional Recovery Graph becomes the platform's standing answer to "is this backup compatible," "what changed," and "does this need a migration," grounded in real, captured schema-version data rather than inference.
- The recovery-lifecycle bug is exactly the kind of defect the test-first-then-fix discipline in this project exists to catch before certification, not after.
