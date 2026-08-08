# Institutional Backup, Recovery & Resilience Authority (IBRRA)

**Status:** IMPLEMENTED (Phase 14)  
**Location:** `core/resilience_authority/`  
**Authority:** PHASE-14 / ADR-0017

## Purpose

IBRRA is the sole institutional authority for backup orchestration, recovery orchestration, and resilience planning — operational resilience, not "backup and restore." It never re-implements persistence or storage mechanics: every domain handler wraps an already-real method on an already-certified authority (IDA, ICMS, ISMA, IHIS, IRBLM).

## Layout

```text
core/resilience_authority/
  src/
    types.ts                 BackupType, BackupRecord, RecoveryPoint, RecoveryRecord,
                               RESILIENCE_EVENTS (10), ...
    errors.ts                   Structured, typed error taxonomy
    domainRegistry.ts             BackupDomainRegistry — real, runtime-extensible (§6)
    lifecycle.ts                    Backup + recovery lifecycle transition tables
    registry.ts                       BackupRegistry — the authoritative catalog (§7)
    handlers.ts                         Real domain handlers wrapping IDA/ICMS/IHIS/IRBLM
    recoveryGraph.ts                      InstitutionalRecoveryGraph — the Architect's
                                           Enhancement (§23)
    auditTrail.ts                           ResilienceAuditTrail — structurally immutable
    events.ts                                 ResilienceEventBus — mirrors onto the real IEB
    ResilienceAuthority.ts                      The orchestrator
    index.ts                                     Public exports
  tests/                                          54 tests across 9 files
```

## Usage

```ts
import { ResilienceAuthority } from './core/resilience_authority/src/index.js';

const ibrra = new ResilienceAuthority({
  dataAuthority: ida,                 // real backup()/restore() (Phase 08)
  configurationAuthority: icms,       // real SnapshotStore (Phase 02)
  hardwareAuthority: ihis,            // real inventory export (Phase 03)
  runtimeOrchestrator: irblm,         // real certification query (Phase 07)
  storageAuthority: isma,             // real backup file destination (Phase 09)
  observabilityAuthority: iola,
});

const backup = await ibrra.createBackup({ backupType: 'full', domains: ['database', 'configuration'] });
// backup.status === 'available', backup.verificationStatus === 'verified' — verification is mandatory (Law 2)

const recovery = await ibrra.requestRecovery(backup.backupId, 'Operator', 'disaster drill');
// recovery.status === 'operational' once every real check (verification, compatibility, integrity, restore) passes

ibrra.graph.compatibleWith('1.0.0');        // §23 — real recovery-point compatibility
ibrra.graph.diff(pointA, pointB);           // §23 — real schema-version delta
ibrra.explainBackup(backup.backupId);       // full transition history
```

## Scope Boundary

IBRRA owns backup orchestration, snapshot management, restore orchestration, recovery verification, the Backup Registry, recovery planning, disaster recovery workflows, retention coordination, and recovery auditing — never data persistence, storage infrastructure, runtime lifecycle, mining, business logic, or scheduling policies (§4). It never contains SQL, checksumming-from-scratch, or snapshot mechanics of its own — those stay owned by IDA, ISMA, and ICMS respectively.

## Governance

- Every domain handler wraps a real, already-existing method on an already-certified authority — Law 1, applied reflexively to IBRRA's own implementation.
- Backup verification is mandatory in `createBackup()`, never a separate opt-in step — Law 2 "Recoverability First."
- `requestRecovery()` refuses an unverified backup, an incompatible platform version, or a failed re-verification — Law 5 "Recovery Integrity" prohibits partial recovery.
- `incremental`/`differential` backup types are honestly unsupported (`UnsupportedBackupTypeError`), not fabricated — no such primitive exists in IDA or ISMA.
- A domain's `supported: false` restore result (hardware inventory, runtime state — live state that can't be meaningfully restored from a snapshot) is never counted as a recovery failure; only `supported && !success` is.
- `ResilienceAuditTrail` exposes no update or delete method for any reason — immutability is structural.
