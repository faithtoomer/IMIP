import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { RUNTIME_EVENTS } from '../src/types.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('RuntimeOrchestrator.recover() — re-validate without rebuilding', () => {
  it('recover() from a genuinely faulted platform re-validates and returns to operational on success', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    let shouldFail = true;
    orchestrator.registerComponent(
      makeComponent({
        name: 'A',
        checkHealth: () => (shouldFail ? { status: 'faulted', reasons: ['bad'] } : { status: 'healthy', reasons: [] }),
      }),
    );

    await expect(orchestrator.boot()).rejects.toThrow();
    expect(orchestrator.getRuntimeState()).toBe('faulted');

    shouldFail = false;
    let recovered = false;
    bus.subscribeToEvent(RUNTIME_EVENTS.RuntimeRecovered, () => { recovered = true; }, { subscriberAuthority: 'Observer' });

    const certification = await orchestrator.recover();

    expect(certification.certified).toBe(true);
    expect(orchestrator.getRuntimeState()).toBe('operational');
    expect(recovered).toBe(true);
    expect(orchestrator.getMetrics().recoveryCount).toBe(1);
  });

  it('recover() stays faulted and publishes RuntimeFaulted again if the problem persists', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({ name: 'A', checkHealth: () => ({ status: 'faulted', reasons: ['still bad'] }) }),
    );

    await expect(orchestrator.boot()).rejects.toThrow();

    let faultedCount = 0;
    bus.subscribeToEvent(RUNTIME_EVENTS.RuntimeFaulted, () => { faultedCount += 1; }, { subscriberAuthority: 'Observer' });

    const certification = await orchestrator.recover();

    expect(certification.certified).toBe(false);
    expect(orchestrator.getRuntimeState()).toBe('faulted');
    expect(faultedCount).toBe(1);
  });
});
