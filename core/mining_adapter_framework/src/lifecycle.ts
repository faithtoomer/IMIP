import { AdapterLifecycleError } from './errors.js';
import { AdapterLifecycleStage } from './types.js';

export const ADAPTER_NOMINAL_LIFECYCLE: readonly AdapterLifecycleStage[] = Object.freeze([
  AdapterLifecycleStage.Discovered,
  AdapterLifecycleStage.Registered,
  AdapterLifecycleStage.Validated,
  AdapterLifecycleStage.Configured,
  AdapterLifecycleStage.Prepared,
  AdapterLifecycleStage.Started,
  AdapterLifecycleStage.Running,
  AdapterLifecycleStage.Stopping,
  AdapterLifecycleStage.Stopped,
  AdapterLifecycleStage.Retired,
]);

export const ADAPTER_LIFECYCLE_TRANSITIONS: Readonly<Record<AdapterLifecycleStage, readonly AdapterLifecycleStage[]>> = Object.freeze({
  [AdapterLifecycleStage.Discovered]: [AdapterLifecycleStage.Registered, AdapterLifecycleStage.Rejected, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Registered]: [AdapterLifecycleStage.Validated, AdapterLifecycleStage.Rejected, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Validated]: [AdapterLifecycleStage.Configured, AdapterLifecycleStage.Rejected, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Configured]: [AdapterLifecycleStage.Prepared, AdapterLifecycleStage.Rejected, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Prepared]: [AdapterLifecycleStage.Started, AdapterLifecycleStage.Rejected, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Started]: [AdapterLifecycleStage.Running, AdapterLifecycleStage.Stopping, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Running]: [AdapterLifecycleStage.Stopping, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Stopping]: [AdapterLifecycleStage.Stopped, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Stopped]: [AdapterLifecycleStage.Started, AdapterLifecycleStage.Retired, AdapterLifecycleStage.Failed],
  [AdapterLifecycleStage.Retired]: [],
  [AdapterLifecycleStage.Failed]: [AdapterLifecycleStage.Started, AdapterLifecycleStage.Stopped, AdapterLifecycleStage.Retired],
  [AdapterLifecycleStage.Rejected]: [],
});

export function assertAdapterLifecycleTransition(from: AdapterLifecycleStage | undefined, to: AdapterLifecycleStage): void {
  if (from === undefined && to === AdapterLifecycleStage.Discovered) return;
  if (from !== undefined && ADAPTER_LIFECYCLE_TRANSITIONS[from].includes(to)) return;
  throw new AdapterLifecycleError(from, to);
}
