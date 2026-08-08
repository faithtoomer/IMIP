import { describe, expect, it, vi } from 'vitest';
import { POWER_EVENTS, PowerEventBus } from '../src/events.js';
import { createTestAuthority, registerGpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';

describe('PowerEventBus', () => {
  it('publish/subscribe delivers events', () => {
    const bus = new PowerEventBus();
    const handler = vi.fn();
    bus.subscribe(POWER_EVENTS.ProfileCreated, handler);
    bus.publish(POWER_EVENTS.ProfileCreated, { deviceId: 'gpu-1' });
    expect(handler).toHaveBeenCalledWith({ deviceId: 'gpu-1' });
  });

  it('unsubscribe stops delivery', () => {
    const bus = new PowerEventBus();
    const handler = vi.fn();
    const unsub = bus.subscribe(POWER_EVENTS.UsageUpdated, handler);
    unsub();
    bus.publish(POWER_EVENTS.UsageUpdated, { deviceId: 'gpu-1' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('POWER_EVENTS contains all spec §14 event names', () => {
    expect(POWER_EVENTS.ProfileCreated).toBe('PowerProfileCreated');
    expect(POWER_EVENTS.UsageUpdated).toBe('PowerUsageUpdated');
    expect(POWER_EVENTS.BudgetExceeded).toBe('PowerBudgetExceeded');
    expect(POWER_EVENTS.BudgetRecovered).toBe('PowerBudgetRecovered');
    expect(POWER_EVENTS.EfficiencyCalculated).toBe('EfficiencyCalculated');
    expect(POWER_EVENTS.CostUpdated).toBe('CostUpdated');
    expect(POWER_EVENTS.RecommendationGenerated).toBe('RecommendationGenerated');
    expect(POWER_EVENTS.SensorUnavailable).toBe('PowerSensorUnavailable');
    expect(POWER_EVENTS.HealthChanged).toBe('PowerHealthChanged');
  });
});

describe('PowerAuthority events', () => {
  it('registerDevice publishes ProfileCreated', () => {
    const { authority } = createTestAuthority();
    const handler = vi.fn();
    authority.subscribe(POWER_EVENTS.ProfileCreated, handler);
    registerGpu(authority);
    expect(handler).toHaveBeenCalled();
  });

  it('collectAndUpdate publishes UsageUpdated', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    const handler = vi.fn();
    authority.subscribe(POWER_EVENTS.UsageUpdated, handler);
    telemetry.setSamples([synthesizeSample('gpu-1', 200)]);
    await authority.collectAndUpdate();
    expect(handler).toHaveBeenCalled();
  });

  it('budget exceeded publishes BudgetExceeded event', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    authority.setBudget('gpu-cap', 'gpu', 100);
    const handler = vi.fn();
    authority.subscribe(POWER_EVENTS.BudgetExceeded, handler);
    telemetry.setSamples([synthesizeSample('gpu-1', 250)]);
    await authority.collectAndUpdate();
    expect(handler).toHaveBeenCalled();
  });
});
