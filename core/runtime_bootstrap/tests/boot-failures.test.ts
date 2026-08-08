import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { BootstrapFailedError, CertificationFailedError } from '../src/errors.js';
import { RUNTIME_EVENTS } from '../src/types.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('RuntimeOrchestrator.boot() failure handling (§16, Law 6)', () => {
  it('a component that throws during initialize() fails the whole boot in strict mode', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({
        name: 'Broken',
        initialize: async () => {
          throw new Error('init exploded');
        },
      }),
    );

    await expect(orchestrator.boot()).rejects.toThrow(BootstrapFailedError);
    expect(orchestrator.getRuntimeState()).toBe('faulted');
    expect(orchestrator.board.get('Broken')?.lifecycleState).toBe('failed');
  });

  it('a component that fails its readiness check fails the whole boot in strict mode', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({
        name: 'NotReady',
        checkReadiness: () => ({ ready: false, reasons: ['still warming up'] }),
      }),
    );

    await expect(orchestrator.boot()).rejects.toThrow(BootstrapFailedError);
    expect(orchestrator.getRuntimeState()).toBe('faulted');
  });

  it('a component that is ready but faulted-health fails certification in strict mode', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({
        name: 'Unhealthy',
        checkHealth: () => ({ status: 'faulted', reasons: ['corrupted'] }),
      }),
    );

    await expect(orchestrator.boot()).rejects.toThrow(CertificationFailedError);
    expect(orchestrator.getRuntimeState()).toBe('faulted');
  });

  it('publishes RuntimeFaulted when strict-mode boot fails', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({
        name: 'Broken',
        initialize: async () => {
          throw new Error('boom');
        },
      }),
    );

    let faulted = false;
    bus.subscribeToEvent(RUNTIME_EVENTS.RuntimeFaulted, () => {
      faulted = true;
    }, { subscriberAuthority: 'Observer' });

    await expect(orchestrator.boot()).rejects.toThrow();
    expect(faulted).toBe(true);
  });

  it('with allowPartialStartup, a failed component does not block Operational for the rest', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(
      makeComponent({
        name: 'Broken',
        initialize: async () => {
          throw new Error('boom');
        },
      }),
    );
    orchestrator.registerComponent(makeComponent({ name: 'Healthy' }));

    const certification = await orchestrator.boot({ allowPartialStartup: true });

    expect(certification.certified).toBe(true);
    expect(orchestrator.getRuntimeState()).toBe('operational');
    expect(orchestrator.board.get('Broken')?.lifecycleState).toBe('failed');
    expect(orchestrator.board.get('Broken')?.operationalEligible).toBe(false);
    expect(orchestrator.board.get('Healthy')?.operationalEligible).toBe(true);
  });

  it('a missing dependency is detected before any component is created', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A', dependencies: ['Ghost'] }));
    await expect(orchestrator.boot()).rejects.toThrow(/unregistered component/);
  });
});
