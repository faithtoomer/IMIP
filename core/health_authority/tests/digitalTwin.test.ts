import { describe, expect, it } from 'vitest';
import { assembleInstitutionalHealthDigitalTwin } from '../src/digitalTwin.js';
import { makeAuthority, makeObservation } from './testHelpers.js';

describe('Institutional Health Digital Twin (IHDT)', () => {
  it('combines hardware, power, thermal, resource, workload, runtime, reliability, and maintenance history into one institutional read model', () => {
    const authority = makeAuthority();
    const observations = [
      makeObservation(),
      makeObservation({ componentId: 'site-power', componentType: 'authority', providerSource: 'Power adapter', categories: ['power'], metrics: { overallScore: 80 } }),
      makeObservation({ componentId: 'rack-thermal', componentType: 'authority', providerSource: 'Thermal adapter', categories: ['thermal'], metrics: { overallScore: 70 } }),
      makeObservation({ componentId: 'gpu-resource', componentType: 'resource', providerSource: 'Resource adapter', categories: ['resource'], metrics: { overallScore: 90 } }),
      makeObservation({ componentId: 'workload-1', componentType: 'workload', providerSource: 'Workload adapter', categories: ['runtime'], metrics: { overallScore: 60 } }),
    ];
    for (const observation of observations) authority.assess(observation);
    const twin = authority.getDigitalTwin();
    expect(twin.twinId).toBe('institutional-health');
    expect(twin.componentProfiles).toHaveLength(5);
    expect(twin.dimensions.hardware).toMatchObject({ profileCount: 1, averageScore: 84.5 });
    expect(twin.dimensions.power).toMatchObject({ profileCount: 1, averageScore: 80 });
    expect(twin.dimensions.thermal).toMatchObject({ profileCount: 1, averageScore: 70 });
    expect(twin.dimensions.resource).toMatchObject({ profileCount: 1, averageScore: 90 });
    expect(twin.dimensions.runtime).toMatchObject({ profileCount: 1, averageScore: 60 });
    expect(twin.reliabilityHistory).toHaveLength(5);
    expect(twin.maintenanceHistory).toHaveLength(5);
    expect(twin.forecasts.every((forecast) => forecast.advisory)).toBe(true);
  });

  it('returns every category even where no profile has yet been observed', () => {
    const twin = assembleInstitutionalHealthDigitalTwin({ profiles: [], forecasts: [], now: '2026-08-08T12:00:00.000Z' });
    expect(twin.institutionalScore).toBeUndefined();
    expect(twin.dimensions.database).toMatchObject({ profileCount: 0, statuses: { healthy: 0, warning: 0, critical: 0, unknown: 0 } });
  });
});
