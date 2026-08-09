import type { ProcessLaunchRequest, ResourceRequirement } from './types.js';
export interface ProcessSpawnRequest { executable: string; args: readonly string[]; environment: Readonly<Record<string, string>>; secretReferences: Readonly<Record<string, string>>; processUuid: string; }
export interface ProcessLaunchResult { pid: number; onStdout?(handler: (text: string) => void): void; onStderr?(handler: (text: string) => void): void; onExit?(handler: (exitCode: number | null, signal?: string) => void): void; }
/** The only process creation choke point. Arguments are always a separate array; no shell string is accepted. */
export interface ProcessLauncher { spawn(request: ProcessSpawnRequest): Promise<ProcessLaunchResult>; kill(pid: number, signal?: string): Promise<void>; signal(pid: number, signal: string): Promise<void>; listLivePids(): Promise<number[]>; }
export interface SecurityPermissionProvider {
  checkPermission(input: { callerId: string; permission: 'mining.process.launch' | 'mining.process.control'; processUuid?: string }): Promise<{ allowed: boolean; reason?: string }>;
  buildLeastPrivilegeEnvironment(input: { allowlist: readonly string[]; secretReferences: Readonly<Record<string, string>> }): Promise<Record<string, string>>;
  redact(value: string): string;
  verifyExecutable(input: { executable: string; expectedExecutable?: string; allowedRoots: readonly string[] }): Promise<{ valid: boolean; resolvedExecutable?: string; reason?: string }>;
}
export interface ObservabilitySink { emit(record: { timestamp: string; processUuid: string; stream: 'stdout' | 'stderr' | 'diagnostic' | 'exit'; severity: 'info' | 'warning' | 'error'; message: string; context?: Record<string, unknown> }): void; }
export interface ResourceAvailabilityProvider { checkAvailability(requirements: readonly ResourceRequirement[], context: { processUuid: string; workloadUuid: string }): Promise<{ available: boolean; reason?: string }>; }
export interface ResourceReservationProvider { reserve(requirements: readonly ResourceRequirement[], context: { processUuid: string; workloadUuid: string }): Promise<{ reserved: boolean; reservationIds: string[]; reason?: string }>; release?(reservationIds: readonly string[], reason: string): Promise<void>; }
export interface ResourcePermissionProvider { authorizeProcess(input: { processUuid: string; workloadUuid: string; reservationIds: readonly string[] }): Promise<{ allowed: boolean; reason?: string }>; }
export interface MinerProcessManagerDependencies { launcher: ProcessLauncher; security: SecurityPermissionProvider; observability: ObservabilitySink; availability: ResourceAvailabilityProvider; reservation: ResourceReservationProvider; resourcePermission: ResourcePermissionProvider; now: () => string; createUuid?: () => string; }
