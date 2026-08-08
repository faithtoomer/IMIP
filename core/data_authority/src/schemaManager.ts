import type { DataDomain, DomainSchema } from './types.js';
import { DuplicateSchemaError, UnknownDomainError } from './errors.js';

/**
 * §9 — schema governance. Type/required validation lives here; uniqueness and
 * cross-reference validation (§11) are DataAuthority's job, since they need
 * to query existing records, not just inspect the candidate one.
 */
export class SchemaManager {
  private schemas = new Map<DataDomain, DomainSchema>();

  register(schema: DomainSchema): void {
    if (this.schemas.has(schema.domain)) {
      throw new DuplicateSchemaError(schema.domain);
    }
    this.schemas.set(schema.domain, schema);
  }

  get(domain: DataDomain): DomainSchema {
    const schema = this.schemas.get(domain);
    if (!schema) throw new UnknownDomainError(domain);
    return schema;
  }

  has(domain: DataDomain): boolean {
    return this.schemas.has(domain);
  }

  all(): DomainSchema[] {
    return [...this.schemas.values()];
  }

  /** §11 — schema/type validation. */
  validate(domain: DataDomain, data: Record<string, unknown>): string[] {
    const schema = this.get(domain);
    const errors: string[] = [];

    for (const field of schema.fields) {
      const value = data[field.name];

      if (field.required && (value === undefined || value === null)) {
        errors.push(`"${field.name}" is required.`);
        continue;
      }
      if (value === undefined || value === null) continue;

      if (field.type === 'json') continue; // any JSON-serializable value is acceptable
      const expectedType = field.type === 'timestamp' ? 'string' : field.type;
      const actualType = typeof value;
      if (actualType !== expectedType) {
        errors.push(`"${field.name}" expected type ${field.type}, got ${actualType}.`);
      }
    }

    if (schema.validate) {
      errors.push(...schema.validate(data));
    }

    return errors;
  }
}
