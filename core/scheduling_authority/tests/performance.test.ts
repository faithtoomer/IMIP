import { describe, expect, it } from 'vitest';
import { SchedulingAuthority } from '../src/SchedulingAuthority.js';
import { succeedingHandler } from './testHelpers.js';

describe('performance smoke tests', () => {
  it('registers and ticks 200 schedules well under 1s', async () => {
    const isoa = new SchedulingAuthority();
    const start = performance.now();

    for (let i = 0; i < 200; i += 1) {
      await isoa.registerSchedule(
        { name: `job-${i}`, ownerAuthority: 'X', scheduleType: 'manual', trigger: { kind: 'manual' } },
        succeedingHandler(),
      );
    }
    await isoa.tick();

    expect(performance.now() - start).toBeLessThan(1000);
    expect(isoa.getMetrics().scheduledJobs).toBe(200);
  });
});
