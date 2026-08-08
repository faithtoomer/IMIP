# INSTITUTIONAL MINING INTELLIGENCE PLATFORM (IMIP)

# PROGRAM II — CORE INFRASTRUCTURE

## Phase 09

# Institutional Storage Management Authority (ISMA)

**Version:** 1.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Implementation Authority:** Cursor  
**Architectural Authority:** Institutional Engineering Specification  
**Classification:** Core Infrastructure Authority

> ISMA owns physical storage infrastructure. The Institutional Data Authority (Phase 08) already owns logical data — repositories, persistence, transactions, schemas, migrations, data governance. Introducing a "Storage Authority" without a clean separation would have created overlapping ownership; ISMA's scope is deliberately drawn as *where data physically lives*, never *what the data means or how it's structured*. See ADR-0012.

---

# 1. Mission Statement

ISMA is the sole authority responsible for managing the physical storage infrastructure IMIP uses: storage resources, directories, allocation, retention enforcement, archival, backup locations, and storage health. ISMA does not manage logical data — that is IDA's exclusive domain.

---

# 2. Mission Objectives

Storage discovery, directory management, storage allocation, storage monitoring, capacity management, storage health monitoring, retention enforcement, archive management, file lifecycle management, backup location management, recovery preparation, explainable storage operations.

---

# 3. Institutional Principles

1. **Single Storage Authority** — ISMA is the sole owner of storage infrastructure.
2. **Separation of Concerns** — IDA manages data; ISMA manages where that data lives.
3. **Storage Independence** — no authority hardcodes filesystem paths; all storage locations originate from ISMA. Revised during implementation (ADR-0012) to apply to IDA and ICMS as well, not only to authorities built after Phase 09 — both retrofitted with an additive, opt-in `storageAuthority` option rather than being carved out as an exception.
4. **Explainability** — every storage operation answers what/where/why/who/how-much/success (via the registry, `getHealth()`, and the Institutional Storage Topology, §22).
5. **Capacity Awareness** — storage health is continuously monitorable; exhaustion is never silent (`CapacityWarning`/`CapacityCritical` events, §13).

---

# 4. Responsibilities

ISMA owns: storage discovery, filesystem/directory management, storage allocation, capacity monitoring, storage health, archive locations, backup destinations, retention enforcement, storage metrics. ISMA does **not** own: database schemas, transactions, persistence logic, business entities, mining, or runtime decisions.

---

# 5. Runtime Architecture

```text
Institutional Authorities (ICMS, IDA, ...)
            │
            ▼
Institutional Storage Management Authority (allocate/resolve — synchronous)
            │
            ▼
Filesystem Abstraction (node:fs, statfsSync)
            │
            ▼
Operating System Storage
```

`allocate()`/`release()`/`resolve()` are deliberately synchronous (plain `fs` sync calls), so they can be called from IDA's and ICMS's synchronous constructors without forcing either to become async (ADR-0012). `discover()` (whole-machine filesystem enumeration) is async, using `systeminformation` — the same real-discovery dependency IHIS already uses for hardware (Phase 03).

---

# 6. Storage Domains

8 institutional storage domains (`StorageDomain` in `types.ts`): `configuration`, `database`, `runtime`, `telemetry`, `explainability`, `backups`, `plugins`, `ai`.

---

# 7. Storage Registry

`StorageRegistry` — the authoritative SSOT for every managed storage location, indexed both by `storageId` and by the `(domain, purpose)` pair allocation idempotency depends on. Each `StorageEntry` carries: storageId, domain, purpose, path, whether the path names a file or a directory, retention policy, encryption status, backup status, lifecycle stage, creation timestamp. Mirrors the SSOT-registry pattern already established by `ConfigurationRegistry`/`HardwareRegistry`/`EventRegistry`/`StorageRegistry`'s own siblings.

---

# 8. Storage Allocation

`StorageAllocator.allocate(domain, purpose, options?)` is idempotent: re-allocating the same `(domain, purpose)` returns the existing entry rather than creating a duplicate directory. Supports directory allocations and, via `options.filename`, file-path allocations inside a managed directory. Every allocation is tracked in the registry and (on first allocation only) publishes `StorageRegistered`/`StorageAllocated`.

---

# 9. Storage Health & Discovery

Two complementary, both real, data sources: `measureCapacity()` (`capacity.ts`) uses Node's built-in, synchronous `fs.statfsSync` for a per-entry capacity check (no new dependency); `discoverVolumes()` (`discovery.ts`) uses `systeminformation.fsSize()` for an async, whole-machine enumeration of every mounted filesystem. `getHealth()` classifies an entry `healthy | degraded | critical` against 85%/95% usage thresholds and publishes `CapacityWarning`/`CapacityCritical`/`StorageHealthy`/`StorageDegraded` accordingly.

---

# 10. Retention Policies

`enforceRetention()` (`retention.ts`) applies a `StorageEntry`'s optional `RetentionPolicy` (`maxAgeMs` and/or `maxEntries`) against real files on disk — deletes files older than the configured age, or beyond the configured count (oldest first). A no-op for file-backed entries or entries with no configured policy. `enforceAllRetention()` sweeps every policy-bearing entry.

---

# 11. Archive Management

`createArchive()` (`archive.ts`) copies a storage location's real contents (including nested directories) into a checksummed archive under the `backups` domain — a per-file SHA-256 recorded at archive time. `validateArchive()` recomputes every checksum and compares, detecting tampering or corruption. Requires the source entry to be `active` first (§12).

---

# 12. Storage Lifecycle

```text
allocated → active → archived → retained → expired → deleted
```

`deleted` is reachable from any non-terminal stage (release/cleanup can happen at any point); every other transition follows the linear sequence — enforced by `assertStorageTransition()` (`lifecycle.ts`), rejecting both stage-skipping and backward moves.

---

# 13. Storage Events

`StorageDiscovered`, `StorageRegistered`, `StorageAllocated`, `StorageReleased`, `CapacityWarning`, `CapacityCritical`, `StorageHealthy`, `StorageDegraded`, `ArchiveCreated`, `CleanupCompleted` — mirrored onto the real IEB (ADR-0009 §6 pattern, not IRBLM's direct-publish pattern; see §5/ADR-0012 for why). A new `'storage'` `EventCategory` was added to the Event Bus (additive, non-breaking) since none of the existing 18 categories fit physical storage without conflating it with `'database'`.

---

# 14. Explainability

Every `StorageEntry` exposes location, purpose, domain, lifecycle stage, encryption/backup status, and — via `getCapacity()`/`getHealth()` — real-time capacity and health. See §22 for the continuously-updated topology view.

---

# 15. Public Interfaces

`allocate()`, `release()`, `resolve()`, `listByDomain()`, `activate()`, `getCapacity()`, `getHealth()`, `discover()`, `enforceRetention()`/`enforceAllRetention()`, `archive()`, `validateArchive()`, `getArchive()`, `getMetrics()`, plus the `topology` read surface (§22). No consumer manipulates filesystem paths outside these interfaces.

---

# 16. Error Handling

`UnknownStorageDomainError`, `DuplicateStorageIdError`, `StorageNotFoundError`, `InvalidAllocationError`, `DirectoryMissingError`, `InvalidStorageTransitionError`, `ArchiveFailedError`, `CleanupFailedError` — all typed subclasses of `StorageAuthorityError` with a stable `code`.

---

# 17. Performance Metrics

`getMetrics()`: allocation/release/archive/cleanup counts, capacity warning/critical counts, average allocation latency — a read surface for a future Telemetry Authority, matching the pattern established in Phases 05/07/08.

---

# 18. Testing Requirements

44 tests across 11 files: registry, allocator (real directory/file creation, idempotency), capacity (real `statfsSync` measurement + threshold classification), discovery (real whole-machine scan), retention (real file deletion by age/count), archive (real copy + checksum + tamper detection), lifecycle transitions, the event mirror, the topology, the orchestrator end-to-end, and performance smoke tests. Plus 9 retrofit-integration tests across `core/data_authority/tests/storage-authority-integration.test.ts` (4) and `core/configuration_authority/tests/storage-authority-integration.test.ts` (5).

---

# 19. Acceptance Criteria

Every storage domain is manageable by ISMA. Filesystem paths are abstracted behind `allocate()`/`resolve()`. The storage registry is operational. Capacity monitoring functions correctly against real disks. Retention policies are enforced against real files. Archive management works with real integrity validation. Storage events are published. Explainability is complete. Tests pass. Documentation is complete.

---

# 20. Institutional Completion Standard (ICS)

Architecturally compliant, fully implemented, fully integrated (including the IDA/ICMS retrofit), fully documented, fully typed, fully tested, runtime verified, performance benchmarked. Partial implementations are prohibited.

---

# 21. Cursor Implementation Contract — Compliance Note

Law 3 was revised during implementation, at the user's direction, to actually apply to every authority rather than exempting the two that predate ISMA — see ADR-0012. No placeholder implementations: capacity measurement, discovery, retention, and archival all operate against real files and real OS-level filesystem calls, not simulated data.

---

# 22. Architect's Enhancement: Institutional Storage Topology (IST)

**Implemented in full.** `StorageTopology` (`topology.ts`) maintains a continuously queryable map of every managed storage resource — domain groupings, per-entry capacity and health, and an aggregate `capacitySummary()` deduplicated across shared volumes. `describe()`/`byDomain()`/`whyDegraded()` let the platform reason about managed storage *resources*, not raw folders and files — the same "always-current diagnostic layer" role the Runtime Governance Board (Phase 07 §22) plays for runtime components. This is the foundation automatic storage balancing, archive relocation, multi-volume support, and cloud-backed storage could build on later without redesigning ISMA's public interface.
