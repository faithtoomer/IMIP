import type { ThermalBudget, ThermalDomain } from './types.js';
import { ThermalBudgetError } from './errors.js';

export interface BudgetPreset {
  operatingTargetCelsius: number;
  warningThresholdCelsius: number;
  criticalThresholdCelsius: number;
}

/** Default budget presets per thermal domain. Originate from Configuration Authority
 * via injectable setter; these are institutional defaults when none are configured. */
export const DEFAULT_BUDGET_PRESETS: Record<ThermalDomain, BudgetPreset> = {
  cpu: { operatingTargetCelsius: 65, warningThresholdCelsius: 80, criticalThresholdCelsius: 95 },
  gpu: { operatingTargetCelsius: 70, warningThresholdCelsius: 83, criticalThresholdCelsius: 95 },
  asic: { operatingTargetCelsius: 75, warningThresholdCelsius: 85, criticalThresholdCelsius: 100 },
  platform: { operatingTargetCelsius: 40, warningThresholdCelsius: 50, criticalThresholdCelsius: 60 },
};

export function createDefaultBudget(scope: ThermalDomain | string): ThermalBudget {
  const preset = DEFAULT_BUDGET_PRESETS[scope as ThermalDomain] ?? DEFAULT_BUDGET_PRESETS.platform;
  return {
    id: `budget-${scope}`,
    scope,
    operatingTargetCelsius: preset.operatingTargetCelsius,
    warningThresholdCelsius: preset.warningThresholdCelsius,
    criticalThresholdCelsius: preset.criticalThresholdCelsius,
  };
}

export function validateBudget(budget: ThermalBudget): void {
  if (budget.operatingTargetCelsius >= budget.warningThresholdCelsius) {
    throw new ThermalBudgetError(
      `Operating target (${budget.operatingTargetCelsius}°C) must be below warning threshold (${budget.warningThresholdCelsius}°C)`,
    );
  }
  if (budget.warningThresholdCelsius >= budget.criticalThresholdCelsius) {
    throw new ThermalBudgetError(
      `Warning threshold (${budget.warningThresholdCelsius}°C) must be below critical threshold (${budget.criticalThresholdCelsius}°C)`,
    );
  }
}

/**
 * BudgetManager — manages thermal budgets per device or domain scope.
 * Configuration Authority integration via injectable setter, not direct ICMS import.
 */
export class BudgetManager {
  private budgets = new Map<string, ThermalBudget>();

  setBudget(budget: ThermalBudget): void {
    validateBudget(budget);
    this.budgets.set(budget.id, budget);
  }

  setBudgetForDevice(deviceId: string, budget: ThermalBudget): void {
    validateBudget(budget);
    this.budgets.set(deviceId, { ...budget, id: budget.id || `budget-${deviceId}` });
  }

  getBudget(idOrDeviceId: string): ThermalBudget | undefined {
    return this.budgets.get(idOrDeviceId);
  }

  getBudgetForDevice(deviceId: string, deviceType: ThermalDomain): ThermalBudget {
    return (
      this.budgets.get(deviceId) ??
      this.budgets.get(`budget-${deviceType}`) ??
      createDefaultBudget(deviceType)
    );
  }

  all(): ThermalBudget[] {
    return [...this.budgets.values()];
  }

  remove(id: string): boolean {
    return this.budgets.delete(id);
  }

  updateCurrentCelsius(idOrDeviceId: string, celsius: number): void {
    const budget = this.budgets.get(idOrDeviceId);
    if (budget) {
      this.budgets.set(idOrDeviceId, { ...budget, currentCelsius: celsius });
    }
  }
}
