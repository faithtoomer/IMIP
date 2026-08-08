import { describe, expect, it } from 'vitest';
import { LogCategoryRegistry } from '../src/categoryRegistry.js';
import { DuplicateLogCategoryError } from '../src/errors.js';
import { DEFAULT_LOG_CATEGORIES } from '../src/types.js';

describe('LogCategoryRegistry (§6)', () => {
  it('pre-seeds all 19 default categories', () => {
    const registry = new LogCategoryRegistry();
    for (const category of DEFAULT_LOG_CATEGORIES) {
      expect(registry.has(category)).toBe(true);
    }
    expect(registry.all()).toHaveLength(DEFAULT_LOG_CATEGORIES.length);
  });

  it('registers a new, future category at runtime', () => {
    const registry = new LogCategoryRegistry();
    registry.register('ai-training');
    expect(registry.has('ai-training')).toBe(true);
  });

  it('rejects a duplicate category', () => {
    const registry = new LogCategoryRegistry();
    expect(() => registry.register('runtime')).toThrow(DuplicateLogCategoryError);
  });

  it('has() is false for an unregistered category', () => {
    const registry = new LogCategoryRegistry();
    expect(registry.has('not-a-real-category')).toBe(false);
  });
});
