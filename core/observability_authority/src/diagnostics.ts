import type { StructuredLogRecord } from './types.js';

/** §11 — a real, log-driven query surface, not a separate fabricated data
 * source. Every method filters the actual accumulated log records; nothing
 * here is simulated. */
export class DiagnosticsEngine {
  constructor(private readonly source: () => readonly StructuredLogRecord[]) {}

  componentDiagnostics(component: string): StructuredLogRecord[] {
    return this.source().filter((record) => record.component === component);
  }

  failureDiagnostics(): StructuredLogRecord[] {
    return this.source().filter((record) => record.severity === 'error' || record.severity === 'critical');
  }

  startupDiagnostics(): StructuredLogRecord[] {
    return this.source().filter((record) => record.category === 'runtime' && /start|boot/i.test(record.operation));
  }

  recoveryDiagnostics(): StructuredLogRecord[] {
    return this.source().filter((record) => /recover/i.test(record.operation));
  }

  healthDiagnostics(): StructuredLogRecord[] {
    return this.source().filter((record) => record.category === 'health');
  }

  /** §15 — full explanation of a correlation chain, in order. */
  explain(correlationId: string): StructuredLogRecord[] {
    return this.source()
      .filter((record) => record.correlationId === correlationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}
