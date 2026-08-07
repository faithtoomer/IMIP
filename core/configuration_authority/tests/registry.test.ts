import { describe, expect, it } from 'vitest';
import { ConfigurationRegistry, DEFAULT_ENTRIES } from '../src/registry.js';

describe('ConfigurationRegistry', () => {
  it('registers every default entry exactly once (SSOT)', () => {
    const registry = new ConfigurationRegistry();
    registry.registerAll(DEFAULT_ENTRIES);
    expect(registry.ids().length).toBe(DEFAULT_ENTRIES.length);
  });

  it('rejects a duplicate key as a governance violation', () => {
    const registry = new ConfigurationRegistry();
    registry.register(DEFAULT_ENTRIES[0]);
    expect(() => registry.register(DEFAULT_ENTRIES[0])).toThrow(/duplicate key/i);
  });

  it('require() throws for an unknown key', () => {
    const registry = new ConfigurationRegistry();
    expect(() => registry.require('does.not.exist')).toThrow(/Unknown configuration key/);
  });

  it('byCategory returns only entries in that category', () => {
    const registry = new ConfigurationRegistry();
    registry.registerAll(DEFAULT_ENTRIES);
    const platformEntries = registry.byCategory('platform');
    expect(platformEntries.length).toBeGreaterThan(0);
    expect(platformEntries.every((e) => e.category === 'platform')).toBe(true);
  });

  it('every entry has exactly one owner field populated', () => {
    for (const entry of DEFAULT_ENTRIES) {
      expect(entry.owner).toBeTruthy();
    }
  });
});
