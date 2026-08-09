import type { GpuHardwareProvider } from './providers.js';
/** UUID keyed identity view; order is sorted for determinism but never semantically primary. */
export class GpuIdentityRegistry {
  constructor(private readonly hardware: GpuHardwareProvider) {}
  list(): string[] { return [...new Set(this.hardware.listGpus())].sort(); }
  has(gpuUuid: string): boolean { return this.list().includes(gpuUuid); }
  lookup(gpuUuid: string) { return this.has(gpuUuid) ? this.hardware.getGpu(gpuUuid) : undefined; }
  require(gpuUuid: string) { const gpu = this.lookup(gpuUuid); if (!gpu) throw new Error(`GPU UUID ${gpuUuid} is not known by the injected hardware provider.`); return gpu; }
}
