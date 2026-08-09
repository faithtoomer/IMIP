import type {
  AdapterCapabilities,
  AdapterDiagnostics,
  AdapterHealth,
  AdapterManifest,
  AdapterPreparationContext,
  AdapterValidationRequest,
  AdapterValidationResult,
  BackendConfig,
} from './types.js';

/** The sole IMAF boundary for miner/backend-specific implementation. */
export interface MiningAdapter {
  identify(): Promise<AdapterManifest>;
  validate(request: AdapterValidationRequest): Promise<AdapterValidationResult>;
  configure(config: BackendConfig): Promise<void>;
  prepare(context: AdapterPreparationContext): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  health(): Promise<AdapterHealth>;
  statistics(): Promise<unknown>;
  capabilities(): Promise<AdapterCapabilities>;
  diagnostics(): Promise<AdapterDiagnostics>;
  cleanup(): Promise<void>;
}
