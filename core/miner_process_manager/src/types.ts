import type { NormalizedError, NormalizedErrorCategory } from '../../mining_adapter_framework/src/types.js';

export enum ProcessLifecycleStage {
  Requested = 'requested', Validated = 'validated', Prepared = 'prepared', Spawned = 'spawned', Starting = 'starting', Running = 'running', Degraded = 'degraded', Stopping = 'stopping', Stopped = 'stopped', Archived = 'archived', Failed = 'failed',
}
export type ProcessControlOwner = string;
export interface ResourceRequirement { resourceId: string; hardwareId?: string; capacity: number; kind?: string; }
export interface ProcessLaunchRequest {
  parentWorkloadUuid: string; adapterUuid: string; pluginUuid: string; executable: string; args: string[];
  envAllowlistEntries: string[]; secretReferences: Record<string, string>; resourceRequirements: ResourceRequirement[];
  callerId: ProcessControlOwner; expectedExecutable?: string; allowedExecutableRoots?: string[]; restartPolicy?: RestartPolicy;
}
export interface ProcessIdentity {
  processUuid: string; parentWorkloadUuid: string; adapterUuid: string; pluginUuid: string; pid: number; startTime: string;
  commandIdentity: { executable: string; args: readonly string[] }; runtimeState: ProcessLifecycleStage; exitStatus?: ProcessExitInfo;
}
export interface ProcessExitInfo { exitCode: number | null; signal?: string; timestamp: string; }
export interface ProcessRuntimeState { stage: ProcessLifecycleStage; pid?: number; startedAt?: string; exitStatus?: ProcessExitInfo; restartCount: number; lastFailure?: ProcessFailureCondition; reservationIds: string[]; }
export interface RestartPolicy { maxRetries: number; backoffBaseMs: number; backoffMultiplier: number; backoffCapMs: number; cooldownMs: number; }
export type ProcessFailureType = 'permission-denied' | 'security-validation' | 'resource-unavailable' | 'reservation-failed' | 'process-permission-denied' | 'spawn-failed' | 'crash' | 'exit-nonzero' | 'restart-exhausted' | 'orphaned' | 'unknown';
export interface ProcessFailureCondition { type: ProcessFailureType; message: string; detectedAt: string; retriable: boolean; normalizedError?: NormalizedError; category?: NormalizedErrorCategory; details?: Record<string, unknown>; }
export interface ProcessLifecycleRecord { processUuid: string; from: ProcessLifecycleStage | undefined; to: ProcessLifecycleStage; at: string; reason: string; }
export interface ManagedProcess { processUuid: string; request: ProcessLaunchRequest; identity?: Readonly<ProcessIdentity>; runtime: ProcessRuntimeState; lifecycle: ProcessLifecycleRecord[]; }
export interface ProcessEventPayload { processUuid: string; stage: ProcessLifecycleStage; reason?: string; pid?: number; }
export interface OrphanSweepResult { trackedLivePids: number[]; orphanedPids: number[]; duplicatePids: number[]; cleanedPids: number[]; }
export type RestartKind = 'manual' | 'automatic' | 'crash-recovery';
export type { NormalizedError, NormalizedErrorCategory } from '../../mining_adapter_framework/src/types.js';
