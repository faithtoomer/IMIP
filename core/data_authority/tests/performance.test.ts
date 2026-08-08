import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import { WIDGET_SCHEMA } from './testHelpers.js';

/** §15/§18 — lightweight performance smoke test, not a benchmarking suite. */
describe('performance smoke tests', () => {
  it('writes and reads 500 records well under 1s', () => {
    const ida = new DataAuthority();
    ida.registerDomainSchema(WIDGET_SCHEMA);

    const start = performance.now();
    for (let i = 0; i < 500; i += 1) {
      ida.create('benchmark-results', { name: `item-${i}`, value: i }, 'X');
    }
    for (let i = 0; i < 500; i += 1) {
      ida.find('benchmark-results', { filters: [{ field: 'value', op: 'eq', value: i }] });
    }
    expect(performance.now() - start).toBeLessThan(1000);
    expect(ida.count('benchmark-results')).toBe(500);
  });

  it('a 100-record transaction commits well under 200ms', () => {
    const ida = new DataAuthority();
    ida.registerDomainSchema(WIDGET_SCHEMA);

    const start = performance.now();
    ida.transaction(() => {
      for (let i = 0; i < 100; i += 1) {
        ida.create('benchmark-results', { name: `tx-item-${i}`, value: i }, 'X');
      }
    });
    expect(performance.now() - start).toBeLessThan(200);
  });
});
