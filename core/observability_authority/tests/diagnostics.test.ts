import { describe, expect, it } from 'vitest';
import { DiagnosticsEngine } from '../src/diagnostics.js';
import type { StructuredLogRecord } from '../src/types.js';

function makeRecord(overrides: Partial<StructuredLogRecord> = {}): StructuredLogRecord {
  return {
    logId: 'log-1',
    timestamp: '2026-08-08T12:00:00.000Z',
    severity: 'information',
    category: 'runtime',
    authority: 'Test',
    operation: 'test-op',
    message: 'x',
    version: '1.0.0',
    ...overrides,
  };
}

describe('DiagnosticsEngine (§11 — real, log-driven diagnostics)', () => {
  const records: StructuredLogRecord[] = [
    makeRecord({ logId: '1', component: 'IRBLM', severity: 'error', operation: 'boot-started', category: 'runtime' }),
    makeRecord({ logId: '2', component: 'IHIS', severity: 'critical', operation: 'discover', category: 'hardware' }),
    makeRecord({ logId: '3', component: 'IRBLM', severity: 'information', category: 'health', operation: 'check' }),
    makeRecord({ logId: '4', operation: 'recovery-attempted', category: 'runtime' }),
  ];
  const engine = new DiagnosticsEngine(() => records);

  it('componentDiagnostics filters by component', () => {
    expect(engine.componentDiagnostics('IRBLM')).toHaveLength(2);
  });

  it('failureDiagnostics returns error and critical entries', () => {
    expect(engine.failureDiagnostics().map((r) => r.logId).sort()).toEqual(['1', '2']);
  });

  it('startupDiagnostics matches runtime category + start/boot operations', () => {
    expect(engine.startupDiagnostics().map((r) => r.logId)).toEqual(['1']);
  });

  it('recoveryDiagnostics matches "recover" in the operation name', () => {
    expect(engine.recoveryDiagnostics().map((r) => r.logId)).toEqual(['4']);
  });

  it('healthDiagnostics matches the health category', () => {
    expect(engine.healthDiagnostics().map((r) => r.logId)).toEqual(['3']);
  });

  it('explain() returns a correlation chain in chronological order', () => {
    const chained: StructuredLogRecord[] = [
      makeRecord({ logId: 'x', correlationId: 'c1', timestamp: '2026-08-08T12:00:02.000Z' }),
      makeRecord({ logId: 'y', correlationId: 'c1', timestamp: '2026-08-08T12:00:01.000Z' }),
    ];
    const chainEngine = new DiagnosticsEngine(() => chained);
    expect(chainEngine.explain('c1').map((r) => r.logId)).toEqual(['y', 'x']);
  });
});
