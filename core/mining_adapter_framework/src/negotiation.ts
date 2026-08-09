import type { AdapterRegistryRecord } from './registry.js';
import type { CapabilityNegotiationCheck, CapabilityNegotiationRequest, CapabilityNegotiationResult } from './types.js';

export class CapabilityNegotiationEngine {
  negotiate(record: AdapterRegistryRecord, request: CapabilityNegotiationRequest, frameworkVersion = '1.0.0'): CapabilityNegotiationResult {
    const checks: CapabilityNegotiationCheck[] = [];
    const check = (subject: CapabilityNegotiationCheck['subject'], requested: string, values: readonly string[], noun: string) => {
      const supported = values.some((value) => value.toLocaleLowerCase() === requested.toLocaleLowerCase());
      checks.push({ subject, requested, supported, reason: supported ? `${noun} ${requested} is supported.` : `${noun} ${requested} is not supported.` });
    };
    check('operating-system', request.operatingSystem, record.capabilities.operatingSystems, 'Operating system');
    check('hardware', request.hardware.kind, record.capabilities.hardware, 'Hardware');
    check('algorithm', request.algorithm, record.capabilities.algorithms, 'Algorithm');
    check('pool-protocol', request.poolProtocol, record.capabilities.protocols, 'Pool protocol');
    for (const statistic of [...(request.requiredStatistics ?? [])].sort()) check('statistics', statistic, record.capabilities.statistics, 'Statistic');
    for (const operation of [...(request.requiredControlOperations ?? [])].sort()) check('control-operation', operation, record.capabilities.controlOperations, 'Control operation');
    for (const capability of [...record.manifest.requiredCapabilities].sort()) {
      const supplied = request.hardware.capabilities ?? [];
      check('required-capability', capability, supplied, 'Required hardware capability');
    }
    const minimum = record.manifest.minimumFrameworkVersion;
    const requestedVersion = request.frameworkVersion ?? frameworkVersion;
    const versionSupported = compareVersions(requestedVersion, minimum) >= 0;
    checks.push({ subject: 'framework-version', requested: requestedVersion, supported: versionSupported, reason: versionSupported ? `Framework ${requestedVersion} satisfies minimum ${minimum}.` : `Framework ${requestedVersion} is below minimum ${minimum}.` });
    const reasons = checks.filter((checkResult) => !checkResult.supported).map((checkResult) => checkResult.reason);
    return { adapterId: record.manifest.adapterId, compatible: reasons.length === 0, checks, reasons };
  }
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.split('.').map((part) => Number.parseInt(part.replace(/\D.*$/, ''), 10) || 0);
  const a = parse(left); const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) { const diff = (a[index] ?? 0) - (b[index] ?? 0); if (diff !== 0) return diff; }
  return 0;
}
