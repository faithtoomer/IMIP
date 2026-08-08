import { BudgetNotFoundError } from './errors.js';
import type { PowerBudgetDefinition, PowerBudgetStatus } from './types.js';

/** §10 — Power Budgeting. Budget definitions are real, operator-declared
 * limits; violation detection is real arithmetic over real measured/derived
 * wattage, never estimated. */
export class PowerBudgetManager {
  private budgets = new Map<string, PowerBudgetDefinition>();

  define(definition: PowerBudgetDefinition): PowerBudgetDefinition {
    this.budgets.set(definition.budgetId, definition);
    return definition;
  }

  get(budgetId: string): PowerBudgetDefinition | undefined {
    return this.budgets.get(budgetId);
  }

  require(budgetId: string): PowerBudgetDefinition {
    const budget = this.budgets.get(budgetId);
    if (!budget) throw new BudgetNotFoundError(budgetId);
    return budget;
  }

  all(): PowerBudgetDefinition[] {
    return [...this.budgets.values()];
  }

  evaluate(budget: PowerBudgetDefinition, currentWatts: number, at: Date = new Date()): PowerBudgetStatus {
    return {
      budgetId: budget.budgetId,
      scope: budget.scope,
      targetDeviceId: budget.targetDeviceId,
      currentWatts,
      limitWatts: budget.limitWatts,
      exceeded: currentWatts > budget.limitWatts,
      evaluatedAt: at.toISOString(),
    };
  }
}
