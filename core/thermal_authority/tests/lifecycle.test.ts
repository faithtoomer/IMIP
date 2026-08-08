import { describe, expect, it } from 'vitest';
import { assertThermalLifecycleTransition, canAdvanceLifecycle, THERMAL_LIFECYCLE_TRANSITIONS } from '../src/lifecycle.js';
import { ThermalLifecycleError } from '../src/errors.js';

describe('Thermal lifecycle', () => {
  it('allows discovered -> profiled', () => {
    expect(canAdvanceLifecycle('discovered', 'profiled')).toBe(true);
  });

  it('allows monitored -> analyzed', () => {
    expect(canAdvanceLifecycle('monitored', 'analyzed')).toBe(true);
  });

  it('allows forecasted -> recommended', () => {
    expect(canAdvanceLifecycle('forecasted', 'recommended')).toBe(true);
  });

  it('rejects archived -> monitored', () => {
    expect(canAdvanceLifecycle('archived', 'monitored')).toBe(false);
  });

  it('assertThermalLifecycleTransition() throws on illegal transition', () => {
    expect(() => assertThermalLifecycleTransition('archived', 'monitored')).toThrow(ThermalLifecycleError);
  });

  it('archived has no outgoing transitions', () => {
    expect(THERMAL_LIFECYCLE_TRANSITIONS.archived).toHaveLength(0);
  });
});
