# Institutional Storage Management Authority (ISMA)

**Status:** IMPLEMENTED (Phase 09)  
**Location:** `core/storage_authority/`  
**Authority:** PHASE-09 / ADR-0012

## Purpose

ISMA is the sole institutional authority for physical storage infrastructure: storage resources, directories, allocation, retention enforcement, archival, backup locations, and storage health. It does not manage logical data — that is the Institutional Data Authority's (Phase 08) exclusive domain. IDA owns *data*; ISMA owns *where that data physically lives*.

## Layout

```text
core/storage_authority/
  src/
    types.ts        StorageDomain (8), StorageEntry, RetentionPolicy, CapacitySnapshot,
                      HealthCheckResult, DiscoveredVolume, ArchiveRecord, STORAGE_EVENTS, ...
    errors.ts          Structured, typed error taxonomy
    registry.ts          StorageRegistry — SSOT, indexed by storageId and (domain, purpose)
    allocator.ts           StorageAllocator — synchronous allocate/release (plain fs sync calls)
    capacity.ts               Real capacity measurement (fs.statfsSync) + health classification
    discovery.ts                Real whole-machine filesystem discovery (systeminformation)
    retention.ts                  Real retention enforcement against files on disk
    archive.ts                     Real checksummed archival + integrity validation
    lifecycle.ts                    6-state storage lifecycle transition table
    topology.ts                      StorageTopology — the Architect's Enhancement (§22)
    events.ts                         StorageEventBus — mirrors onto the real IEB (ADR-0009 §6)
    StorageAuthority.ts                The orchestrator
    index.ts                            Public exports
  tests/                                 44 tests across 11 files
```

## Usage

```ts
import { StorageAuthority } from './core/storage_authority/src/index.js';

const isma = new StorageAuthority(); // rootPath defaults to <cwd>/storage

const entry = isma.allocate('database', 'ida-primary', { filename: 'data.db' });
isma.activate(entry.storageId);

isma.getHealth(entry.storageId);     // real disk usage, classified healthy/degraded/critical
isma.enforceRetention(entry.storageId);
const archiveRecord = isma.archive(entry.storageId); // requires 'active' first
isma.validateArchive(archiveRecord.archiveId);       // real checksum re-verification

isma.topology.describe();            // the Institutional Storage Topology (§22)
isma.getMetrics();
```

### Wiring into IDA / ICMS (ADR-0012)

Both authorities accept an optional `storageAuthority` — when given, and no explicit `filePath`/`storage` override is supplied, their default storage location is allocated from ISMA instead of defaulting to in-memory (IDA) or running without a config file (ICMS). Omitting it preserves each authority's exact pre-Phase-09 behavior.

```ts
const isma = new StorageAuthority();
const ida = new DataAuthority({ storageAuthority: isma });                // real on-disk db, not :memory:
const icms = new ConfigurationAuthority({ storageAuthority: isma });      // real config.json location
```

## Scope Boundary

ISMA owns storage discovery, directory/filesystem management, allocation, capacity/health monitoring, retention, archival, and storage metrics — never database schemas, transactions, persistence logic, business entities, mining, or runtime decisions (§4).

## Governance

- `allocate()`/`release()`/`resolve()` are synchronous by design, so IDA's and ICMS's synchronous constructors can call them without becoming async.
- Allocation is idempotent per `(domain, purpose)` — re-allocating returns the existing entry, never a duplicate directory.
- `release()` deregisters an entry; it never deletes the underlying files. Physical deletion only happens via `enforceRetention()` (policy-driven) or `archive()` (checksummed copy, source marked archived).
- Capacity/health checks use two real, complementary sources: `fs.statfsSync` (built-in, synchronous, per-entry) and `systeminformation.fsSize()` (async, whole-machine, via `discover()`).
- Storage events mirror onto the real Institutional Event Bus (fire-and-forget), the same pattern ICMS/IHIS use — not IRBLM's direct-await pattern, because ISMA's public API must stay synchronous.
- The Institutional Storage Topology (`topology`) is a continuously queryable diagnostic layer, independent of any single allocation call.
