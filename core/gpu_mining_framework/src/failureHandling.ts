import type { GpuFailureCondition, GpuProfile, NormalizedError } from './types.js';
/** Detection/reporting only; it does not restart a miner, alter allocation, or override any policy. */
export function detectGpuFailureConditions(input: { profile: GpuProfile; requiredVramMB: number; adapterHealth?: { status: string; reasons: string[] }; adapterError?: NormalizedError; gpuPresent: boolean; at: string }): GpuFailureCondition[] {
  const conditions: GpuFailureCondition[] = []; const error = input.adapterError; const add = (type: GpuFailureCondition['type'], severity: GpuFailureCondition['severity'], rationale: string, normalizedError?: NormalizedError) => conditions.push(Object.freeze({ type, severity, detectedAt: input.at, rationale, normalizedError, evidence: Object.freeze({ profile: input.profile.gpuUuid, adapterHealth: input.adapterHealth, adapterError: error }) }));
  if (error?.category === 'DriverFailure' || /driver/i.test(error?.message ?? '')) add('driver-failure', 'critical', 'Adapter signal indicates a GPU driver failure.', error);
  if (!input.gpuPresent) add('gpu-disappearance', 'critical', 'Injected hardware provider no longer identifies the GPU UUID.', normalize('HardwareIncompatible' as NormalizedError['category'], 'GPU disappeared.'));
  if (/cuda|opencl/i.test(error?.message ?? '') || error?.code?.toLowerCase().includes('cuda') || error?.code?.toLowerCase().includes('opencl')) add('cuda-opencl-error', 'error', 'Adapter signal contains a CUDA/OpenCL error.', error);
  if (input.requiredVramMB > input.profile.vramAvailableMB || /vram|out of memory/i.test(error?.message ?? '')) add('vram-exhaustion', 'error', 'Provider availability or adapter error indicates VRAM exhaustion.', error ?? normalize('RuntimeFailure' as NormalizedError['category'], 'VRAM requirement exceeds available VRAM.'));
  if (input.profile.thermalState.state === 'critical' || /throttl/i.test(error?.message ?? '')) add('thermal-throttling', 'warning', 'Thermal provider or adapter signal indicates thermal throttling.', error);
  if (input.profile.powerState.budgetExceeded || /power.limit/i.test(error?.message ?? '')) add('power-limit-violation', 'warning', 'Power provider or adapter signal indicates a power-limit violation.', error);
  if (input.adapterHealth?.status === 'faulted' || error?.category === 'ProcessFailure') add('miner-crash', 'critical', 'Adapter health/error indicates miner crash.', error);
  if (error?.category === 'PoolFailure' || error?.category === 'NetworkFailure' || input.adapterHealth?.reasons.some((reason) => /pool/i.test(reason))) add('pool-failure', 'warning', 'Adapter health/error indicates pool failure.', error);
  return conditions;
}
function normalize(category: NormalizedError['category'], message: string): NormalizedError { return { category, message, retriable: false, source: 'IGMF detection' }; }
