import { existsSync, readFileSync } from 'node:fs';
import type { ConfigValues, ConfigSourceName } from './types.js';
import type { ConfigurationRegistry } from './registry.js';
import { ConfigurationSyntaxError } from './errors.js';

/**
 * Deterministic source precedence (PHASE-02 §9):
 *   1. Command-line arguments
 *   2. Environment variables
 *   3. Secure secrets store
 *   4. Configuration file
 *   5. Built-in defaults (registry defaultValue)
 */
export interface SecretsProvider {
  get(id: string): unknown | undefined;
}

/** Default provider: no secrets backend wired up yet. Explicit no-op, never fabricates a value. */
export class NoopSecretsProvider implements SecretsProvider {
  get(): undefined {
    return undefined;
  }
}

export interface ResolvedValue {
  id: string;
  value: unknown;
  source: ConfigSourceName;
}

export interface LoadOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  filePath?: string;
  secretsProvider?: SecretsProvider;
}

function coerce(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseCliArgs(argv: string[]): ConfigValues {
  const out: ConfigValues = {};
  for (const arg of argv) {
    const match = /^--([a-zA-Z0-9_.]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = coerce(match[2]);
  }
  return out;
}

function envKeyToConfigId(registry: ConfigurationRegistry, envKey: string): string | undefined {
  if (!envKey.startsWith('IMIP_')) return undefined;
  const candidate = envKey.slice('IMIP_'.length).toLowerCase().replace(/_/g, '.');
  return registry.get(candidate) ? candidate : undefined;
}

function parseEnv(registry: ConfigurationRegistry, env: NodeJS.ProcessEnv): ConfigValues {
  const out: ConfigValues = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    const id = envKeyToConfigId(registry, key);
    if (id !== undefined) out[id] = coerce(value);
  }
  return out;
}

/** Stage 1 (Syntax): a malformed config file is a syntax failure, not a thrown crash. */
function loadFile(filePath: string | undefined): ConfigValues {
  if (!filePath || !existsSync(filePath)) return {};
  const raw = readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw) as ConfigValues;
  } catch (error) {
    throw new ConfigurationSyntaxError(
      `Failed to parse configuration file "${filePath}" as JSON: ${(error as Error).message}`,
      filePath,
    );
  }
}

function loadSecrets(registry: ConfigurationRegistry, provider: SecretsProvider): ConfigValues {
  const out: ConfigValues = {};
  for (const entry of registry.all()) {
    if (entry.securityClassification === 'public' || entry.securityClassification === 'internal') continue;
    const value = provider.get(entry.id);
    if (value !== undefined) out[entry.id] = value;
  }
  return out;
}

export function resolveConfigValues(
  registry: ConfigurationRegistry,
  options: LoadOptions = {},
): { values: ConfigValues; resolution: ResolvedValue[] } {
  const cli = parseCliArgs(options.argv ?? process.argv.slice(2));
  const env = parseEnv(registry, options.env ?? process.env);
  const secrets = loadSecrets(registry, options.secretsProvider ?? new NoopSecretsProvider());
  const file = loadFile(options.filePath);

  const values: ConfigValues = {};
  const resolution: ResolvedValue[] = [];

  for (const entry of registry.all()) {
    let value: unknown;
    let source: ConfigSourceName;

    if (Object.prototype.hasOwnProperty.call(cli, entry.id)) {
      value = cli[entry.id];
      source = 'cli';
    } else if (Object.prototype.hasOwnProperty.call(env, entry.id)) {
      value = env[entry.id];
      source = 'env';
    } else if (Object.prototype.hasOwnProperty.call(secrets, entry.id)) {
      value = secrets[entry.id];
      source = 'secrets';
    } else if (Object.prototype.hasOwnProperty.call(file, entry.id)) {
      value = file[entry.id];
      source = 'file';
    } else {
      value = entry.defaultValue;
      source = 'default';
    }

    values[entry.id] = value;
    resolution.push({ id: entry.id, value, source });
  }

  return { values, resolution };
}
