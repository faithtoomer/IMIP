import { describe, expect, it } from 'vitest';
import { NullCompetingRequestProvider, NullPowerConstraintProvider, NullResourceAvailabilityProvider, NullResourceHealthProvider, NullRuntimeStateProvider, NullThermalConstraintProvider, withDefaultArbitrationProviders } from '../src/providers.js';
import { makeRequest } from './testHelpers.js';

describe('IRAA provider contracts', () => {
  it('uses null structural providers only when no composition root has supplied source adapters', () => {
    const defaults = withDefaultArbitrationProviders(); const request = makeRequest();
    expect(defaults.competingRequests).toBeInstanceOf(NullCompetingRequestProvider);
    expect(defaults.availability).toBeInstanceOf(NullResourceAvailabilityProvider);
    expect(defaults.health).toBeInstanceOf(NullResourceHealthProvider);
    expect(defaults.thermal).toBeInstanceOf(NullThermalConstraintProvider);
    expect(defaults.power).toBeInstanceOf(NullPowerConstraintProvider);
    expect(defaults.runtime).toBeInstanceOf(NullRuntimeStateProvider);
    expect(defaults.availability.getAvailability(request.resourceId, request)).toEqual({ available: true });
    expect(defaults.health.getHealth(request.resourceId, request)).toEqual({ status: 'unknown' });
  });
});
