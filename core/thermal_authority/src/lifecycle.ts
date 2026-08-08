import type { ThermalLifecycleStage } from './types.js';
import { ThermalLifecycleError } from './errors.js';

/** §14 — lifecycle transition table. */
export const THERMAL_LIFECYCLE_TRANSITIONS: Record<ThermalLifecycleStage, ThermalLifecycleStage[]> = {
  discovered: ['profiled', 'archived'],
  profiled: ['monitored', 'archived'],
  monitored: ['analyzed', 'archived'],
  analyzed: ['forecasted', 'monitored', 'archived'],
  forecasted: ['recommended', 'analyzed', 'archived'],
  recommended: ['monitored', 'archived'],
  archived: [],
};

export function assertThermalLifecycleTransition(from: ThermalLifecycleStage, to: ThermalLifecycleStage): void {
  const allowed = THERMAL_LIFECYCLE_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ThermalLifecycleError(`Illegal thermal lifecycle transition: "${from}" -> "${to}"`);
  }
}

export function canAdvanceLifecycle(from: ThermalLifecycleStage, to: ThermalLifecycleStage): boolean {
  return THERMAL_LIFECYCLE_TRANSITIONS[from].includes(to);
}
