import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { sha256Hex } from '../../security_authority/src/index.js';
import type { DataAuthority } from '../../data_authority/src/index.js';
import type { ConfigurationAuthority } from '../../configuration_authority/src/index.js';
import type { ConfigSnapshot } from '../../configuration_authority/src/index.js';
import type { HardwareAuthority } from '../../hardware_authority/src/index.js';
import type { RuntimeOrchestrator } from '../../runtime_bootstrap/src/index.js';
import type { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import type { SecurityAuthority } from '../../security_authority/src/index.js';
import type { DomainBackupHandler, DomainBackupResult, DomainRestoreResult, DomainValidationResult } from './types.js';

/**
 * §5/Law 1 — a real, generic handler for any domain whose state can be
 * expressed as JSON: serializes via `collect()`, gzip-compresses (real,
 * `node:zlib`, no new dependency), checksums with SHA-256 (reused from
 * ISTA's crypto services rather than a third duplicate implementation —
 * see ADR-0017), and validates by re-reading and re-hashing. `restoreFn`
 * is optional: several domains (hardware inventory, runtime state) reflect
 * live physical/process state that cannot be meaningfully restored from a
 * historical snapshot — those are honestly unsupported, not faked.
 */
export function createJsonDomainHandler(
  domain: string,
  collect: () => Record<string, unknown>,
  restoreFn?: (data: Record<string, unknown>) => void,
): DomainBackupHandler {
  return {
    domain,

    async backup(destinationDir: string): Promise<DomainBackupResult> {
      mkdirSync(destinationDir, { recursive: true });
      const data = collect();
      const json = JSON.stringify(data);
      const compressed = gzipSync(json);
      const filePath = join(destinationDir, `${domain}.json.gz`);
      writeFileSync(filePath, compressed);
      return {
        domain,
        sizeBytes: compressed.byteLength,
        checksum: sha256Hex(compressed),
        location: filePath,
        compressionStatus: 'gzip',
        metadata: { recordCount: Array.isArray(data) ? data.length : Object.keys(data).length },
      };
    },

    async validate(result: DomainBackupResult): Promise<DomainValidationResult> {
      if (!existsSync(result.location)) return { domain, valid: false, reasons: ['Backup file missing.'] };
      const content = readFileSync(result.location);
      const checksum = sha256Hex(content);
      if (checksum !== result.checksum) return { domain, valid: false, reasons: ['Checksum mismatch — backup file may be corrupted.'] };
      try {
        JSON.parse(gunzipSync(content).toString('utf-8'));
      } catch (error) {
        return { domain, valid: false, reasons: [`Backup file is not valid JSON after decompression: ${(error as Error).message}`] };
      }
      return { domain, valid: true, reasons: [] };
    },

    async restore(result: DomainBackupResult): Promise<DomainRestoreResult> {
      if (!restoreFn) {
        return {
          domain,
          success: false,
          supported: false,
          message: `Domain "${domain}" reflects live state and does not support restore — historical record only.`,
        };
      }
      const content = readFileSync(result.location);
      const data = JSON.parse(gunzipSync(content).toString('utf-8')) as Record<string, unknown>;
      restoreFn(data);
      return { domain, success: true, supported: true };
    },
  };
}

/** A real, zero-producer extension point for domains with nothing to back
 * up yet (Plugin Registry, Capability Registry — both still reserved,
 * ADR-0002). Honest empty result, not fabricated data. */
export function createNoopDomainHandler(domain: string): DomainBackupHandler {
  return {
    domain,
    async backup(): Promise<DomainBackupResult> {
      return { domain, sizeBytes: 0, location: '', compressionStatus: 'none', metadata: { reason: 'No producer implemented for this domain yet.' } };
    },
    async validate(): Promise<DomainValidationResult> {
      return { domain, valid: true, reasons: ['Nothing to validate — no producer implemented for this domain yet.'] };
    },
    async restore(): Promise<DomainRestoreResult> {
      return { domain, success: true, supported: false, message: 'Nothing to restore — no producer implemented for this domain yet.' };
    },
  };
}

/** §5 — wraps IDA's real backup()/validateBackup()/restore() (Phase 08).
 * IBRRA never re-implements SQLite VACUUM INTO. */
export function createDataAuthorityHandler(dataAuthority: DataAuthority): DomainBackupHandler {
  return {
    domain: 'database',

    async backup(destinationDir: string): Promise<DomainBackupResult> {
      mkdirSync(destinationDir, { recursive: true });
      const filePath = join(destinationDir, 'database.db');
      const result = dataAuthority.backup(filePath);
      return { domain: 'database', sizeBytes: result.sizeBytes, location: filePath, compressionStatus: 'none' };
    },

    async validate(result: DomainBackupResult): Promise<DomainValidationResult> {
      const validation = dataAuthority.validateBackup(result.location);
      return { domain: 'database', valid: validation.valid, reasons: validation.reasons };
    },

    async restore(result: DomainBackupResult): Promise<DomainRestoreResult> {
      try {
        dataAuthority.restore(result.location);
        return { domain: 'database', success: true, supported: true };
      } catch (error) {
        return { domain: 'database', success: false, supported: true, message: (error as Error).message };
      }
    },
  };
}

/** §5/§6 — wraps ICMS's real, existing SnapshotStore (Phase 02): backup
 * serializes the currently-active `ConfigSnapshot`; restore calls
 * `snapshots.activate()` directly (a real, already-public method) rather
 * than reimplementing configuration persistence. */
export function createConfigurationHandler(configurationAuthority: ConfigurationAuthority): DomainBackupHandler {
  const base = createJsonDomainHandler(
    'configuration',
    () => {
      const snapshot = configurationAuthority.snapshots.current();
      return snapshot ? { ...snapshot } : {};
    },
    (data) => {
      configurationAuthority.snapshots.activate(data as unknown as ConfigSnapshot);
    },
  );
  return base;
}

/** §6 — wraps IHIS's real inventory (Phase 03). Hardware inventory reflects
 * live physical state discovered from real devices; restoring it from a
 * historical snapshot doesn't correspond to anything physically
 * meaningful, so this handler honestly does not support restore. */
export function createHardwareHandler(hardwareAuthority: HardwareAuthority): DomainBackupHandler {
  return createJsonDomainHandler('hardware-registry', () => ({ inventory: hardwareAuthority.getInventory() }));
}

/** §6 "Runtime metadata" — captures IRBLM's real runtime state and
 * certification status (Phase 07) for audit/diagnostic purposes. A live
 * process's runtime state cannot be meaningfully restored from a
 * historical snapshot, so restore is honestly unsupported. */
export function createRuntimeHandler(runtimeOrchestrator: RuntimeOrchestrator): DomainBackupHandler {
  return createJsonDomainHandler('runtime', () => ({
    state: runtimeOrchestrator.getRuntimeState(),
    certification: runtimeOrchestrator.getCertificationStatus() ?? null,
  }));
}

/** §6 "Logs & Audit" — captures real audit history from IOLA and/or ISTA
 * when supplied. Historical record only (audit trails are already
 * structurally immutable at the source), so restore is unsupported. */
export function createLogsAuditHandler(options: { observability?: ObservabilityAuthority; security?: SecurityAuthority }): DomainBackupHandler {
  return createJsonDomainHandler('logs-audit', () => ({
    observabilityAudit: options.observability?.audit.all() ?? [],
    securityAudit: options.security?.audit.all() ?? [],
  }));
}
