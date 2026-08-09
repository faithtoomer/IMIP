import { NormalizedErrorCategory, type NormalizedError } from './types.js';

export type ErrorClassifier = (error: unknown) => NormalizedError | undefined;

export class ErrorClassifierRegistry {
  private readonly classifiers = new Map<string, ErrorClassifier>();
  register(adapterId: string, classifier: ErrorClassifier): void { this.classifiers.set(adapterId, classifier); }
  remove(adapterId: string): boolean { return this.classifiers.delete(adapterId); }
  normalize(adapterId: string, error: unknown): NormalizedError {
    const classified = this.classifiers.get(adapterId)?.(error) ?? classifyStructuralError(error);
    return Object.freeze({ ...classified, details: classified.details ? Object.freeze({ ...classified.details }) : undefined });
  }
}

export function classifyStructuralError(error: unknown): NormalizedError {
  const source = error instanceof Error ? { message: error.message, code: (error as Error & { code?: unknown }).code } : error;
  const record = source !== null && typeof source === 'object' ? source as Record<string, unknown> : {};
  const message = typeof record.message === 'string' ? record.message : typeof source === 'string' ? source : 'Unknown backend failure.';
  const code = typeof record.code === 'string' ? record.code : undefined;
  const input = `${code ?? ''} ${message}`.toLowerCase();
  const categories: Array<[NormalizedErrorCategory, RegExp, boolean]> = [
    [NormalizedErrorCategory.ConfigurationFailure, /config|invalid option|parse/, false],
    [NormalizedErrorCategory.DependencyFailure, /dependenc|missing library|not found/, false],
    [NormalizedErrorCategory.HardwareIncompatible, /incompatible hardware|unsupported (?:gpu|cpu|asic|device)/, false],
    [NormalizedErrorCategory.DriverFailure, /driver|cuda|opencl/, false],
    [NormalizedErrorCategory.AuthenticationFailure, /auth|credential|wallet|password|unauthori[sz]ed/, false],
    [NormalizedErrorCategory.PoolFailure, /pool|stratum|share rejected/, true],
    [NormalizedErrorCategory.NetworkFailure, /network|socket|dns|connect|timeout/, true],
    [NormalizedErrorCategory.ProcessFailure, /process|exit code|spawn|signal/, true],
    [NormalizedErrorCategory.RuntimeFailure, /runtime|crash|exception|fatal/, true],
  ];
  const [category, , retriable] = categories.find((entry) => entry[1].test(input)) ?? [NormalizedErrorCategory.UnknownFailure, /./, false];
  return { category, message, code, retriable, source: 'structural-error-classifier' };
}
