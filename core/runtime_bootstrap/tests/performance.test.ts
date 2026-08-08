import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { makeComponent } from './testHelpers.js';

/** §17/§18 — lightweight performance smoke test, not a benchmarking suite. */
describe('performance smoke tests', () => {
  it('boots 50 independent synthetic components well under 500ms', async () => {
    const bus = new InstitutionalEventBus();
    const orchestrator = new RuntimeOrchestrator(bus);
    for (let i = 0; i < 50; i += 1) {
      orchestrator.registerComponent(makeComponent({ name: `Component-${i}` }));
    }

    const start = performance.now();
    await orchestrator.boot();
    expect(performance.now() - start).toBeLessThan(500);
    expect(orchestrator.getRuntimeState()).toBe('operational');
  });

  it('a 20-component dependency chain resolves ordering quickly', async () => {
    const bus = new InstitutionalEventBus();
    const orchestrator = new RuntimeOrchestrator(bus);
    let previous = 'Institutional Event Bus';
    for (let i = 0; i < 20; i += 1) {
      const name = `Chain-${i}`;
      orchestrator.registerComponent(makeComponent({ name, dependencies: [previous] }));
      previous = name;
    }

    const start = performance.now();
    await orchestrator.boot();
    expect(performance.now() - start).toBeLessThan(500);
  });
});
