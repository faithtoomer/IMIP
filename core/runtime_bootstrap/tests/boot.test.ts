import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { FakeDiscoveryProvider } from '../../hardware_authority/tests/testHelpers.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { configurationAuthorityComponent, hardwareAuthorityComponent } from '../src/adapters.js';
import { RUNTIME_EVENTS } from '../src/types.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('RuntimeOrchestrator.boot() — the real platform (§6)', () => {
  it('boots the three real authorities in dependency order and reaches operational', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(configurationAuthorityComponent({ argv: [], env: {} }));
    orchestrator.registerComponent(hardwareAuthorityComponent({ discoveryProvider: new FakeDiscoveryProvider() }));

    const certification = await orchestrator.boot();

    expect(certification.certified).toBe(true);
    expect(orchestrator.getRuntimeState()).toBe('operational');
    expect(orchestrator.getInstance('Configuration Authority')).toBeDefined();
    expect(orchestrator.getInstance('Hardware Authority')).toBeDefined();
  });

  it('publishes the full bootstrap event sequence through the real IEB', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(configurationAuthorityComponent({ argv: [], env: {} }));

    const seen: string[] = [];
    for (const name of Object.values(RUNTIME_EVENTS)) {
      bus.subscribeToEvent(name, () => { seen.push(name); }, { subscriberAuthority: 'Test Observer' });
    }

    await orchestrator.boot();

    expect(seen).toEqual([
      RUNTIME_EVENTS.BootstrapStarted,
      RUNTIME_EVENTS.InitializationStarted,
      RUNTIME_EVENTS.InitializationCompleted,
      RUNTIME_EVENTS.ReadinessVerified,
      RUNTIME_EVENTS.RuntimeCertified,
      RUNTIME_EVENTS.RuntimeOperational,
      RUNTIME_EVENTS.BootstrapCompleted,
    ]);
  });

  it('a generic synthetic component participates correctly alongside the real ones', async () => {
    const { orchestrator } = makeOrchestrator();
    let initialized = false;
    orchestrator.registerComponent(
      makeComponent({
        name: 'Synthetic',
        dependencies: ['Institutional Event Bus'],
        initialize: async () => {
          initialized = true;
        },
      }),
    );

    await orchestrator.boot();
    expect(initialized).toBe(true);
    expect(orchestrator.board.get('Synthetic')?.operationalEligible).toBe(true);
  });

  it('booting from a non-stopped state is rejected by the lifecycle guard', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    await expect(orchestrator.boot()).rejects.toThrow();
  });

  it('records a "boot" operation in the runtime history with certified/operational outcome', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();

    const [record] = orchestrator.getRuntimeHistory();
    expect(record.operation).toBe('boot');
    expect(record.certificationStatus).toBe('certified');
    expect(record.finalState).toBe('operational');
  });

  it('getMetrics() reports startup duration and per-component initialization times', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(configurationAuthorityComponent({ argv: [], env: {} }));
    await orchestrator.boot();

    const metrics = orchestrator.getMetrics();
    expect(metrics.startupDurationMs).toBeGreaterThanOrEqual(0);
    expect(metrics.componentInitializationTimesMs['Configuration Authority']).toBeGreaterThanOrEqual(0);
    expect(metrics.bootedAt).toBeDefined();
    expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
  });
});
