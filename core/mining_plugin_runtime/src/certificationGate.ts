import { PluginCertificationError } from './errors.js';
import type { PluginCertificationStatusProvider } from './providers.js';
import type { CertificationStatus, PluginManifest } from './types.js';
export async function requireValidCertification(provider: PluginCertificationStatusProvider, manifest: PluginManifest): Promise<CertificationStatus> {
  const status = await provider.getCertificationStatus({ pluginUuid: manifest.pluginUuid, version: manifest.version, manifest });
  if (!status?.certified) throw new PluginCertificationError(status?.reason ?? 'no valid certification record was returned');
  return Object.freeze({ ...status });
}
