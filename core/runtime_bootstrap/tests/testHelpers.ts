import type { ComponentDefinition } from '../src/types.js';

export function makeComponent(overrides: Partial<ComponentDefinition<{ tag: string }>> = {}): ComponentDefinition<{ tag: string }> {
  return {
    name: 'Test Component',
    dependencies: [],
    create: () => ({ tag: 'created' }),
    initialize: async () => {},
    checkReadiness: () => ({ ready: true, reasons: [] }),
    checkHealth: () => ({ status: 'healthy', reasons: [] }),
    shutdown: async () => {},
    ...overrides,
  };
}
