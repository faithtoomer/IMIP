import type { ExecutionRecord, TimeWindow } from './types.js';

export interface TimeGraphSnapshot {
  generatedAt: string;
  windows: TimeWindow[];
}

/**
 * §22 — Architect's Enhancement: the Institutional Time Graph (ITG), built
 * in full per explicit direction (the ambiguous "reserve from the
 * beginning" wording was clarified before implementation — build now,
 * matching IDA's Knowledge Model, ISMA's Topology, and IOLA's Observability
 * Graph, not Phase 05's deferred EICE).
 *
 * Models schedule dependencies, execution windows, maintenance windows, and
 * historical execution timelines as first-class, queryable concepts.
 * Pricing/opportunity windows have no real data source yet — Power and
 * Profitability Authority are both unimplemented — but the window
 * registration mechanism itself is real and fully functional, with zero
 * pricing/opportunity windows pre-populated: the same "real mechanism, some
 * producers exist (maintenance), others don't yet" posture as every other
 * reserved extension point in this platform.
 */
export class InstitutionalTimeGraph {
  private windows = new Map<string, TimeWindow>();

  constructor(
    private readonly dependenciesOf: (scheduleId: string) => string[],
    private readonly historyOf: (scheduleId: string) => ExecutionRecord[],
  ) {}

  registerWindow(window: TimeWindow): void {
    this.windows.set(window.windowId, window);
  }

  removeWindow(windowId: string): void {
    this.windows.delete(windowId);
  }

  activeWindowsAt(at: Date): TimeWindow[] {
    const ts = at.getTime();
    return [...this.windows.values()].filter(
      (window) => new Date(window.startsAt).getTime() <= ts && ts < new Date(window.endsAt).getTime(),
    );
  }

  /** Law 4/§11 — maintenance-type windows (and any window explicitly marked
   * `blocksExecution`) block scheduling; informational windows (e.g. a
   * pricing window with `blocksExecution: false`) don't. */
  isBlockedAt(at: Date): { blocked: boolean; reasons: string[] } {
    const blocking = this.activeWindowsAt(at).filter((window) => window.blocksExecution);
    return {
      blocked: blocking.length > 0,
      reasons: blocking.map((window) => `Blocked by "${window.label}" (${window.type}) window.`),
    };
  }

  dependencyChain(scheduleId: string): string[] {
    return this.dependenciesOf(scheduleId);
  }

  history(scheduleId: string): ExecutionRecord[] {
    return this.historyOf(scheduleId);
  }

  /** §22 example question: "why was this benchmark delayed?" */
  whyDelayed(scheduleId: string): string[] {
    const records = this.historyOf(scheduleId);
    return records[records.length - 1]?.delayReasons ?? [];
  }

  /** §22 example question: "which recurring jobs consistently miss their execution window?" */
  missedWindowRate(scheduleId: string): number {
    const records = this.historyOf(scheduleId);
    if (records.length === 0) return 0;
    const delayed = records.filter((record) => record.delayReasons.length > 0).length;
    return delayed / records.length;
  }

  describe(): TimeGraphSnapshot {
    return { generatedAt: new Date().toISOString(), windows: [...this.windows.values()] };
  }
}
