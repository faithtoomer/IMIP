import { ArbitrationAuthority, type ArbitrationAuthorityOptions } from '../src/ArbitrationAuthority.js';
import type { ArbitrationProviders, ArbitrationRequest } from '../src/types.js';

export function makeClock(start = '2026-08-08T20:00:00.000Z') {
  let value = Date.parse(start);
  return { now: () => new Date(value).toISOString(), advance: (milliseconds: number) => { value += milliseconds; } };
}
export function makeRequest(overrides: Partial<ArbitrationRequest> = {}): ArbitrationRequest {
  return { requestId: 'request-a', resourceId: 'gpu-001', resourceType: 'gpu', owner: 'owner-a', requestingAuthority: 'Workload Authority', mode: 'exclusive', capacity: 1, priority: 1, ...overrides };
}
export function fakeProviders(overrides: Partial<ArbitrationProviders> = {}): ArbitrationProviders {
  return {
    competingRequests: { getCompetingRequests: () => [makeRequest(), makeRequest({ requestId: 'request-b', owner: 'owner-b', priority: 2 })] },
    availability: { getAvailability: () => ({ available: true, availableCapacity: 10 }) },
    health: { getHealth: () => ({ status: 'healthy' }) },
    thermal: { getThermalConstraint: () => ({ permitted: true }) },
    power: { getPowerConstraint: () => ({ permitted: true }) },
    runtime: { getRuntimeState: () => ({ permitted: true, state: 'running' }) },
    ...overrides,
  };
}
export function makeAuthority(options: ArbitrationAuthorityOptions = {}): ArbitrationAuthority {
  return new ArbitrationAuthority({ ...options, now: options.now ?? (() => '2026-08-08T20:00:00.000Z'), providers: fakeProviders(options.providers) });
}
