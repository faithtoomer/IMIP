import { describe, expect, it } from 'vitest';
import { assertLifecycleTransition, assertRuntimeTransition } from '../src/stateMachine.js';
import { HardwareStateTransitionError, HardwareLifecycleError } from '../src/errors.js';

describe('assertRuntimeTransition (§9)', () => {
  it('allows available -> reserved', () => {
    expect(() => assertRuntimeTransition('available', 'reserved')).not.toThrow();
  });

  it('allows a same-state no-op transition', () => {
    expect(() => assertRuntimeTransition('mining', 'mining')).not.toThrow();
  });

  it('rejects an illegal transition', () => {
    expect(() => assertRuntimeTransition('benchmarking', 'offline')).toThrow(HardwareStateTransitionError);
  });

  it('rejects offline -> mining directly (must pass through available)', () => {
    expect(() => assertRuntimeTransition('offline', 'mining')).toThrow(HardwareStateTransitionError);
  });

  it('allows faulted -> maintenance but not faulted -> available', () => {
    expect(() => assertRuntimeTransition('faulted', 'maintenance')).not.toThrow();
    expect(() => assertRuntimeTransition('faulted', 'available')).toThrow(HardwareStateTransitionError);
  });
});

describe('assertLifecycleTransition (§10)', () => {
  it('allows the standard forward sequence one step at a time', () => {
    expect(() => assertLifecycleTransition('discovered', 'registered')).not.toThrow();
    expect(() => assertLifecycleTransition('registered', 'capability-assessed')).not.toThrow();
    expect(() => assertLifecycleTransition('capability-assessed', 'benchmarked')).not.toThrow();
    expect(() => assertLifecycleTransition('benchmarked', 'available')).not.toThrow();
  });

  it('rejects skipping a stage', () => {
    expect(() => assertLifecycleTransition('discovered', 'capability-assessed')).toThrow(HardwareLifecycleError);
  });

  it('rejects moving backward', () => {
    expect(() => assertLifecycleTransition('benchmarked', 'discovered')).toThrow(HardwareLifecycleError);
  });

  it('allows the allocate/release cycle and retirement from multiple stages', () => {
    expect(() => assertLifecycleTransition('available', 'allocated')).not.toThrow();
    expect(() => assertLifecycleTransition('allocated', 'released')).not.toThrow();
    expect(() => assertLifecycleTransition('released', 'allocated')).not.toThrow();
    expect(() => assertLifecycleTransition('available', 'retired')).not.toThrow();
    expect(() => assertLifecycleTransition('released', 'retired')).not.toThrow();
  });
});
