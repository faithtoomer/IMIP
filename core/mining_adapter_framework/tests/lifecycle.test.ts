import { describe, expect, it } from 'vitest';
import { AdapterLifecycleError } from '../src/errors.js';
import { ADAPTER_NOMINAL_LIFECYCLE, ADAPTER_LIFECYCLE_TRANSITIONS, assertAdapterLifecycleTransition } from '../src/lifecycle.js';
import { AdapterLifecycleStage } from '../src/types.js';
import { cpuConfig, cpuRequest, makeFramework, registerCpu, validateConfigurePrepareStartCpu } from './testHelpers.js';

describe('IMAF guarded adapter lifecycle', () => {
  it('records the complete nominal lifecycle from supplied contract through retirement', async () => {
    const framework = await validateConfigurePrepareStartCpu();
    await framework.stopAdapter('mock-cpu'); await framework.cleanupAdapter('mock-cpu');
    expect(framework.getLifecycle('mock-cpu').map((record) => record.to)).toEqual(ADAPTER_NOMINAL_LIFECYCLE);
    expect(framework.stage('mock-cpu')).toBe(AdapterLifecycleStage.Retired);
  });
  it('allows every declared guarded transition and rejects skipped/reversed ones', () => {
    for (const [from, targets] of Object.entries(ADAPTER_LIFECYCLE_TRANSITIONS) as Array<[AdapterLifecycleStage, AdapterLifecycleStage[]]>) for (const target of targets) expect(() => assertAdapterLifecycleTransition(from, target)).not.toThrow();
    expect(() => assertAdapterLifecycleTransition(undefined, AdapterLifecycleStage.Running)).toThrow(AdapterLifecycleError);
    expect(() => assertAdapterLifecycleTransition(AdapterLifecycleStage.Retired, AdapterLifecycleStage.Discovered)).toThrow(AdapterLifecycleError);
  });
  it('reaches rejection from validation and explicit failure/recovery from configured runtime work', async () => {
    const rejected = makeFramework(); await registerCpu(rejected);
    const result = await rejected.validateAdapter('mock-cpu', cpuRequest({ algorithm: 'not-supported' }), cpuConfig());
    expect(result.compatible).toBe(false); expect(rejected.stage('mock-cpu')).toBe(AdapterLifecycleStage.Rejected);
    const framework = makeFramework(); await registerCpu(framework); await framework.validateAdapter('mock-cpu', cpuRequest(), cpuConfig());
    await expect(framework.configureAdapter('mock-cpu', { ...cpuConfig(), options: { password: 'raw-illegal' } })).rejects.toThrow('Raw credential');
    expect(framework.stage('mock-cpu')).toBe(AdapterLifecycleStage.Validated);
  });
  it('moves a running adapter through failed, recovered, stopped, and restarted states', async () => {
    const framework = await validateConfigurePrepareStartCpu();
    await (framework as unknown as { fail: (id: string, error: unknown) => Promise<void> }).fail('mock-cpu', new Error('runtime crash'));
    expect(framework.stage('mock-cpu')).toBe(AdapterLifecycleStage.Failed);
    await framework.recoverAdapter('mock-cpu'); expect(framework.stage('mock-cpu')).toBe(AdapterLifecycleStage.Running);
    await framework.stopAdapter('mock-cpu'); await framework.restartAdapter('mock-cpu');
    expect(framework.stage('mock-cpu')).toBe(AdapterLifecycleStage.Running);
  });
});
