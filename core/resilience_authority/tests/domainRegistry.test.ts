import { describe, expect, it } from 'vitest';
import { BackupDomainRegistry } from '../src/domainRegistry.js';
import { DEFAULT_BACKUP_DOMAINS } from '../src/types.js';

describe('BackupDomainRegistry (§6)', () => {
  it('pre-seeds every default domain', () => {
    const registry = new BackupDomainRegistry();
    for (const domain of DEFAULT_BACKUP_DOMAINS) {
      expect(registry.has(domain)).toBe(true);
    }
  });

  it('registers a new, future domain at runtime', () => {
    const registry = new BackupDomainRegistry();
    registry.register('ai-models');
    expect(registry.has('ai-models')).toBe(true);
  });

  it('has() is false for an unregistered domain', () => {
    const registry = new BackupDomainRegistry();
    expect(registry.has('not-a-real-domain')).toBe(false);
  });
});
