import { describe, expect, it } from 'vitest';
import { DependencyGraph } from '../src/dependencyGraph.js';
import { CircularDependencyError, DuplicateComponentError, MissingDependencyError } from '../src/errors.js';
import { makeComponent } from './testHelpers.js';

describe('DependencyGraph (§8)', () => {
  it('rejects a duplicate component name', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'A' }));
    expect(() => graph.register(makeComponent({ name: 'A' }))).toThrow(DuplicateComponentError);
  });

  it('startupOrder() respects dependency ordering', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'C', dependencies: ['B'] }));
    graph.register(makeComponent({ name: 'A', dependencies: [] }));
    graph.register(makeComponent({ name: 'B', dependencies: ['A'] }));

    const order = graph.startupOrder();
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
  });

  it('shutdownOrder() is the exact reverse of startupOrder()', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'A' }));
    graph.register(makeComponent({ name: 'B', dependencies: ['A'] }));

    expect(graph.shutdownOrder()).toEqual([...graph.startupOrder()].reverse());
  });

  it('throws MissingDependencyError for an unregistered dependency', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'A', dependencies: ['Ghost'] }));
    expect(() => graph.startupOrder()).toThrow(MissingDependencyError);
  });

  it('throws CircularDependencyError for a direct cycle', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'A', dependencies: ['B'] }));
    graph.register(makeComponent({ name: 'B', dependencies: ['A'] }));
    expect(() => graph.startupOrder()).toThrow(CircularDependencyError);
  });

  it('throws CircularDependencyError for an indirect cycle', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'A', dependencies: ['C'] }));
    graph.register(makeComponent({ name: 'B', dependencies: ['A'] }));
    graph.register(makeComponent({ name: 'C', dependencies: ['B'] }));
    expect(() => graph.startupOrder()).toThrow(CircularDependencyError);
  });

  it('startupOrder() is deterministic across repeated calls', () => {
    const graph = new DependencyGraph();
    graph.register(makeComponent({ name: 'A' }));
    graph.register(makeComponent({ name: 'B', dependencies: ['A'] }));
    graph.register(makeComponent({ name: 'C', dependencies: ['A'] }));

    expect(graph.startupOrder()).toEqual(graph.startupOrder());
  });
});
