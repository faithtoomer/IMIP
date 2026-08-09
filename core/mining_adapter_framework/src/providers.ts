import type { SecretProvider } from './security.js';
export type { SecretProvider, SecretRecordMetadata } from './security.js';
/** A deliberately unavailable provider prevents accidental local secret storage in IMAF. */
export class UnavailableSecretProvider implements SecretProvider {
  storeSecret(): import('./security.js').SecretRecordMetadata { throw new Error('No SecretProvider was injected.'); }
  retrieveSecret(): string { throw new Error('No SecretProvider was injected.'); }
  rotateSecret(): import('./security.js').SecretRecordMetadata { throw new Error('No SecretProvider was injected.'); }
}
