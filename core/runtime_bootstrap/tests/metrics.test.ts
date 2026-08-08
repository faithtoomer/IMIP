import { describe, expect, it } from 'vitest';
import { InstitutionalEventBus } from '../../event_bus/src/index.js';
import { RuntimeOrchestrator } from '../src/RuntimeOrchestrator.js';
import { makeComponent } from './testHelpers.js';

function makeOrchestrator() {
  const bus = new InstitutionalEventBus();
  return { bus, orchestrator: new RuntimeOrchestrator(bus) };
}

describe('getMetrics() (§17 — Telemetry Authority read surface)', () => {
  it('uptimeMs is undefined before boot and defined while operational', async () => {
    const { orchestrator } = makeOrchestrator();
    expect(orchestrator.getMetrics().uptimeMs).toBeUndefined();
    await orchestrator.boot();
    expect(orchestrator.getMetrics().uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('lastShutdownDurationMs is populated after a shutdown', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    expect(orchestrator.getMetrics().lastShutdownDurationMs).toBeUndefined();
    await orchestrator.requestShutdown();
    expect(orchestrator.getMetrics().lastShutdownDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('lastRestartDurationMs is populated after a full-platform restart', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    await orchestrator.requestRestart();
    expect(orchestrator.getMetrics().lastRestartDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('recoveryCount increments only on successful recover(), not on attempts', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.registerComponent(makeComponent({ name: 'A', checkHealth: () => ({ status: 'faulted', reasons: ['x'] }) }));
    await expect(orchestrator.boot()).rejects.toThrow();

    await orchestrator.recover(); // still faulted — no increment
    expect(orchestrator.getMetrics().recoveryCount).toBe(0);
  });

  it('getMetrics() returns a snapshot, not a live-mutable reference', async () => {
    const { orchestrator } = makeOrchestrator();
    await orchestrator.boot();
    const snapshot = orchestrator.getMetrics();
    snapshot.componentInitializationTimesMs['Injected'] = 999;
    expect(orchestrator.getMetrics().componentInitializationTimesMs['Injected']).toBeUndefined();
  });
});
