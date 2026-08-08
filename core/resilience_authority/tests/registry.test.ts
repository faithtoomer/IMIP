import { describe, expect, it } from 'vitest';
import { BackupRegistry } from '../src/registry.js';
import { BackupNotFoundError } from '../src/errors.js';
import type { BackupRecord } from '../src/types.js';

function makeRecord(overrides: Partial<BackupRecord> = {}): BackupRecord {
  return {
    backupId: 'b1',
    backupType: 'full',
    domains: [],
    createdAt: new Date().toISOString(),
    storageLocation: '/tmp/x',
    totalSizeBytes: 0,
    encryptionStatus: 'none',
    verificationStatus: 'unverified',
    recoveryCompatibilityVersion: 'unknown',
    status: 'created',
    ...overrides,
  };
}

describe('BackupRegistry (§7)', () => {
  it('registers and retrieves a backup', () => {
    const registry = new BackupRegistry();
    registry.register(makeRecord());
    expect(registry.get('b1')?.backupId).toBe('b1');
  });

  it('require() throws for an unregistered backup', () => {
    const registry = new BackupRegistry();
    expect(() => registry.require('missing')).toThrow(BackupNotFoundError);
  });

  it('update() replaces an existing record in place', () => {
    const registry = new BackupRegistry();
    registry.register(makeRecord());
    registry.update(makeRecord({ status: 'available' }));
    expect(registry.get('b1')?.status).toBe('available');
  });

  it('latestVerified() returns the most recent verified backup', () => {
    const registry = new BackupRegistry();
    registry.register(makeRecord({ backupId: 'old', verificationStatus: 'verified', createdAt: '2026-08-01T00:00:00.000Z' }));
    registry.register(makeRecord({ backupId: 'new', verificationStatus: 'verified', createdAt: '2026-08-08T00:00:00.000Z' }));
    registry.register(makeRecord({ backupId: 'unverified', verificationStatus: 'unverified', createdAt: '2026-08-09T00:00:00.000Z' }));
    expect(registry.latestVerified()?.backupId).toBe('new');
  });

  it('latestVerified() returns undefined when nothing is verified', () => {
    const registry = new BackupRegistry();
    registry.register(makeRecord({ verificationStatus: 'unverified' }));
    expect(registry.latestVerified()).toBeUndefined();
  });
});
