import { describe, expect, it } from 'vitest';
import { makeAuthority, syncDefault, makeInventoryUnit } from './testHelpers.js';

describe('ResourceAuthority performance', () => {
  it('syncs 100 resources within reasonable time', async () => {
    const units = Array.from({ length: 100 }, (_, i) =>
      makeInventoryUnit({
        hardwareId: `hw-${String(i).padStart(3, '0')}`,
        resourceType: 'gpu',
      }),
    );
    const authority = makeAuthority(units);
    const start = performance.now();
    await authority.syncFromHardwareInventory();
    const elapsed = performance.now() - start;
    expect(authority.registry.all()).toHaveLength(100);
    expect(elapsed).toBeLessThan(1000);
  });

  it('allocates across 50 resources deterministically', async () => {
    const units = Array.from({ length: 50 }, (_, i) =>
      makeInventoryUnit({
        hardwareId: `hw-${String(i).padStart(3, '0')}`,
        resourceType: 'gpu',
        maximumCapacity: 100,
      }),
    );
    const authority = makeAuthority(units);
    await syncDefault(authority);

    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const allocation = authority.requestAllocation({
        owner: `workload-${i}`,
        requestingAuthority: 'Workload Authority',
        mode: 'shared',
        capacity: 10,
        resourceType: 'gpu',
      });
      results.push(allocation.resourceId);
    }

    const authority2 = makeAuthority(units);
    await syncDefault(authority2);
    const results2: string[] = [];
    for (let i = 0; i < 10; i++) {
      const allocation = authority2.requestAllocation({
        owner: `workload-${i}`,
        requestingAuthority: 'Workload Authority',
        mode: 'shared',
        capacity: 10,
        resourceType: 'gpu',
      });
      results2.push(allocation.resourceId);
    }

    expect(results).toEqual(results2);
  });

  it('getMetrics aggregates fleet quickly', async () => {
    const units = Array.from({ length: 200 }, (_, i) =>
      makeInventoryUnit({ hardwareId: `hw-${i}`, resourceType: i % 2 === 0 ? 'gpu' : 'cpu' }),
    );
    const authority = makeAuthority(units);
    await syncDefault(authority);
    const start = performance.now();
    const metrics = authority.getMetrics();
    const elapsed = performance.now() - start;
    expect(metrics.totalResources).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });

  it('getRecommendations completes for large fleet', async () => {
    const units = Array.from({ length: 100 }, (_, i) =>
      makeInventoryUnit({ hardwareId: `hw-${i}` }),
    );
    const authority = makeAuthority(units);
    await syncDefault(authority);
    const start = performance.now();
    const recommendations = authority.getRecommendations({ requestedCapacity: 10 });
    const elapsed = performance.now() - start;
    expect(recommendations.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
