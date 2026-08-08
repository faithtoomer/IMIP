import { describe, expect, it } from 'vitest';
import { PERMISSIVE_POLICY_EVALUATOR, PERMISSIVE_RESOURCE_EVALUATOR, hardwareResourceEvaluator } from '../src/evaluators.js';
import { HardwareAuthority } from '../../hardware_authority/src/index.js';
import type { ScheduleDefinition } from '../src/types.js';

function makeSchedule(overrides: Partial<ScheduleDefinition> = {}): ScheduleDefinition {
  return {
    scheduleId: 's1',
    name: 'x',
    description: '',
    ownerAuthority: 'X',
    scheduleType: 'time',
    trigger: { kind: 'time', intervalMs: 1000 },
    dependencies: [],
    priority: 'normal',
    status: 'eligible',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Evaluators (ADR-0014 — Policy/Workload Authority are both unimplemented)', () => {
  it('PERMISSIVE_POLICY_EVALUATOR always approves', () => {
    const result = PERMISSIVE_POLICY_EVALUATOR.evaluate(makeSchedule(), { now: new Date() });
    expect(result.approved).toBe(true);
  });

  it('PERMISSIVE_RESOURCE_EVALUATOR always reports available', () => {
    const result = PERMISSIVE_RESOURCE_EVALUATOR.evaluate(makeSchedule(), { now: new Date() });
    expect(result.available).toBe(true);
  });

  it('hardwareResourceEvaluator reports unavailable for a device that is not "available" in real IHIS state', async () => {
    const hardware = new HardwareAuthority();
    await hardware.discover();
    const evaluator = hardwareResourceEvaluator(hardware);
    const [device] = hardware.getInventory();
    hardware.reserve(device.deviceId, 'test', 'Test');

    const result = evaluator.evaluate(makeSchedule({ requiredDevices: [device.deviceId] }), { now: new Date() });
    expect(result.available).toBe(false);
    expect(result.reasons[0]).toContain(device.deviceId);
  });

  it('hardwareResourceEvaluator reports available for a device left untouched', async () => {
    const hardware = new HardwareAuthority();
    await hardware.discover();
    const evaluator = hardwareResourceEvaluator(hardware);
    const [device] = hardware.getInventory();

    const result = evaluator.evaluate(makeSchedule({ requiredDevices: [device.deviceId] }), { now: new Date() });
    expect(result.available).toBe(true);
  });

  it('hardwareResourceEvaluator treats an unknown deviceId as unavailable, not a crash', () => {
    const hardware = new HardwareAuthority();
    const evaluator = hardwareResourceEvaluator(hardware);
    const result = evaluator.evaluate(makeSchedule({ requiredDevices: ['nonexistent-device'] }), { now: new Date() });
    expect(result.available).toBe(false);
  });
});
