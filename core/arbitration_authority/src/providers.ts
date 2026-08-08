import type {
  ArbitrationProviders, CompetingRequestProvider, PowerConstraintProvider, ResourceAvailabilityProvider,
  ResourceHealthProvider, RuntimeStateProvider, ThermalConstraintProvider,
} from './types.js';

/** Null structural providers preserve isolation until a composition root supplies published source views. */
export class NullCompetingRequestProvider implements CompetingRequestProvider { getCompetingRequests() { return []; } }
export class NullResourceAvailabilityProvider implements ResourceAvailabilityProvider { getAvailability() { return { available: true }; } }
export class NullResourceHealthProvider implements ResourceHealthProvider { getHealth() { return { status: 'unknown' as const }; } }
export class NullThermalConstraintProvider implements ThermalConstraintProvider { getThermalConstraint() { return { permitted: true }; } }
export class NullPowerConstraintProvider implements PowerConstraintProvider { getPowerConstraint() { return { permitted: true }; } }
export class NullRuntimeStateProvider implements RuntimeStateProvider { getRuntimeState() { return { permitted: true, state: 'unknown' }; } }

export function withDefaultArbitrationProviders(providers: ArbitrationProviders = {}): Required<ArbitrationProviders> {
  return {
    competingRequests: providers.competingRequests ?? new NullCompetingRequestProvider(),
    availability: providers.availability ?? new NullResourceAvailabilityProvider(),
    health: providers.health ?? new NullResourceHealthProvider(),
    thermal: providers.thermal ?? new NullThermalConstraintProvider(),
    power: providers.power ?? new NullPowerConstraintProvider(),
    runtime: providers.runtime ?? new NullRuntimeStateProvider(),
  };
}
