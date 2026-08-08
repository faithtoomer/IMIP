import { describe, expect, it } from 'vitest';
import { makeAuthority, syncDefault, FIXED_NOW, FIXED_LATER } from './testHelpers.js';

describe('Leasing via ownership and allocation', () => {
  it('establishes ownership on allocation with lease expiration', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);

    const allocation = authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'lease-holder',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
      leaseExpiration: FIXED_LATER,
    });

    const ownership = authority.ownership.get('hw-gpu-001:gpu');
    expect(ownership?.owner).toBe('lease-holder');
    expect(ownership?.leaseExpiration).toBe(FIXED_LATER);
    expect(allocation.leaseExpiration).toBe(FIXED_LATER);
  });

  it('renews lease through ownership manager', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);

    authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'lease-holder',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
      leaseExpiration: FIXED_NOW,
    });

    const renewed = authority.ownership.renewLease(
      'hw-gpu-001:gpu',
      FIXED_LATER,
      '2026-08-09T12:00:00.000Z',
      'extended lease',
    );
    expect(renewed.leaseExpiration).toBe('2026-08-09T12:00:00.000Z');
  });

  it('records release in ownership history on release', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);

    const allocation = authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'lease-holder',
      requestingAuthority: 'Workload Authority',
      mode: 'exclusive',
      capacity: 100,
    });

    authority.release('hw-gpu-001:gpu', {
      allocationId: allocation.id,
      reason: 'lease-ended',
      initiatingAuthority: 'Workload Authority',
    });

    const ownership = authority.ownership.get('hw-gpu-001:gpu');
    expect(ownership?.releaseHistory).toHaveLength(1);
    expect(ownership?.releaseHistory[0]?.reason).toBe('lease-ended');
  });

  it('activates temporary allocation', async () => {
    const authority = makeAuthority();
    await syncDefault(authority);

    const allocation = authority.requestAllocation({
      resourceId: 'hw-gpu-001:gpu',
      owner: 'temp-workload',
      requestingAuthority: 'Workload Authority',
      mode: 'temporary',
      capacity: 50,
    });
    expect(allocation.state).toBe('pending');

    const activated = authority.activate(allocation.id, 'Workload Authority');
    expect(activated.state).toBe('active');
    expect(authority.getResource('hw-gpu-001:gpu').state).toBe('active');
  });
});
