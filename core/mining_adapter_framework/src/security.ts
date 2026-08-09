import type { MiningInstitutionalConfig } from './types.js';

/** Structural ISTA-compatible surface; IMAF never imports ISTA or stores secrets. */
export interface SecretRecordMetadata {
  secretId: string;
  category: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
export interface SecretProvider {
  storeSecret(secretId: string, category: string, value: string, componentId: string): SecretRecordMetadata;
  retrieveSecret(secretId: string, componentId: string): string;
  rotateSecret(secretId: string, newValue: string, componentId: string): SecretRecordMetadata;
}

const SENSITIVE_KEY = /(?:wallet|password|credential|secret|token|authorization|private.?key)/i;

/** Institutional configuration may reference secrets but can never carry their values. */
export function assertNoRawCredentials(config: MiningInstitutionalConfig): void {
  scan(config as unknown as Record<string, unknown>, 'config');
}
function scan(value: unknown, path: string): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) { value.forEach((item, index) => scan(item, `${path}[${index}]`)); return; }
  if (typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key) && !/secretId$/i.test(key) && item !== undefined) throw new Error(`Raw credential-bearing field ${path}.${key} is prohibited; use a SecretProvider reference.`);
    scan(item, `${path}.${key}`);
  }
}
/** Deep-copy and redact diagnostic/log structures without modifying backend output. */
export function redactSecrets<T>(value: T, knownSecrets: readonly string[] = []): T { return redact(value, knownSecrets) as T; }
function redact(value: unknown, knownSecrets: readonly string[]): unknown {
  if (typeof value === 'string') return knownSecrets.reduce((result, secret) => secret ? result.split(secret).join('[REDACTED]') : result, value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, knownSecrets));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(entry, knownSecrets)]));
  return value;
}
