import type { PowerBudgetStatus, PowerProfile, PowerRecommendation } from './types.js';

/** Structurally immutable — no update or delete method exposed, matching
 * every other audit trail in this platform. */
export class PowerAuditTrail {
  private profileSnapshots: PowerProfile[] = [];
  private budgetSnapshots: PowerBudgetStatus[] = [];
  private recommendationSnapshots: PowerRecommendation[] = [];

  recordProfile(profile: PowerProfile): void {
    this.profileSnapshots.push(Object.freeze({ ...profile }));
  }

  recordBudgetStatus(status: PowerBudgetStatus): void {
    this.budgetSnapshots.push(Object.freeze({ ...status }));
  }

  recordRecommendation(recommendation: PowerRecommendation): void {
    this.recommendationSnapshots.push(Object.freeze({ ...recommendation }));
  }

  profileHistory(deviceId: string): PowerProfile[] {
    return this.profileSnapshots.filter((snapshot) => snapshot.deviceId === deviceId);
  }

  budgetHistory(budgetId: string): PowerBudgetStatus[] {
    return this.budgetSnapshots.filter((snapshot) => snapshot.budgetId === budgetId);
  }

  recommendationHistory(deviceId: string): PowerRecommendation[] {
    return this.recommendationSnapshots.filter((snapshot) => snapshot.deviceId === deviceId);
  }

  allProfileSnapshots(): readonly PowerProfile[] {
    return this.profileSnapshots;
  }

  allBudgetSnapshots(): readonly PowerBudgetStatus[] {
    return this.budgetSnapshots;
  }

  allRecommendationSnapshots(): readonly PowerRecommendation[] {
    return this.recommendationSnapshots;
  }
}
