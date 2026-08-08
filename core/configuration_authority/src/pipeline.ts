import type { ConfigValues, PipelineResult, ValidationError, ValidationStageResult } from './types.js';
import type { ConfigurationRegistry } from './registry.js';
import type { CompatibilityRegistry } from './compatibility.js';

export interface PipelineContext {
  /** Set when source resolution itself failed (stage 1, Syntax). Short-circuits remaining stages. */
  syntaxError?: ValidationError;
}

export interface PipelineCompatibility {
  hardware: CompatibilityRegistry;
  policy: CompatibilityRegistry;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value;
}

function valueOf(values: ConfigValues, id: string, defaultValue: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(values, id) ? values[id] : defaultValue;
}

/**
 * §10 — nine-stage validation pipeline, executed in order. Configuration
 * activates only if every stage succeeds. All stages run (rather than
 * stopping at the first failure) so a single call surfaces every problem at
 * once, per §18's "produce structured diagnostics." Each stage's error list
 * reflects exactly the checks that stage performs — no shared/overlapping
 * buckets.
 */
export function runValidationPipeline(
  registry: ConfigurationRegistry,
  values: ConfigValues,
  compatibility: PipelineCompatibility,
  context: PipelineContext = {},
): PipelineResult {
  const stages: ValidationStageResult[] = [];

  if (context.syntaxError) {
    stages.push({ name: 'syntax', errors: [context.syntaxError] });
    return { valid: false, errors: [context.syntaxError], stages };
  }
  stages.push({ name: 'syntax', errors: [] });

  // Stage 2 — Schema: every supplied key must be registered.
  const schemaErrors: ValidationError[] = [];
  for (const key of Object.keys(values)) {
    if (!registry.get(key)) {
      schemaErrors.push({ id: key, message: `Unknown configuration key "${key}" is not registered with ICMS.` });
    }
  }
  stages.push({ name: 'schema', errors: schemaErrors });

  const entries = registry.all();

  // Stage 3 — Type, and Stage 4 — Range are only meaningful for entries that pass
  // required/presence and type checks; entries that fail type are skipped from
  // range/cross-field to avoid cascading false positives.
  const typeErrors: ValidationError[] = [];
  const rangeErrors: ValidationError[] = [];
  const crossFieldErrors: ValidationError[] = [];
  const typeOk = new Set<string>();

  for (const entry of entries) {
    const raw = valueOf(values, entry.id, entry.defaultValue);

    if (entry.required && raw === undefined) {
      typeErrors.push({ id: entry.id, message: `Required configuration value "${entry.id}" is missing.` });
      continue;
    }
    if (raw === undefined || raw === null) {
      typeOk.add(entry.id);
      continue;
    }

    const actualType = typeOf(raw);

    if (entry.dataType !== 'enum' && actualType !== entry.dataType) {
      typeErrors.push({ id: entry.id, message: `"${entry.id}" expected type ${entry.dataType}, got ${actualType}.` });
      continue;
    }
    if (entry.dataType === 'enum' && entry.enumValues && !entry.enumValues.includes(raw)) {
      typeErrors.push({
        id: entry.id,
        message: `"${entry.id}" must be one of [${entry.enumValues.join(', ')}], got "${String(raw)}".`,
      });
      continue;
    }

    typeOk.add(entry.id);

    if (entry.dataType === 'number' && entry.range) {
      const n = raw as number;
      if (entry.range.min !== undefined && n < entry.range.min) {
        rangeErrors.push({ id: entry.id, message: `"${entry.id}" (${n}) is below minimum ${entry.range.min}.` });
      }
      if (entry.range.max !== undefined && n > entry.range.max) {
        rangeErrors.push({ id: entry.id, message: `"${entry.id}" (${n}) is above maximum ${entry.range.max}.` });
      }
    }

    if (entry.validate) {
      const message = entry.validate(raw, values);
      if (message) crossFieldErrors.push({ id: entry.id, message });
    }
  }

  stages.push({ name: 'type', errors: typeErrors });
  stages.push({ name: 'range', errors: rangeErrors });
  stages.push({ name: 'cross-field', errors: crossFieldErrors });

  // Stage 6 — Authority compatibility: every entry's owner must be a recognized authority.
  const pluginOwners = new Set(entries.filter((entry) => entry.category === 'plugins').map((entry) => entry.owner));
  const authorityErrors: ValidationError[] = [];
  for (const entry of entries) {
    const ownerRecognized = entry.owner === 'Configuration Authority' || pluginOwners.has(entry.owner);
    if (!ownerRecognized) {
      authorityErrors.push({
        id: entry.id,
        message: `"${entry.id}" declares unrecognized owner authority "${entry.owner}".`,
      });
    }
  }
  stages.push({ name: 'authority-compatibility', errors: authorityErrors });

  // Stage 7 — Plugin compatibility: plugin entries must be namespaced under their own plugin id.
  const pluginErrors: ValidationError[] = [];
  for (const entry of entries) {
    if (entry.category === 'plugins' && !entry.id.startsWith(`plugins.${entry.owner}.`)) {
      pluginErrors.push({
        id: entry.id,
        message: `"${entry.id}" is not namespaced under its owning plugin "${entry.owner}".`,
      });
    }
  }
  stages.push({ name: 'plugin-compatibility', errors: pluginErrors });

  // Stage 8 — Hardware compatibility (extension point; empty until a Hardware Authority registers rules).
  const hardwareErrors: ValidationError[] = [];
  for (const entry of entries) {
    if (!typeOk.has(entry.id)) continue;
    const message = compatibility.hardware.check(entry.id, valueOf(values, entry.id, entry.defaultValue), values);
    if (message) hardwareErrors.push({ id: entry.id, message });
  }
  stages.push({ name: 'hardware-compatibility', errors: hardwareErrors });

  // Stage 9 — Policy compatibility (extension point; empty until a Policy Authority registers rules).
  const policyErrors: ValidationError[] = [];
  for (const entry of entries) {
    if (!typeOk.has(entry.id)) continue;
    const message = compatibility.policy.check(entry.id, valueOf(values, entry.id, entry.defaultValue), values);
    if (message) policyErrors.push({ id: entry.id, message });
  }
  stages.push({ name: 'policy-compatibility', errors: policyErrors });

  const errors = stages.flatMap((stage) => stage.errors);
  return { valid: errors.length === 0, errors, stages };
}
