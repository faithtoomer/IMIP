import { CircularScheduleDependencyError } from './errors.js';

/** §9/§16 — cycle detection among schedule-to-schedule dependencies. Unlike
 * IRBLM's DependencyGraph (which topologically orders authorities for boot),
 * ISOA doesn't need a boot order — schedules become eligible independently,
 * gated by their dependencies' last execution outcome (see
 * SchedulingAuthority.checkEligibility) — so this only needs cycle
 * detection, not a full topological sort. */
export class ScheduleDependencyGraph {
  private dependencies = new Map<string, string[]>();

  register(scheduleId: string, dependsOn: string[]): void {
    this.dependencies.set(scheduleId, dependsOn);
    const cycle = this.findCycle();
    if (cycle) {
      this.dependencies.delete(scheduleId);
      throw new CircularScheduleDependencyError(cycle);
    }
  }

  remove(scheduleId: string): void {
    this.dependencies.delete(scheduleId);
  }

  dependenciesOf(scheduleId: string): string[] {
    return this.dependencies.get(scheduleId) ?? [];
  }

  private findCycle(): string[] | undefined {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    let cycle: string[] | undefined;

    const visit = (node: string, path: string[]): void => {
      if (cycle || visited.has(node)) return;
      if (visiting.has(node)) {
        cycle = [...path, node];
        return;
      }
      visiting.add(node);
      for (const dep of this.dependencies.get(node) ?? []) {
        visit(dep, [...path, node]);
        if (cycle) break;
      }
      visiting.delete(node);
      visited.add(node);
    };

    for (const node of this.dependencies.keys()) {
      visit(node, []);
      if (cycle) break;
    }
    return cycle;
  }
}
