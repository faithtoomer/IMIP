import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { ComponentNotFoundError } from '../src/errors.js';
import { RUNTIME_EVENTS } from '../src/types.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('RuntimeOrchestrator.requestRestart() (§12)', () => {
  it('full-platform restart tears down and rebuilds every component, incrementing restartCount', async () => {
    const { orchestrator } = makeOrchestrator();
    let createCount = 0;
    orchestrator.registerComponent(
      makeComponent({
        name: 'A',
        create: () => {
          createCount += 1;
          return { tag: `instance-${createCount}` };
        },
      }),
    );

    await orchestrator.boot();
    const firstInstance = orchestrator.getInstance('A');

    const certification = await orchestrator.requestRestart();

    expect(certification?.certified).toBe(true);
    expect(orchestrator.getRuntimeState()).toBe('operational');
    expect(orchestrator.getInstance('A')).not.toBe(firstInstance); // genuinely rebuilt
    expect(orchestrator.board.get('A')?.restartCount).toBe(1);
  });

  it('single-component restart replaces only the named component', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    orchestrator.registerComponent(makeComponent({ name: 'B' }));

    await orchestrator.boot();
    const bInstance = orchestrator.getInstance('B');

    await orchestrator.requestRestart('A');

    expect(orchestrator.getInstance('B')).toBe(bInstance); // untouched
    expect(orchestrator.board.get('A')?.restartCount).toBe(1);
    expect(orchestrator.board.get('B')?.restartCount).toBe(0);
  });

  it('restarting an unknown component throws ComponentNotFoundError', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    await expect(orchestrator.requestRestart('Ghost')).rejects.toThrow(ComponentNotFoundError);
  });

  it('publishes RestartRequested for both full and single-component restarts', async () => {
    const { bus, orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));

    const payloads: unknown[] = [];
    bus.subscribeToEvent(RUNTIME_EVENTS.RestartRequested, (envelope) => { payloads.push(envelope.payload); }, { subscriberAuthority: 'Observer' });

    await orchestrator.boot();
    await orchestrator.requestRestart('A');
    await orchestrator.requestRestart();

    expect(payloads).toEqual([{ componentName: 'A' }, { componentName: 'platform' }]);
  });

  it('full-platform restart preserves runtime history rather than clearing it', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A' }));
    await orchestrator.boot();
    const before = orchestrator.getRuntimeHistory().length;

    await orchestrator.requestRestart();

    expect(orchestrator.getRuntimeHistory().length).toBeGreaterThan(before);
  });
});
