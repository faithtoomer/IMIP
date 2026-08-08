import { DuplicateLogSchemaError, UnregisteredLogSchemaError } from './errors.js';
import type { LogSchemaDefinition } from './types.js';

function key(category: string, operation: string): string {
  return `${category}::${operation}`;
}

/** §Law 2 — every log entry's (category, operation) pair must be registered
 * before it can be logged. Mirrors the Event Bus's EventRegistry pattern:
 * IOLA doesn't pre-populate schemas on behalf of other authorities — each
 * authority registers its own, the same "real mechanism, zero registrations
 * yet" posture used throughout this platform. */
export class LogSchemaRegistry {
  private schemas = new Map<string, LogSchemaDefinition>();

  register(schema: LogSchemaDefinition): void {
    const k = key(schema.category, schema.operation);
    if (this.schemas.has(k)) throw new DuplicateLogSchemaError(schema.category, schema.operation);
    this.schemas.set(k, schema);
  }

  require(category: string, operation: string): LogSchemaDefinition {
    const schema = this.schemas.get(key(category, operation));
    if (!schema) throw new UnregisteredLogSchemaError(category, operation);
    return schema;
  }

  get(category: string, operation: string): LogSchemaDefinition | undefined {
    return this.schemas.get(key(category, operation));
  }

  all(): LogSchemaDefinition[] {
    return [...this.schemas.values()];
  }
}
