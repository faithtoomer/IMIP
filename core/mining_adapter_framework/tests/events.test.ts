import { describe, expect, it, vi } from 'vitest';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ADAPTER_EVENTS, type AdapterEventName } from '../src/events.js';
import { AdapterLifecycleStage } from '../src/types.js';
import { cpuConfig, cpuRequest, makeFramework, registerCpu } from './testHelpers.js';

describe('IMAF adapter events', () => {
  it('publishes all eleven named events and mirrors the additive mining-adapter EventCategory', async () => {
    const institutional = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const framework = makeFramework({ eventBus: institutional });
    const handlers = Object.fromEntries(Object.values(ADAPTER_EVENTS).map((event) => [event, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>;
    for (const [event, handler] of Object.entries(handlers)) framework.subscribe(event as AdapterEventName, handler);
    await registerCpu(framework); await framework.validateAdapter('mock-cpu', cpuRequest(), cpuConfig()); await framework.configureAdapter('mock-cpu', cpuConfig()); await framework.prepareAdapter('mock-cpu'); await framework.startAdapter('mock-cpu'); await framework.collectStatistics('mock-cpu'); await framework.stopAdapter('mock-cpu');
    await (framework as unknown as { fail: (id: string, error: unknown) => Promise<void> }).fail('mock-cpu', new Error('runtime crash'));
    expect(framework.stage('mock-cpu')).toBe(AdapterLifecycleStage.Failed); await framework.recoverAdapter('mock-cpu');
    const rejected = makeFramework({ eventBus: institutional }); rejected.subscribe(ADAPTER_EVENTS.AdapterRejected, handlers.AdapterRejected); await registerCpu(rejected); await rejected.validateAdapter('mock-cpu', cpuRequest({ algorithm: 'unsupported' }), cpuConfig());
    await framework.events.flushMirror(); await rejected.events.flushMirror();
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalled();
    expect(institutional.getEventDefinitions('mining-adapter').map((definition) => definition.name)).toEqual(expect.arrayContaining(Object.values(ADAPTER_EVENTS)));
  });
});
