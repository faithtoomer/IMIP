import { describe, expect, it } from 'vitest';
import { assertRuntimeTransition } from '../src/lifecycleStateMachine.js';
import { InvalidLifecycleTransitionError } from '../src/errors.js';

describe('runtime lifecycle state machine (§7)', () => {
  it('allows the standard boot sequence', () => {
    expect(() => assertRuntimeTransition('stopped', 'booting')).not.toThrow();
    expect(() => assertRuntimeTransition('booting', 'initializing')).not.toThrow();
    expect(() => assertRuntimeTransition('initializing', 'validating')).not.toThrow();
    expect(() => assertRuntimeTransition('validating', 'ready')).not.toThrow();
    expect(() => assertRuntimeTransition('ready', 'operational')).not.toThrow();
  });

  it('allows a same-state no-op', () => {
    expect(() => assertRuntimeTransition('operational', 'operational')).not.toThrow();
  });

  it('rejects skipping straight from stopped to operational', () => {
    expect(() => assertRuntimeTransition('stopped', 'operational')).toThrow(InvalidLifecycleTransitionError);
  });

  it('allows operational -> paused -> operational', () => {
    expect(() => assertRuntimeTransition('operational', 'paused')).not.toThrow();
    expect(() => assertRuntimeTransition('paused', 'operational')).not.toThrow();
  });

  it('allows operational -> faulted -> recovering -> operational (in-place recovery)', () => {
    expect(() => assertRuntimeTransition('operational', 'faulted')).not.toThrow();
    expect(() => assertRuntimeTransition('faulted', 'recovering')).not.toThrow();
    expect(() => assertRuntimeTransition('recovering', 'operational')).not.toThrow();
  });

  it('allows faulted -> recovering -> booting (full rebuild recovery)', () => {
    expect(() => assertRuntimeTransition('recovering', 'booting')).not.toThrow();
  });

  it('rejects faulted -> operational directly (must go through recovering)', () => {
    expect(() => assertRuntimeTransition('faulted', 'operational')).toThrow(InvalidLifecycleTransitionError);
  });

  it('allows the full shutdown -> stopped -> reboot cycle', () => {
    expect(() => assertRuntimeTransition('operational', 'shutting-down')).not.toThrow();
    expect(() => assertRuntimeTransition('shutting-down', 'stopped')).not.toThrow();
    expect(() => assertRuntimeTransition('stopped', 'booting')).not.toThrow();
  });
});
