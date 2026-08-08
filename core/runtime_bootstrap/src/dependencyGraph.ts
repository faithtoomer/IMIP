import type { ComponentDefinition } from './types.js';
import { CircularDependencyError, DuplicateComponentError, MissingDependencyError } from './errors.js';

/**
 * §8 — dependency management. Registration order is irrelevant; the graph
 * itself determines startup order (topological) and shutdown order (its
 * reverse) — Law 4, deterministic startup.
 */
export class DependencyGraph {
  // `any` here is intentional: the graph stores a heterogeneous set of
  // ComponentDefinition<T> for different concrete T, and only ever touches
  // `name`/`dependencies` generically — it never calls create/initialize/
  // checkReadiness/checkHealth/shutdown itself, so the strict per-T typing
  // callers get from adapters.ts's factory functions is preserved at the
  // call site without requiring casts here.
  private definitions = new Map<string, ComponentDefinition<any>>();

  register(definition: ComponentDefinition<any>): void {
    if (this.definitions.has(definition.name)) {
      throw new DuplicateComponentError(definition.name);
    }
    this.definitions.set(definition.name, definition);
  }

  get(name: string): ComponentDefinition<any> | undefined {
    return this.definitions.get(name);
  }

  all(): ComponentDefinition<any>[] {
    return [...this.definitions.values()];
  }

  names(): string[] {
    return [...this.definitions.keys()];
  }

  /** Validates every dependency is itself registered. Call before ordering. */
  assertDependenciesSatisfied(): void {
    for (const definition of this.definitions.values()) {
      const missing = definition.dependencies.filter((dep) => !this.definitions.has(dep));
      if (missing.length > 0) {
        throw new MissingDependencyError(definition.name, missing);
      }
    }
  }

  /** Deterministic topological order (Kahn's algorithm, stable by registration
   * order among ties) — the startup order. Detects circular dependencies. */
  startupOrder(): string[] {
    this.assertDependenciesSatisfied();

    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const name of this.definitions.keys()) {
      inDegree.set(name, 0);
      dependents.set(name, []);
    }
    for (const definition of this.definitions.values()) {
      inDegree.set(definition.name, definition.dependencies.length);
      for (const dep of definition.dependencies) {
        dependents.get(dep)!.push(definition.name);
      }
    }

    const ready = [...this.definitions.keys()].filter((name) => inDegree.get(name) === 0);
    const order: string[] = [];

    while (ready.length > 0) {
      const name = ready.shift()!;
      order.push(name);
      for (const dependent of dependents.get(name) ?? []) {
        const remaining = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, remaining);
        if (remaining === 0) ready.push(dependent);
      }
    }

    if (order.length !== this.definitions.size) {
      const unresolved = [...this.definitions.keys()].filter((name) => !order.includes(name));
      throw new CircularDependencyError(unresolved);
    }

    return order;
  }

  /** Reverse of startup order — Law: shutdown follows reverse dependency order. */
  shutdownOrder(): string[] {
    return [...this.startupOrder()].reverse();
  }
}
