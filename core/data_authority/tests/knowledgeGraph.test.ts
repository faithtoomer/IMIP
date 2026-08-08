import { describe, expect, it } from 'vitest';
import { DataAuthority } from '../src/DataAuthority.js';
import type { DataDomain } from '../src/types.js';

describe('KnowledgeGraph — the Institutional Knowledge Model (§22)', () => {
  it('links two entities and queries the relationship from both directions', () => {
    const ida = new DataAuthority();
    ida.knowledge.link('hardware-inventory', 'gpu-1', 'has-capability', 'capability-registry', 'gpu-mining');

    const fromGpu = ida.knowledge.relatedFrom('hardware-inventory', 'gpu-1');
    expect(fromGpu).toHaveLength(1);
    expect(fromGpu[0]).toMatchObject({ toDomain: 'capability-registry', toId: 'gpu-mining', relationshipType: 'has-capability' });

    const toCapability = ida.knowledge.relatedTo('capability-registry', 'gpu-mining');
    expect(toCapability).toHaveLength(1);
    expect(toCapability[0]).toMatchObject({ fromDomain: 'hardware-inventory', fromId: 'gpu-1' });
  });

  it('supports multiple relationship types between the same or different entities', () => {
    const ida = new DataAuthority();
    ida.knowledge.link('benchmark-results', 'bench-1', 'measures', 'hardware-inventory', 'gpu-1');
    ida.knowledge.link('benchmark-results', 'bench-1', 'superseded-by', 'benchmark-results', 'bench-2');

    expect(ida.knowledge.relatedFrom('benchmark-results', 'bench-1')).toHaveLength(2);
    expect(ida.knowledge.relatedFrom('benchmark-results', 'bench-1', 'measures')).toHaveLength(1);
    expect(ida.knowledge.relatedFrom('benchmark-results', 'bench-1', 'superseded-by')[0].toId).toBe('bench-2');
  });

  it('demonstrates the spec\'s example relationships generically (no hardcoded pairing logic)', () => {
    const ida = new DataAuthority();
    const examples: [DataDomain, string, string, DataDomain, string][] = [
      ['hardware-inventory', 'gpu-1', 'has-capability', 'capability-registry', 'gpu-mining'],
      ['plugin-registry', 'monero-plugin', 'provides-capability', 'capability-registry', 'cpu-mining'],
      ['decision-history', 'decision-1', 'explained-by', 'explainability-records', 'record-1'],
      ['mining-sessions', 'session-1', 'yields', 'profitability-history', 'profit-1'],
    ];
    for (const [fromDomain, fromId, type, toDomain, toId] of examples) {
      ida.knowledge.link(fromDomain, fromId, type, toDomain, toId);
    }
    expect(ida.knowledge.relatedFrom('decision-history', 'decision-1', 'explained-by')).toHaveLength(1);
  });
});
