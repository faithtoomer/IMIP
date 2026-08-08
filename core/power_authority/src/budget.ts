import { PowerBudgetError } from './errors.js';
import type { BudgetScope, PowerBudget } from './types.js';

export interface BudgetEvaluation {
  budget: PowerBudget;
  wasExceeded: boolean;
  justExceeded: boolean;
  justRecovered: boolean;
}

/**
 * §10 — manages configurable power budgets and tracks exceeded/recovered state.
 */
export class BudgetManager {
  private budgets = new Map<string, PowerBudget>();
  private previousExceeded = new Map<string, boolean>();

  setBudget(id: string, scope: BudgetScope, limitWatts: number, currentWatts = 0): PowerBudget {
    if (!Number.isFinite(limitWatts) || limitWatts <= 0) {
      throw new PowerBudgetError(`Budget limit must be a positive finite number, got ${limitWatts}`);
    }
    const exceeded = currentWatts > limitWatts;
    const budget: PowerBudget = { id, scope, limitWatts, currentWatts, exceeded };
    this.budgets.set(id, budget);
    this.previousExceeded.set(id, exceeded);
    return budget;
  }

  getBudget(id: string): PowerBudget | undefined {
    return this.budgets.get(id);
  }

  requireBudget(id: string): PowerBudget {
    const budget = this.budgets.get(id);
    if (!budget) throw new PowerBudgetError(`Unknown budget: "${id}"`);
    return budget;
  }

  all(): PowerBudget[] {
    return [...this.budgets.values()];
  }

  updateCurrentWatts(id: string, currentWatts: number): BudgetEvaluation {
    const budget = this.requireBudget(id);
    const wasExceeded = this.previousExceeded.get(id) ?? budget.exceeded;
    const exceeded = currentWatts > budget.limitWatts;
    const updated: PowerBudget = { ...budget, currentWatts, exceeded };
    this.budgets.set(id, updated);
    this.previousExceeded.set(id, exceeded);

    return {
      budget: updated,
      wasExceeded,
      justExceeded: !wasExceeded && exceeded,
      justRecovered: wasExceeded && !exceeded,
    };
  }

  evaluateAll(totalWattsByScope: Partial<Record<BudgetScope, number>>): BudgetEvaluation[] {
    const results: BudgetEvaluation[] = [];
    for (const budget of this.budgets.values()) {
      const watts = totalWattsByScope[budget.scope] ?? budget.currentWatts;
      results.push(this.updateCurrentWatts(budget.id, watts));
    }
    return results;
  }
}
