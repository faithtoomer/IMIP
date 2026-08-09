import { describe, expect, it } from 'vitest';
import { assertGpuScope, GpuIsolationGuard } from '../src/isolation.js';
import { GPU_MINING_NOMINAL_LIFECYCLE } from '../src/lifecycle.js';
import { GpuMiningLifecycleStage } from '../src/types.js';
import { config, FakeGpuAdapter, makeFramework } from './testHelpers.js';
describe('IGMF GPU isolation and lifecycle', () => {
  it('rejects a second concurrent claim on one UUID and a cross-GPU adapter/config scope', async () => { const guard = new GpuIsolationGuard(); guard.claim('gpu-a', 'session-a'); expect(() => guard.claim('gpu-a', 'session-b')).toThrow('already exclusively claimed'); expect(() => assertGpuScope('gpu-a', 'gpu-b')).toThrow('scope violation'); const { framework } = makeFramework(); const first = await framework.start(config(new FakeGpuAdapter(), 'gpu-nvidia')); await expect(framework.start(config(new FakeGpuAdapter(), 'gpu-nvidia'))).rejects.toThrow('already exclusively claimed'); await framework.stop(first.sessionId); });
  it('runs all nine nominal stages and records a Failed path', async () => { const { framework, providers } = makeFramework(); const adapter = new FakeGpuAdapter(); const session = await framework.start(config(adapter)); await framework.monitor(session.sessionId); await framework.stop(session.sessionId); expect(framework.getLifecycle(session.sessionId).map((x) => x.to)).toEqual(GPU_MINING_NOMINAL_LIFECYCLE); expect(providers.calls).toMatchObject({ reserve: 1, release: 1 }); const broken = new FakeGpuAdapter(); broken.failStart = true; await expect(framework.start(config(broken, 'gpu-amd'))).rejects.toThrow('fixture start failure'); expect(framework.registry.byGpu('gpu-amd')[0].stage).toBe(GpuMiningLifecycleStage.Failed); });
});
