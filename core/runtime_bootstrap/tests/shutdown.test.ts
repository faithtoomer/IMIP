import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { RUNTIME_EVENTS } from '../src/types.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('RuntimeOrchestrator.requestShutdown() (§11)', () => {
  it('shuts down components in reverse dependency order', async () => {
    const { orchestrator } = makeOrchestrator();
    const shutdownOrder: string[] = [];
    orchestrator.registerComponent(makeComponent({ name: 'A', shutdown: async () => { shutdownOrder.push('A'); } }));
    orchestrator.registerComponent(makeComponent({ name: 'B', dependencies: ['A'], shutdown: async () => { shutdownOrder.push('B'); } }));

    await orchestrator.boot();
    await orchestrator.requestShutdown();

    // B depends on A, so B started after A and must shut down before A.
    expect(shutdownOrder.indexOf('B')).toBeLessThan(shutdownOrder.indexOf('A'));
    expect(orchestrator.getRuntimeState()).toBe('stopped');
  });

  it('marks every shut-down component in the governance board', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    await orchestrator.boot();
    await orchestrator.requestShutdown();
    expect(orchestrator.board.get('A')?.lifecycleState).toBe('shutdown');
  });

  it('publishes ShutdownRequested and ShutdownCompleted', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    const seen: string[] = [];
    bus.subscribeToEvent(RUNTIME_EVENTS.ShutdownRequested, () => { seen.push('requested'); }, { subscriberAuthority: 'Observer' });
    bus.subscribeToEvent(RUNTIME_EVENTS.ShutdownCompleted, () => { seen.push('completed'); }, { subscriberAuthority: 'Observer' });

    await orchestrator.boot();
    await orchestrator.requestShutdown();

    expect(seen).toEqual(['requested', 'completed']);
  });

  it('one component failing to shut down does not prevent the others from shutting down', async () => {
    const { orchestrator } = makeOrchestrator();
    const shutdownOrder: string[] = [];
    orchestrator.registerComponent(
      makeComponent({
        name: 'Broken',
        shutdown: async () => {
          throw new Error('cannot stop');
        },
      }),
    );
    orchestrator.registerComponent(makeComponent({ name: 'Fine', shutdown: async () => { shutdownOrder.push('Fine'); } }));

    await orchestrator.boot();
    await orchestrator.requestShutdown();

    expect(shutdownOrder).toEqual(['Fine']);
    expect(orchestrator.getRuntimeState()).toBe('stopped'); // orchestrator still reaches quiescence
    expect(orchestrator.board.get('Broken')?.lifecycleState).toBe('failed');
  });

  it('can reboot after a full shutdown', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    await orchestrator.boot();
    await orchestrator.requestShutdown();
    await expect(orchestrator.boot()).resolves.toBeDefined();
    expect(orchestrator.getRuntimeState()).toBe('operational');
  });
});
