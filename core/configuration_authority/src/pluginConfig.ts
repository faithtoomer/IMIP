import type { ConfigEntry, ConfigValues, ValidationResult } from './types.js';
import type { ConfigurationRegistry } from './registry.js';
import { validateEntries } from './validate.js';

/**
 * §13 — plugins may declare configuration schemas but never own configuration
 * storage. Every plugin-declared entry is namespaced under plugins.<pluginId>.*
 * and owned by that plugin id, then validated and stored by the Configuration
 * Authority like any other entry.
 */
export interface PluginConfigSchema {
  pluginId: string;
  entries: ConfigEntry[];
}

export function registerPluginSchema(registry: ConfigurationRegistry, schema: PluginConfigSchema): void {
  const prefix = `plugins.${schema.pluginId}.`;

  for (const entry of schema.entries) {
    if (!entry.id.startsWith(prefix)) {
      throw new Error(`Plugin "${schema.pluginId}" may only declare keys under "${prefix}*", got "${entry.id}".`);
    }
    if (entry.category !== 'plugins') {
      throw new Error(`Plugin "${schema.pluginId}" configuration entries must use category "plugins", got "${entry.category}".`);
    }
    if (entry.owner !== schema.pluginId) {
      throw new Error(`Plugin "${schema.pluginId}" configuration entries must declare owner "${schema.pluginId}", got "${entry.owner}".`);
    }
  }

  registry.registerAll(schema.entries);
}

/** Plugins receive validated configuration only (§13) — never raw, unvalidated input. */
export function validatePluginConfig(registry: ConfigurationRegistry, pluginId: string, values: ConfigValues): ValidationResult {
  const prefix = `plugins.${pluginId}.`;
  const entries = registry.all().filter((entry) => entry.id.startsWith(prefix));
  return validateEntries(entries, values);
}
