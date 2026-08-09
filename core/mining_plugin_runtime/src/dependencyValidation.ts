import { PluginDependencyValidationError } from './errors.js';
import type { PluginManifest, PluginRuntimeInterfaceName } from './types.js';
const APPROVED: readonly PluginRuntimeInterfaceName[] = ['configuration','eventBus','resources','hardwareIntelligence','power','thermal','health','statistics','miningFrameworks','security'];
/** A deliberately small declared-vs-available check; it is not dependency resolution. */
export function declaredVersionCompatible(actual: string, declared: string | undefined): boolean {
  if (!declared || declared === '*') return true;
  if (declared.endsWith('.*')) return actual.startsWith(declared.slice(0, -1));
  return actual === declared;
}
export function validateDeclaredDependencies(manifest: PluginManifest, loadedManifests: readonly PluginManifest[], availableInterfaces: readonly PluginRuntimeInterfaceName[] = APPROVED): void {
  const reasons: string[] = [];
  for (const name of manifest.requiredInterfaces) if (!availableInterfaces.includes(name)) reasons.push(`required interface ${name} is unavailable`);
  for (const dependency of manifest.declaredDependencies) {
    if (dependency.interfaceName && !availableInterfaces.includes(dependency.interfaceName)) reasons.push(`declared interface ${dependency.interfaceName} is unavailable`);
    if (dependency.pluginUuid) {
      const candidate = loadedManifests.find((item) => item.pluginUuid === dependency.pluginUuid);
      if (!candidate && dependency.required !== false) reasons.push(`declared plugin dependency ${dependency.pluginUuid} is unavailable`);
      else if (candidate && !declaredVersionCompatible(candidate.version, dependency.version)) reasons.push(`declared plugin dependency ${dependency.pluginUuid} version ${dependency.version} is incompatible with ${candidate.version}`);
    }
  }
  if (reasons.length) throw new PluginDependencyValidationError(reasons);
}
export { APPROVED as APPROVED_RUNTIME_INTERFACES };
