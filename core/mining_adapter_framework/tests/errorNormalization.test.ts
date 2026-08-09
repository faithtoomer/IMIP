import { describe, expect, it } from 'vitest';
import { ErrorClassifierRegistry } from '../src/errorNormalization.js';
import { NormalizedErrorCategory } from '../src/types.js';

const cases: Array<[NormalizedErrorCategory, string]> = [
  [NormalizedErrorCategory.ConfigurationFailure, 'invalid configuration'], [NormalizedErrorCategory.DependencyFailure, 'missing library dependency'], [NormalizedErrorCategory.HardwareIncompatible, 'unsupported GPU device'], [NormalizedErrorCategory.DriverFailure, 'driver CUDA failure'], [NormalizedErrorCategory.NetworkFailure, 'network timeout'], [NormalizedErrorCategory.PoolFailure, 'pool share rejected'], [NormalizedErrorCategory.AuthenticationFailure, 'authentication credential denied'], [NormalizedErrorCategory.ProcessFailure, 'process exit code 1'], [NormalizedErrorCategory.RuntimeFailure, 'runtime crash'], [NormalizedErrorCategory.UnknownFailure, 'unclassifiable condition'],
];
describe('IMAF error normalization', () => {
  it('deterministically classifies all ten required institutional categories', () => {
    const registry = new ErrorClassifierRegistry();
    for (const [category, message] of cases) expect(registry.normalize('unregistered', { message }).category).toBe(category);
  });
  it('allows an adapter-specific classifier to replace backend-specific mapping without changing IMAF', () => {
    const registry = new ErrorClassifierRegistry(); registry.register('mock', () => ({ category: NormalizedErrorCategory.ProcessFailure, message: 'adapter classifier', retriable: true, source: 'mock' }));
    expect(registry.normalize('mock', { anything: 'goes' })).toMatchObject({ category: NormalizedErrorCategory.ProcessFailure, retriable: true, source: 'mock' });
  });
});
