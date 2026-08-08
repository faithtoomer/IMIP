import { describe, expect, it } from 'vitest';
import { NotificationCategoryRegistry } from '../src/categoryRegistry.js';
import { DEFAULT_NOTIFICATION_CATEGORIES } from '../src/types.js';

describe('NotificationCategoryRegistry (§6)', () => {
  it('pre-seeds every default category, including ones not in the Event Bus\'s EventCategory', () => {
    const registry = new NotificationCategoryRegistry();
    for (const category of DEFAULT_NOTIFICATION_CATEGORIES) {
      expect(registry.has(category)).toBe(true);
    }
    expect(registry.has('maintenance')).toBe(true);
    expect(registry.has('backup')).toBe(true);
    expect(registry.has('recovery')).toBe(true);
    expect(registry.has('operator')).toBe(true);
  });

  it('registers a new, future category at runtime', () => {
    const registry = new NotificationCategoryRegistry();
    registry.register('fleet-management');
    expect(registry.has('fleet-management')).toBe(true);
  });

  it('has() is false for an unregistered category', () => {
    const registry = new NotificationCategoryRegistry();
    expect(registry.has('not-a-real-category')).toBe(false);
  });
});
