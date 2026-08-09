import { AdapterNotFoundError } from './errors.js';
import type { BackendConfig, MiningInstitutionalConfig } from './types.js';

export type ConfigTranslator = (config: Readonly<MiningInstitutionalConfig>) => BackendConfig;

/** Adapter implementations own syntax; IMAF only locates and invokes translators by adapter ID. */
export class ConfigTranslatorRegistry {
  private readonly translators = new Map<string, ConfigTranslator>();
  register(adapterId: string, translator: ConfigTranslator): void { this.translators.set(adapterId, translator); }
  remove(adapterId: string): boolean { return this.translators.delete(adapterId); }
  get(adapterId: string): ConfigTranslator | undefined { return this.translators.get(adapterId); }
  translate(config: MiningInstitutionalConfig): BackendConfig {
    const translator = this.get(config.adapterId);
    if (!translator) throw new AdapterNotFoundError(`configuration translator for ${config.adapterId}`);
    const translated = translator(Object.freeze({ ...config, hardware: { ...config.hardware }, pool: { ...config.pool }, options: config.options ? { ...config.options } : undefined }));
    return Object.freeze({ adapterId: config.adapterId, values: Object.freeze({ ...translated.values }), secretReferences: Object.freeze({ ...translated.secretReferences }) });
  }
}
