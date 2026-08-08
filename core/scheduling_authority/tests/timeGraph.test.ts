import { describe, expect, it } from 'vitest';
import { InstitutionalTimeGraph } from '../src/timeGraph.js';
import type { ExecutionRecord, TimeWindow } from '../src/types.js';

describe('InstitutionalTimeGraph (§22 — the Institutional Time Graph)', () => {
  it('activeWindowsAt() finds a window covering the given instant', () => {
    const graph = new InstitutionalTimeGraph(() => [], () => []);
    const window: TimeWindow = {
      windowId: 'w1',
      type: 'maintenance',
      label: 'Nightly maintenance',
      startsAt: '2026-08-08T02:00:00.000Z',
      endsAt: '2026-08-08T04:00:00.000Z',
      source: 'ISOA',
      blocksExecution: true,
    };
    graph.registerWindow(window);
    expect(graph.activeWindowsAt(new Date('2026-08-08T03:00:00.000Z'))).toHaveLength(1);
    expect(graph.activeWindowsAt(new Date('2026-08-08T05:00:00.000Z'))).toHaveLength(0);
  });

  it('isBlockedAt() blocks only for windows with blocksExecution=true', () => {
    const graph = new InstitutionalTimeGraph(() => [], () => []);
    graph.registerWindow({
      windowId: 'pricing-1',
      type: 'pricing',
      label: 'Peak electricity pricing',
      startsAt: '2026-08-08T00:00:00.000Z',
      endsAt: '2026-08-08T23:59:59.000Z',
      source: 'Power Authority (future)',
      blocksExecution: false,
    });
    expect(graph.isBlockedAt(new Date('2026-08-08T12:00:00.000Z')).blocked).toBe(false);

    graph.registerWindow({
      windowId: 'maint-1',
      type: 'maintenance',
      label: 'Emergency maintenance',
      startsAt: '2026-08-08T00:00:00.000Z',
      endsAt: '2026-08-08T23:59:59.000Z',
      source: 'ISOA',
      blocksExecution: true,
    });
    const result = graph.isBlockedAt(new Date('2026-08-08T12:00:00.000Z'));
    expect(result.blocked).toBe(true);
    expect(result.reasons[0]).toContain('Emergency maintenance');
  });

  it('removeWindow() deregisters a window', () => {
    const graph = new InstitutionalTimeGraph(() => [], () => []);
    graph.registerWindow({
      windowId: 'w1',
      type: 'maintenance',
      label: 'x',
      startsAt: '2026-08-08T00:00:00.000Z',
      endsAt: '2026-08-08T23:59:59.000Z',
      source: 'ISOA',
      blocksExecution: true,
    });
    graph.removeWindow('w1');
    expect(graph.activeWindowsAt(new Date('2026-08-08T12:00:00.000Z'))).toHaveLength(0);
  });

  it('dependencyChain() and history() delegate to the injected sources', () => {
    const graph = new InstitutionalTimeGraph(
      (scheduleId) => (scheduleId === 's1' ? ['dep-1'] : []),
      (scheduleId) => (scheduleId === 's1' ? [{ executionId: 'e1' } as ExecutionRecord] : []),
    );
    expect(graph.dependencyChain('s1')).toEqual(['dep-1']);
    expect(graph.history('s1')).toHaveLength(1);
  });

  it('whyDelayed() returns the most recent execution\'s delay reasons', () => {
    const records: ExecutionRecord[] = [
      { executionId: 'e1', scheduleId: 's1', attempt: 0, startedAt: '', result: 'skipped', delayReasons: ['old reason'] },
      { executionId: 'e2', scheduleId: 's1', attempt: 0, startedAt: '', result: 'skipped', delayReasons: ['blocked by maintenance'] },
    ];
    const graph = new InstitutionalTimeGraph(() => [], () => records);
    expect(graph.whyDelayed('s1')).toEqual(['blocked by maintenance']);
  });

  it('missedWindowRate() computes the fraction of executions that were delayed', () => {
    const records: ExecutionRecord[] = [
      { executionId: 'e1', scheduleId: 's1', attempt: 1, startedAt: '', result: 'success', delayReasons: [] },
      { executionId: 'e2', scheduleId: 's1', attempt: 0, startedAt: '', result: 'skipped', delayReasons: ['blocked'] },
    ];
    const graph = new InstitutionalTimeGraph(() => [], () => records);
    expect(graph.missedWindowRate('s1')).toBe(0.5);
  });

  it('missedWindowRate() is 0 for a schedule with no history', () => {
    const graph = new InstitutionalTimeGraph(() => [], () => []);
    expect(graph.missedWindowRate('s1')).toBe(0);
  });

  it('describe() returns every registered window', () => {
    const graph = new InstitutionalTimeGraph(() => [], () => []);
    graph.registerWindow({
      windowId: 'w1',
      type: 'opportunity',
      label: 'x',
      startsAt: '2026-08-08T00:00:00.000Z',
      endsAt: '2026-08-08T23:59:59.000Z',
      source: 'Profitability Authority (future)',
      blocksExecution: false,
    });
    expect(graph.describe().windows).toHaveLength(1);
  });
});
