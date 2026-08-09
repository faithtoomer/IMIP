import type { MiningAdapter } from './adapterContract.js';
import type {
  AdapterCapabilities, AdapterDiagnostics, AdapterHealth, AdapterManifest, AdapterPreparationContext,
  AdapterValidationRequest, AdapterValidationResult, BackendConfig,
} from './types.js';

/**
 * TEST FIXTURE ONLY. This implements no real mining protocol, algorithm, or
 * subprocess; it exists solely to demonstrate the universal adapter contract.
 */
abstract class MockAdapterBase implements MiningAdapter {
  protected configured?: BackendConfig;
  protected state: 'new' | 'prepared' | 'running' | 'paused' | 'stopped' = 'new';
  abstract identify(): Promise<AdapterManifest>;
  abstract capabilities(): Promise<AdapterCapabilities>;
  async validate(_request: AdapterValidationRequest): Promise<AdapterValidationResult> { return { valid: true, reasons: [] }; }
  async configure(config: BackendConfig): Promise<void> { this.configured = config; }
  async prepare(_context: AdapterPreparationContext): Promise<void> { if (!this.configured) throw new Error('Mock adapter requires configuration before prepare.'); this.state = 'prepared'; }
  async start(): Promise<void> { if (this.state !== 'prepared' && this.state !== 'stopped') throw new Error('Mock adapter requires preparation before start.'); this.state = 'running'; }
  async pause(): Promise<void> { if (this.state === 'running') this.state = 'paused'; }
  async resume(): Promise<void> { if (this.state === 'paused') this.state = 'running'; }
  async stop(): Promise<void> { this.state = 'stopped'; }
  async restart(): Promise<void> { this.state = 'running'; }
  async health(): Promise<AdapterHealth> { return { status: this.state === 'running' ? 'healthy' : 'unknown', reasons: [], observedAt: '2026-08-08T20:00:00.000Z' }; }
  abstract statistics(): Promise<unknown>;
  async diagnostics(): Promise<AdapterDiagnostics> { return { summary: 'test fixture only', details: { state: this.state, configurationPresent: Boolean(this.configured) } }; }
  async cleanup(): Promise<void> { this.state = 'stopped'; }
}

/** TEST FIXTURE ONLY: deliberately generic CPU-shaped backend response. */
export class MockCpuAdapter extends MockAdapterBase {
  async identify(): Promise<AdapterManifest> { return { adapterId: 'mock-cpu', name: 'Mock CPU Adapter', version: '1.0.0', vendor: 'IMAF test fixture', backend: 'mock-cpu-backend', supportedOperatingSystems: ['linux'], supportedHardware: ['cpu'], supportedAlgorithms: ['test-hash-cpu'], supportedProtocols: ['test-pool'], requiredCapabilities: ['cpu-mining'], supportedFeatures: ['statistics', 'pause'], configurationSchema: { type: 'object' }, minimumFrameworkVersion: '1.0.0', certificationStatus: 'experimental' }; }
  async capabilities(): Promise<AdapterCapabilities> { return { operatingSystems: ['linux'], hardware: ['cpu'], algorithms: ['test-hash-cpu'], protocols: ['test-pool'], statistics: ['hashrateHps', 'acceptedShares', 'rejectedShares', 'errorRate', 'uptimeSeconds', 'poolLatencyMs', 'workerStatus'], controlOperations: ['start', 'pause', 'resume', 'stop', 'restart'], features: ['statistics', 'pause'] }; }
  async statistics(): Promise<unknown> { return { rate: 125, accepted: 10, rejected: 1, errors: 0.01, seconds: 30, latency: 15, status: this.state, cpuSpecific: 'fixture' }; }
}

/** TEST FIXTURE ONLY: deliberately different GPU-shaped backend response. */
export class MockGpuAdapter extends MockAdapterBase {
  async identify(): Promise<AdapterManifest> { return { adapterId: 'mock-gpu', name: 'Mock GPU Adapter', version: '1.0.0', vendor: 'IMAF test fixture', backend: 'mock-gpu-backend', supportedOperatingSystems: ['linux'], supportedHardware: ['gpu'], supportedAlgorithms: ['test-hash-gpu'], supportedProtocols: ['test-pool'], requiredCapabilities: ['gpu-mining'], supportedFeatures: ['statistics', 'temperature', 'power'], configurationSchema: { type: 'object' }, minimumFrameworkVersion: '1.0.0', certificationStatus: 'development' }; }
  async capabilities(): Promise<AdapterCapabilities> { return { operatingSystems: ['linux'], hardware: ['gpu'], algorithms: ['test-hash-gpu'], protocols: ['test-pool'], statistics: ['hashrateHps', 'acceptedShares', 'rejectedShares', 'errorRate', 'uptimeSeconds', 'poolLatencyMs', 'workerStatus', 'temperatureCelsius', 'powerWatts', 'efficiencyHpsPerWatt'], controlOperations: ['start', 'pause', 'resume', 'stop', 'restart'], features: ['statistics', 'temperature', 'power'] }; }
  async statistics(): Promise<unknown> { return { hashRateHps: 250, shares: { ok: 20, bad: 2 }, gpu: { temp: 61, watts: 100 }, elapsed: 60, protocolLatency: 20, phase: this.state, backendMarker: 'fixture' }; }
}
