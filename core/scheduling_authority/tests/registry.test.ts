import { describe, expect, it } from 'vitest';
import { ScheduleRegistry } from '../src/registry.js';
import { DuplicateScheduleError, ScheduleNotFoundError } from '../src/errors.js';
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

describe('ScheduleRegistry (§7)', () => {
  it('registers and retrieves a schedule', () => {
    const registry = new ScheduleRegistry();
    registry.register(makeSchedule());
    expect(registry.get('s1')?.name).toBe('x');
  });

  it('rejects a duplicate scheduleId', () => {
    const registry = new ScheduleRegistry();
    registry.register(makeSchedule());
    expect(() => registry.register(makeSchedule())).toThrow(DuplicateScheduleError);
  });

  it('require() throws for an unregistered id', () => {
    const registry = new ScheduleRegistry();
    expect(() => registry.require('missing')).toThrow(ScheduleNotFoundError);
  });

  it('byOwner() filters by ownerAuthority', () => {
    const registry = new ScheduleRegistry();
    registry.register(makeSchedule({ scheduleId: 'a', ownerAuthority: 'A' }));
    registry.register(makeSchedule({ scheduleId: 'b', ownerAuthority: 'B' }));
    expect(registry.byOwner('A')).toHaveLength(1);
  });

  it('update() replaces an existing schedule in place', () => {
    const registry = new ScheduleRegistry();
    registry.register(makeSchedule());
    registry.update(makeSchedule({ status: 'paused' }));
    expect(registry.get('s1')?.status).toBe('paused');
  });

  it('remove() deregisters a schedule', () => {
    const registry = new ScheduleRegistry();
    registry.register(makeSchedule());
    registry.remove('s1');
    expect(registry.get('s1')).toBeUndefined();
  });
});
