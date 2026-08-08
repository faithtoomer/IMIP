import { describe, expect, it } from 'vitest';
import { ScheduleDependencyGraph } from '../src/dependencyGraph.js';
import { CircularScheduleDependencyError } from '../src/errors.js';

describe('ScheduleDependencyGraph (§9/§16 — cycle detection)', () => {
  it('registers acyclic dependencies without error', () => {
    const graph = new ScheduleDependencyGraph();
    graph.register('A', []);
    graph.register('B', ['A']);
    expect(graph.dependenciesOf('B')).toEqual(['A']);
  });

  it('detects a direct two-node cycle', () => {
    const graph = new ScheduleDependencyGraph();
    graph.register('A', ['B']);
    expect(() => graph.register('B', ['A'])).toThrow(CircularScheduleDependencyError);
  });

  it('detects a longer transitive cycle', () => {
    const graph = new ScheduleDependencyGraph();
    graph.register('A', ['B']);
    graph.register('B', ['C']);
    expect(() => graph.register('C', ['A'])).toThrow(CircularScheduleDependencyError);
  });

  it('a failed cycle-introducing registration does not corrupt the graph', () => {
    const graph = new ScheduleDependencyGraph();
    graph.register('A', ['B']);
    try {
      graph.register('B', ['A']);
    } catch {
      // expected
    }
    expect(graph.dependenciesOf('B')).toEqual([]);
  });

  it('remove() drops a schedule from the graph', () => {
    const graph = new ScheduleDependencyGraph();
    graph.register('A', []);
    graph.remove('A');
    expect(graph.dependenciesOf('A')).toEqual([]);
  });

  it('dependenciesOf() returns an empty array for an unregistered schedule', () => {
    const graph = new ScheduleDependencyGraph();
    expect(graph.dependenciesOf('nonexistent')).toEqual([]);
  });
});
