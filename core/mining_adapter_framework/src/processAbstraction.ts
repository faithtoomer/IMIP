/**
 * Adapter-neutral process shapes. Implementations may supply a process runner in a
 * future adapter; IMAF itself does not spawn operating-system processes.
 */
export type ProcessRuntimeState = 'created' | 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'exited' | 'failed';
export interface ProcessStreamHandle { readonly kind: 'stdout' | 'stderr'; write?(chunk: string | Uint8Array): void; close?(): void; }
export interface ProcessResourceUsage { cpuPercent?: number; memoryBytes?: number; threads?: number; openFiles?: number; observedAt?: string; }
export interface MinerProcessDescriptor {
  executableLocation: string;
  arguments: string[];
  environment: Record<string, string | undefined>;
  workingDirectory?: string;
  stdout?: ProcessStreamHandle;
  stderr?: ProcessStreamHandle;
  exitCode?: number | null;
  pid?: number;
  runtimeState: ProcessRuntimeState;
  resourceUsage?: ProcessResourceUsage;
}
