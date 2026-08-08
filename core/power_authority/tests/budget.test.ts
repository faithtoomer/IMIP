import { describe, expect, it } from 'vitest';
import { BudgetManager } from '../src/budget.js';
import { PowerBudgetError } from '../src/errors.js';

describe('BudgetManager', () => {
  it('setBudget() creates a budget', () => {
    const manager = new BudgetManager();
    const budget = manager.setBudget('platform-cap', 'platform', 1000, 500);
    expect(budget.id).toBe('platform-cap');
    expect(budget.limitWatts).toBe(1000);
    expect(budget.exceeded).toBe(false);
  });

  it('setBudget() rejects non-positive limits', () => {
    const manager = new BudgetManager();
    expect(() => manager.setBudget('bad', 'platform', 0)).toThrow(PowerBudgetError);
    expect(() => manager.setBudget('bad', 'platform', -100)).toThrow(PowerBudgetError);
  });

  it('updateCurrentWatts() marks budget as exceeded', () => {
    const manager = new BudgetManager();
    manager.setBudget('gpu-cap', 'gpu', 300, 200);
    const eval_ = manager.updateCurrentWatts('gpu-cap', 350);
    expect(eval_.budget.exceeded).toBe(true);
    expect(eval_.justExceeded).toBe(true);
    expect(eval_.justRecovered).toBe(false);
  });

  it('updateCurrentWatts() detects recovery', () => {
    const manager = new BudgetManager();
    manager.setBudget('gpu-cap', 'gpu', 300, 350);
    manager.updateCurrentWatts('gpu-cap', 350);
    const eval_ = manager.updateCurrentWatts('gpu-cap', 250);
    expect(eval_.budget.exceeded).toBe(false);
    expect(eval_.justRecovered).toBe(true);
  });

  it('requireBudget() throws for unknown budget', () => {
    const manager = new BudgetManager();
    expect(() => manager.requireBudget('missing')).toThrow(PowerBudgetError);
  });

  it('evaluateAll() updates all budgets by scope', () => {
    const manager = new BudgetManager();
    manager.setBudget('platform', 'platform', 1000);
    manager.setBudget('gpu', 'gpu', 500);
    const results = manager.evaluateAll({ platform: 800, gpu: 450 });
    expect(results).toHaveLength(2);
    expect(results.every((r) => !r.budget.exceeded)).toBe(true);
  });
});
