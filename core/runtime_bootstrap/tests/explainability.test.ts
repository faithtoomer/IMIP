import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('explainability (§14, §22 Governance Board queries)', () => {
  it('board.whyUnavailable() explains a component blocked by a failed dependency', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({
        name: 'Upstream',
        initialize: async () => {
          throw new Error('upstream exploded');
        },
      }),
    );
    orchestrator.registerComponent(makeComponent({ name: 'Downstream', dependencies: ['Upstream'] }));

    await expect(orchestrator.boot({ allowPartialStartup: true })).resolves.toBeDefined();

    const reasons = orchestrator.board.whyUnavailable('Downstream');
    expect(reasons.join(' ')).toMatch(/Missing dependencies: Upstream/);
  });

  it('board.blockingComponents() identifies exactly what prevented full certification', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'Good' }));
    orchestrator.registerComponent(
      makeComponent({ name: 'Bad', initialize: async () => { throw new Error('boom'); } }),
    );

    await orchestrator.boot({ allowPartialStartup: true });

    expect(orchestrator.board.blockingComponents()).toEqual(['Bad']);
  });

  it('every runtime operation record answers what/when/duration/final-state', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    await orchestrator.boot();

    const [record] = orchestrator.getRuntimeHistory();
    expect(record.operation).toBe('boot');
    expect(typeof record.timestamp).toBe('string');
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.componentsInitialized).toContain('A');
    expect(record.finalState).toBe('operational');
  });

  it('getCertificationStatus() returns the most recent certification result', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));

    expect(orchestrator.getCertificationStatus()).toBeUndefined();
    await orchestrator.boot();
    expect(orchestrator.getCertificationStatus()?.certified).toBe(true);
  });

  it('runtime history is bounded and does not grow unboundedly', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    await orchestrator.boot();

    for (let i = 0; i < 250; i += 1) {
      await orchestrator.requestMaintenance();
      await orchestrator.resume();
    }

    expect(orchestrator.getRuntimeHistory().length).toBeLessThanOrEqual(200);
  });
});
