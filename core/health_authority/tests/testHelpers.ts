import { HealthAuthority } from '../src/HealthAuthority.js';
import { MapHealthSignalProvider } from '../src/providers.js';
import type { HealthObservation } from '../src/types.js';

export const FIXED_NOW = '2026-08-08T12:00:00.000Z';

export function makeClock(start = FIXED_NOW): { now: () => string; advance: (milliseconds: number) => void } {
  let current = Date.parse(start);
  return { now: () => new Date(current).toISOString(), advance: (milliseconds: number) => { current += milliseconds; } };
}

export function makeObservation(overrides: Partial<HealthObservation> = {}): HealthObservation {
  return {
    componentId: 'gpu-001',
    componentType: 'hardware',
    providerSource: 'Hardware health adapter',
    observedAt: FIXED_NOW,
    categories: ['hardware'],
    metrics: { reliabilityScore: 90, stabilityScore: 80, performanceScore: 70, availabilityScore: 95 },
    failureCount: 1,
    mtbfHours: 2_000,
    availabilityPercent: 95,
    reliabilityTrend: 'stable',
    lastInspection: FIXED_NOW,
    maintenanceHistory: [{ occurredAt: FIXED_NOW, kind: 'inspection', summary: 'Published source inspection.', providerSource: 'Hardware health adapter' }],
    evidence: ['Published HealthSummary status was healthy.', 'Published reliability score was 90.'],
    ...overrides,
  };
}

export function makeAuthority(clock = makeClock(), observations: HealthObservation[] = []): HealthAuthority {
  return new HealthAuthority({ providers: { additional: [new MapHealthSignalProvider(observations)] }, now: clock.now });
}
