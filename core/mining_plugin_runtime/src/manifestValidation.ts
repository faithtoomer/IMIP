import { PluginManifestValidationError } from './errors.js';
import type { PluginManifest, PluginPackage, PluginRuntimeInterfaceName } from './types.js';
const INTERFACES = new Set<PluginRuntimeInterfaceName>(['configuration','eventBus','resources','hardwareIntelligence','power','thermal','health','statistics','miningFrameworks','security']);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export function validatePluginManifest(manifest: PluginManifest, pluginPackage: PluginPackage): void {
  const reasons: string[] = [];
  if (!manifest || typeof manifest !== 'object') reasons.push('manifest must be an object');
  if (!nonEmpty(manifest?.pluginUuid)) reasons.push('pluginUuid is required');
  if (!nonEmpty(manifest?.version)) reasons.push('version is required');
  if (!Array.isArray(manifest?.declaredDependencies)) reasons.push('declaredDependencies must be an array');
  if (!Array.isArray(manifest?.declaredCapabilities) || manifest.declaredCapabilities.some((item) => !nonEmpty(item))) reasons.push('declaredCapabilities must be an array of non-empty strings');
  if (!Array.isArray(manifest?.requiredInterfaces) || manifest.requiredInterfaces.some((item) => !INTERFACES.has(item))) reasons.push('requiredInterfaces contains an unsupported approved interface');
  if (Array.isArray(manifest?.declaredDependencies)) for (const dependency of manifest.declaredDependencies) {
    if (!dependency || typeof dependency !== 'object' || (!nonEmpty(dependency.pluginUuid) && !nonEmpty(dependency.interfaceName))) reasons.push('each dependency requires a pluginUuid or interfaceName');
    if (dependency.interfaceName && !INTERFACES.has(dependency.interfaceName)) reasons.push(`dependency declares unsupported interface ${String(dependency.interfaceName)}`);
    if (dependency.version !== undefined && !nonEmpty(dependency.version)) reasons.push('dependency version must be a non-empty string');
  }
  if (!pluginPackage || typeof pluginPackage !== 'object' || !pluginPackage.entrypoint || typeof pluginPackage.entrypoint !== 'object') reasons.push('package entrypoint is required');
  if (reasons.length) throw new PluginManifestValidationError(reasons);
}
