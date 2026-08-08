import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { RUNTIME_EVENTS } from '../src/types.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('pause / resume / maintenance (§7)', () => {
  it('pause() transitions operational -> paused and publishes RuntimePaused with the reason', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    await orchestrator.boot();

    let payload: unknown;
    bus.subscribeToEvent(RUNTIME_EVENTS.RuntimePaused, (envelope) => { payload = envelope.payload; }, { subscriberAuthority: 'Observer' });

    await orchestrator.pause('operator request');
    expect(orchestrator.getRuntimeState()).toBe('paused');
    expect(payload).toEqual({ reason: 'operator request' });
  });

  it('resume() transitions paused -> operational and publishes RuntimeResumed', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    await orchestrator.pause();

    let resumed = false;
    bus.subscribeToEvent(RUNTIME_EVENTS.RuntimeResumed, () => { resumed = true; }, { subscriberAuthority: 'Observer' });

    await orchestrator.resume();
    expect(orchestrator.getRuntimeState()).toBe('operational');
    expect(resumed).toBe(true);
  });

  it('requestMaintenance() transitions operational -> maintenance and is recorded in history', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    const before = orchestrator.getRuntimeHistory().length;

    await orchestrator.requestMaintenance();

    expect(orchestrator.getRuntimeState()).toBe('maintenance');
    expect(orchestrator.getRuntimeHistory().length).toBe(before + 1);
    expect(orchestrator.getRuntimeHistory().at(-1)?.finalState).toBe('maintenance');
  });

  it('maintenance -> operational is allowed (exiting maintenance)', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    await orchestrator.requestMaintenance();
    await orchestrator.resume();
    expect(orchestrator.getRuntimeState()).toBe('operational');
  });
});
