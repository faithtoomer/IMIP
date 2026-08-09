import { MiningAdapterFramework, type MiningAdapterFrameworkOptions } from '../src/MiningAdapterFramework.js';
import type { ConfigTranslator } from '../src/configTranslation.js';
import { MockCpuAdapter, MockGpuAdapter } from '../src/mockAdapters.js';
import type { SecretProvider } from '../src/providers.js';
import type { CapabilityNegotiationRequest, MiningInstitutionalConfig, NormalizedStatistics } from '../src/types.js';

export class FakeSecretProvider implements SecretProvider {
  readonly values = new Map<string, string>([['wallet-ref', 'wallet-raw-value'], ['password-ref', 'pool-password-raw-value']]);
  storeSecret(secretId: string, category: string, value: string) { this.values.set(secretId, value); return { secretId, category }; }
  retrieveSecret(secretId: string): string { return this.values.get(secretId) ?? ''; }
  rotateSecret(secretId: string, value: string) { this.values.set(secretId, value); return { secretId, category: 'test' }; }
}

export function cpuTranslator(config: Readonly<MiningInstitutionalConfig>) {
  return { adapterId: config.adapterId, values: { endpoint: config.pool.endpoint, worker: config.pool.workerName, algorithm: config.algorithm, ...config.options }, secretReferences: { wallet: config.pool.walletSecretId, password: config.pool.passwordSecretId } };
}
export const gpuTranslator: ConfigTranslator = (config) => ({ adapterId: config.adapterId, values: { gpuPool: config.pool.endpoint, gpuAlgorithm: config.algorithm, tuning: config.options?.tuning }, secretReferences: { payout: config.pool.walletSecretId, poolAuth: config.pool.passwordSecretId } });
export const cpuStatsNormalizer = (raw: unknown): NormalizedStatistics => {
  const value = raw as Record<string, unknown>;
  return { hashrateHps: value.rate as number, acceptedShares: value.accepted as number, rejectedShares: value.rejected as number, errorRate: value.errors as number, uptimeSeconds: value.seconds as number, poolLatencyMs: value.latency as number, workerStatus: value.status as string, extensions: { cpuSpecific: value.cpuSpecific } };
};
export const gpuStatsNormalizer = (raw: unknown): NormalizedStatistics => {
  const value = raw as { hashRateHps: number; shares: { ok: number; bad: number }; gpu: { temp: number; watts: number }; elapsed: number; protocolLatency: number; phase: string; backendMarker: string };
  return { hashrateHps: value.hashRateHps, acceptedShares: value.shares.ok, rejectedShares: value.shares.bad, errorRate: value.shares.bad / (value.shares.ok + value.shares.bad), uptimeSeconds: value.elapsed, poolLatencyMs: value.protocolLatency, workerStatus: value.phase, temperatureCelsius: value.gpu.temp, powerWatts: value.gpu.watts, efficiencyHpsPerWatt: value.hashRateHps / value.gpu.watts, extensions: { backendMarker: value.backendMarker } };
};

export function makeFramework(options: Partial<MiningAdapterFrameworkOptions> = {}) {
  return new MiningAdapterFramework({ secretProvider: new FakeSecretProvider(), now: () => '2026-08-08T20:00:00.000Z', ...options });
}
export function cpuRequest(overrides: Partial<CapabilityNegotiationRequest> = {}): CapabilityNegotiationRequest {
  return { adapterId: 'mock-cpu', operatingSystem: 'linux', hardware: { kind: 'cpu', capabilities: ['cpu-mining'] }, algorithm: 'test-hash-cpu', poolProtocol: 'test-pool', requiredStatistics: ['hashrateHps', 'workerStatus'], requiredControlOperations: ['start', 'stop'], ...overrides };
}
export function gpuRequest(overrides: Partial<CapabilityNegotiationRequest> = {}): CapabilityNegotiationRequest {
  return { adapterId: 'mock-gpu', operatingSystem: 'linux', hardware: { kind: 'gpu', capabilities: ['gpu-mining'] }, algorithm: 'test-hash-gpu', poolProtocol: 'test-pool', requiredStatistics: ['hashrateHps', 'temperatureCelsius', 'powerWatts'], requiredControlOperations: ['start', 'pause', 'resume', 'stop', 'restart'], ...overrides };
}
export function cpuConfig(overrides: Partial<MiningInstitutionalConfig> = {}): MiningInstitutionalConfig { return { adapterId: 'mock-cpu', algorithm: 'test-hash-cpu', operatingSystem: 'linux', hardware: { kind: 'cpu', capabilities: ['cpu-mining'] }, pool: { endpoint: 'test://pool.example', protocol: 'test-pool', workerName: 'cpu-worker', walletSecretId: 'wallet-ref', passwordSecretId: 'password-ref' }, requiredStatistics: ['hashrateHps'], requiredControlOperations: ['start', 'stop'], options: { threads: 4 }, ...overrides }; }
export function gpuConfig(overrides: Partial<MiningInstitutionalConfig> = {}): MiningInstitutionalConfig { return { adapterId: 'mock-gpu', algorithm: 'test-hash-gpu', operatingSystem: 'linux', hardware: { kind: 'gpu', capabilities: ['gpu-mining'] }, pool: { endpoint: 'test://pool.example', protocol: 'test-pool', workerName: 'gpu-worker', walletSecretId: 'wallet-ref', passwordSecretId: 'password-ref' }, requiredStatistics: ['hashrateHps'], requiredControlOperations: ['start', 'stop'], options: { tuning: 'safe' }, ...overrides }; }
export async function registerCpu(framework = makeFramework()) { const adapter = new MockCpuAdapter(); await framework.registerAdapter(adapter, { configTranslator: cpuTranslator, statisticsNormalizer: cpuStatsNormalizer }); return { framework, adapter }; }
export async function registerGpu(framework = makeFramework()) { const adapter = new MockGpuAdapter(); await framework.registerAdapter(adapter, { configTranslator: gpuTranslator, statisticsNormalizer: gpuStatsNormalizer }); return { framework, adapter }; }
export async function validateConfigurePrepareStartCpu(framework = makeFramework()) { await registerCpu(framework); await framework.validateAdapter('mock-cpu', cpuRequest(), cpuConfig()); await framework.configureAdapter('mock-cpu', cpuConfig()); await framework.prepareAdapter('mock-cpu'); await framework.startAdapter('mock-cpu'); return framework; }
