import { describe, expect, it } from 'vitest';
import { certifyRuntime } from '../src/certification.js';
import { RuntimeGovernanceBoard } from '../src/governanceBoard.js';
import { makeComponent } from './testHelpers.js';

describe('certifyRuntime (§10)', () => {
  it('certifies when every component is ready and not faulted', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'healthy', reasons: [] });

    const result = certifyRuntime([makeComponent({ name: 'A' })], board);
    expect(result.certified).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(board.get('A')?.certificationStatus).toBe('certified');
  });

  it('blocks certification when a component is not ready', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: false, reasons: ['not loaded'] });
    board.updateHealth('A', { status: 'unknown', reasons: [] });

    const result = certifyRuntime([makeComponent({ name: 'A' })], board);
    expect(result.certified).toBe(false);
    expect(result.reasons[0]).toMatch(/not ready/);
    expect(board.get('A')?.certificationStatus).toBe('blocked');
  });

  it('blocks certification when a component is faulted, even if ready', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'faulted', reasons: ['corrupted state'] });

    const result = certifyRuntime([makeComponent({ name: 'A' })], board);
    expect(result.certified).toBe(false);
    expect(result.reasons[0]).toMatch(/faulted/);
  });

  it('does NOT block certification for degraded (only faulted) health', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'degraded', reasons: ['minor'] });

    const result = certifyRuntime([makeComponent({ name: 'A' })], board);
    expect(result.certified).toBe(true);
  });

  it('reports componentResults for every checked component', () => {
    const board = new RuntimeGovernanceBoard();
    board.updateReadiness('A', { ready: true, reasons: [] });
    board.updateHealth('A', { status: 'healthy', reasons: [] });
    board.updateReadiness('B', { ready: false, reasons: ['x'] });
    board.updateHealth('B', { status: 'unknown', reasons: [] });

    const result = certifyRuntime([makeComponent({ name: 'A' }), makeComponent({ name: 'B' })], board);
    expect(result.componentResults).toHaveLength(2);
    expect(result.componentResults.find((r) => r.name === 'A')?.blocking).toBe(false);
    expect(result.componentResults.find((r) => r.name === 'B')?.blocking).toBe(true);
  });

  it('an empty component list certifies trivially (nothing to block on)', () => {
    const board = new RuntimeGovernanceBoard();
    const result = certifyRuntime([], board);
    expect(result.certified).toBe(true);
  });
});
