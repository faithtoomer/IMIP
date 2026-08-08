import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

function makeAuthority(): DataAuthority {
  const ida = new DataAuthority();
  ida.registerDomainSchema(WIDGET_SCHEMA);
  return ida;
}

describe('getMetrics() (§15 — Telemetry read surface)', () => {
  it('tracks write and read counts', () => {
    const ida = makeAuthority();
    ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    ida.get('benchmark-results', ida.find('benchmark-results', {})[0].id);

    const metrics = ida.getMetrics();
    expect(metrics.writeCount).toBeGreaterThanOrEqual(1);
    expect(metrics.readCount).toBeGreaterThanOrEqual(1);
  });

  it('tracks transaction count and average duration', () => {
    const ida = makeAuthority();
    ida.transaction(() => {
      ida.create('benchmark-results', { name: 'a', value: 1 }, 'X');
    });
    const metrics = ida.getMetrics();
    expect(metrics.transactionCount).toBe(1);
    expect(metrics.averageTransactionDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('storageBytes is 0 for an in-memory database', () => {
    const ida = makeAuthority();
    expect(ida.getMetrics().storageBytes).toBe(0);
  });

  it('averageQueryLatencyMs is 0 before any read has happened', () => {
    const ida = makeAuthority();
    expect(ida.getMetrics().averageQueryLatencyMs).toBe(0);
  });
});
