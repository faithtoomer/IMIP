import { describe, expect, it } from 'vitest';
import { BudgetManager, createDefaultBudget, DEFAULT_BUDGET_PRESETS, validateBudget } from '../src/budgets.js';
import { ThermalBudgetError } from '../src/errors.js';
import { ThermalAuthority } from '../src/ThermalAuthority.js';

describe('Thermal budgets', () => {
  it('createDefaultBudget() returns domain-specific presets', () => {
    const gpu = createDefaultBudget('gpu');
    expect(gpu.warningThresholdCelsius).toBe(DEFAULT_BUDGET_PRESETS.gpu.warningThresholdCelsius);
    const cpu = createDefaultBudget('cpu');
    expect(cpu.operatingTargetCelsius).toBe(65);
  });

  it('validateBudget() rejects invalid threshold ordering', () => {
    expect(() =>
      validateBudget({
        id: 'bad',
        scope: 'gpu',
        operatingTargetCelsius: 90,
        warningThresholdCelsius: 80,
        criticalThresholdCelsius: 95,
      }),
    ).toThrow(ThermalBudgetError);
  });

  it('BudgetManager stores and retrieves budgets', () => {
    const manager = new BudgetManager();
    const budget = createDefaultBudget('gpu');
    manager.setBudget(budget);
    expect(manager.getBudget(budget.id)?.warningThresholdCelsius).toBe(83);
  });

  it('getBudgetForDevice() falls back to domain default', () => {
    const manager = new BudgetManager();
    const budget = manager.getBudgetForDevice('gpu-0', 'gpu');
    expect(budget.warningThresholdCelsius).toBe(83);
  });

  it('setBudgetForDevice() overrides domain default for specific device', () => {
    const manager = new BudgetManager();
    manager.setBudgetForDevice('gpu-0', {
      id: 'custom',
      scope: 'gpu-0',
      operatingTargetCelsius: 60,
      warningThresholdCelsius: 75,
      criticalThresholdCelsius: 90,
    });
    const budget = manager.getBudgetForDevice('gpu-0', 'gpu');
    expect(budget.warningThresholdCelsius).toBe(75);
  });

  it('ThermalAuthority.setBudgetForDevice() applies custom thresholds', async () => {
    const authority = new ThermalAuthority();
    authority.registerDevice('gpu-0', 'gpu');
    authority.setBudgetForDevice('gpu-0', {
      id: 'custom',
      scope: 'gpu-0',
      operatingTargetCelsius: 50,
      warningThresholdCelsius: 55,
      criticalThresholdCelsius: 60,
    });

    const budget = authority.getBudget('gpu-0');
    expect(budget.warningThresholdCelsius).toBe(55);
  });

  it('updateCurrentCelsius() tracks current reading on budget', () => {
    const manager = new BudgetManager();
    const budget = createDefaultBudget('gpu');
    manager.setBudget(budget);
    manager.updateCurrentCelsius(budget.id, 78);
    expect(manager.getBudget(budget.id)?.currentCelsius).toBe(78);
  });
});
