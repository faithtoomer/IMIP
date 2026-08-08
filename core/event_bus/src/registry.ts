import type { EventCategory, EventDefinition } from './types.js';
import { DuplicateEventDefinitionError, UnregisteredEventError } from './errors.js';

/** §7 — Event Registry, the SSOT for event *type* definitions (not instances).
 * Law 1: this is the only place event types are ever defined. */
export class EventRegistry {
  private definitions = new Map<string, EventDefinition>();

  register(definition: EventDefinition): void {
    if (this.definitions.has(definition.name)) {
      throw new DuplicateEventDefinitionError(definition.name);
    }
    this.definitions.set(definition.name, definition);
  }

  registerAll(definitions: EventDefinition[]): void {
    for (const definition of definitions) this.register(definition);
  }

  get(name: string): EventDefinition | undefined {
    return this.definitions.get(name);
  }

  require(name: string): EventDefinition {
    const definition = this.definitions.get(name);
    if (!definition) throw new UnregisteredEventError(name);
    return definition;
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  byCategory(category: EventCategory): EventDefinition[] {
    return [...this.definitions.values()].filter((d) => d.category === category);
  }

  all(): EventDefinition[] {
    return [...this.definitions.values()];
  }
}
