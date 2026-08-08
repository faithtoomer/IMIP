import { describe, expect, it } from 'vitest';
import { RuntimeGovernanceBoard } from '../src/governanceBoard.js';

describe('RuntimeGovernanceBoard (§22, Architect\'s Enhancement)', () => {
  it('ensure() creates a default record for a new component', () => {
    const board = new RuntimeGovernanceBoard();
    const record = board.ensure('A');
    expect(record.lifecycleState).toBe('unregistered');
    expect(record.operationalEligible).toBe(false);
  });

  it('tracks the lifecycle state transitions', () => {
    const board = new RuntimeGovernanceBoard();
    board.markCreated('A');
    expect(board.get('A')?.lifecycleState).toBe('created');
    board.markInitializing('A');
    expect(board.get('A')?.lifecycleState).toBe('initializing');
    board.markInitialized('A', '2026-01-01T00:00:00.000Z');
    expect(board.get('A')?.lifecycleState).toBe('initialized');
    expect(board.get('A')?.lastSuccessfulInitialization).toBe('2026-01-01T00:00:00.000Z');
  });

  it('markFailed() records the failure and clears operational eligibility', () => {
    const board = new RuntimeGovernanceBoard();
    // operationalEligible is (re)computed by updateCertification() from whatever
    // readiness/health are current at that moment — so it must be called last.
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'healthy', reasons: [] });
    board.updateCertification('A', 'certified');
    expect(board.get('A')?.operationalEligible).toBe(true);

    board.markFailed('A', 'boom', '2026-01-01T00:00:00.000Z');
    expect(board.get('A')?.operationalEligible).toBe(false);
    expect(board.get('A')?.lastFailure).toEqual({ timestamp: '2026-01-01T00:00:00.000Z', message: 'boom' });
  });

  it('operationalEligible requires certified + ready + not faulted, all three', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'healthy', reasons: [] });
    board.updateCertification('A', 'certified');
    expect(board.get('A')?.operationalEligible).toBe(true);

    board.updateHealth('A', { status: 'faulted', reasons: ['x'] });
    board.updateCertification('A', 'certified'); // recompute with new health
    expect(board.get('A')?.operationalEligible).toBe(false);
  });

  it('whyUnavailable() explains a missing-dependency block', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateDependencyStatus('A', false, ['B']);
    expect(board.whyUnavailable('A')).toContain('Missing dependencies: B.');
  });

  it('whyUnavailable() returns a not-registered message for an unknown component', () => {
    const board = new RuntimeGovernanceBoard();
    expect(board.whyUnavailable('Ghost')[0]).toMatch(/not registered/);
  });

  it('whyUnavailable() returns [] once a component is operationally eligible', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'healthy', reasons: [] });
    board.updateCertification('A', 'certified');
    expect(board.whyUnavailable('A')).toEqual([]);
  });

  it('blockingComponents() lists everything not operationally eligible, excluding shut-down components', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'healthy', reasons: [] });
    board.updateCertification('A', 'certified');
    board.ensure('B'); // never certified
    board.ensure('C');
    board.markShutdown('C');

    expect(board.blockingComponents().sort()).toEqual(['B']);
  });

  it('degradedComponents() lists operationally eligible components with degraded health', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'degraded', reasons: ['minor issue'] });
    board.updateCertification('A', 'certified');
    expect(board.degradedComponents()).toEqual(['A']);
  });

  it('recordRestart() increments restartCount', () => {
    const board = new RuntimeGovernanceBoard();
    board.recordRestart('A');
    board.recordRestart('A');
    expect(board.get('A')?.restartCount).toBe(2);
  });
});
