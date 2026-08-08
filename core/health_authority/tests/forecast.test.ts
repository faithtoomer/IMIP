import { describe, expect, it } from 'vitest';
import { computeHealthForecast } from '../src/forecast.js';
import { makeAuthority, makeClock, makeObservation } from './testHelpers.js';

describe('IHIA advisory health forecasting', () => {
  it('identifies a degradation trend and advisory expected failure from institutional assessment history', () => {
    const clock = makeClock();
    const authority = makeAuthority(clock);
    authority.assess(makeObservation({ observedAt: clock.now(), metrics: { overallScore: 80 } }));
    clock.advance(60_000);
    authority.assess(makeObservation({ observedAt: clock.now(), metrics: { overallScore: 60 } }));
    clock.advance(60_000);
    const profile = authority.assess(makeObservation({ observedAt: clock.now(), metrics: { overallScore: 40 } }));
    const forecast = authority.getForecast('hardware', 'gpu-001', 'Hardware health adapter');
    expect(forecast).toMatchObject({ degradationTrend: 'degrading', scoreChangePerObservation: -20, expectedFailure: true, advisory: true });
    expect(forecast.expectedFailureAt).toBe(clock.now());
    expect(forecast.maintenanceRecommendation).toContain('does not execute actions');
    expect(computeHealthForecast(profile, clock.now()).basis.join(' ')).toContain('advisory');
  });

  it('reports unknown trend without inventing a failure prediction from one assessment', () => {
    const authority = makeAuthority();
    authority.assess(makeObservation({ metrics: { overallScore: 85 } }));
    const forecast = authority.getForecast('hardware', 'gpu-001', 'Hardware health adapter');
    expect(forecast).toMatchObject({ degradationTrend: 'unknown', expectedFailure: false, confidence: 0.2, advisory: true });
  });

  it('recommends preventative maintenance for a warning profile with a declining trend only', () => {
    const authority = makeAuthority();
    authority.assess(makeObservation({ observedAt: '2026-08-08T12:00:00.000Z', metrics: { overallScore: 75 } }));
    authority.assess(makeObservation({ observedAt: '2026-08-08T12:05:00.000Z', metrics: { overallScore: 65 } }));
    const forecast = authority.getForecast('hardware', 'gpu-001', 'Hardware health adapter');
    expect(forecast.expectedFailure).toBe(false);
    expect(forecast.maintenanceRecommendation).toContain('schedule preventative maintenance');
  });
});
