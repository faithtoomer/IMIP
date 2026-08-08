import type { HardwareAuthority } from '../../hardware_authority/src/index.js';
import type { PolicyEvaluationResult, PolicyEvaluator, ResourceEvaluationResult, ResourceEvaluator, ScheduleDefinition } from './types.js';

/**
 * ADR-0014 — Policy Authority (`core/policy_engine/`) remains unimplemented
 * (ADR-0004; DECISION_PIPELINE.md stage 3 is its exclusive, non-bypassable
 * domain). Until it exists, ISOA's default PolicyEvaluator is permissive:
 * there are no real policies to violate yet. This is a real, generic
 * extension point with nothing plugged in — not fabricated policy logic,
 * which would duplicate Policy Authority's ownership.
 */
export const PERMISSIVE_POLICY_EVALUATOR: PolicyEvaluator = {
  evaluate(): PolicyEvaluationResult {
    return { approved: true, reasons: ['No Policy Authority configured — permissive default (ADR-0014).'] };
  },
};

export const PERMISSIVE_RESOURCE_EVALUATOR: ResourceEvaluator = {
  evaluate(): ResourceEvaluationResult {
    return { available: true, reasons: ['No resource evaluator configured — permissive default (ADR-0014).'] };
  },
};

/** A real (not fabricated) resource evaluator grounded in Hardware
 * Authority's actual per-device allocation state — the only genuinely real
 * resource-availability data on the platform today, since Workload
 * Authority (which would own utilization-based allocation) is also
 * unimplemented. */
export function hardwareResourceEvaluator(hardwareAuthority: HardwareAuthority): ResourceEvaluator {
  return {
    evaluate(schedule: ScheduleDefinition): ResourceEvaluationResult {
      const deviceIds = schedule.requiredDevices ?? [];
      const unavailable = deviceIds.filter((deviceId) => {
        try {
          return hardwareAuthority.getState(deviceId) !== 'available';
        } catch {
          return true;
        }
      });
      return unavailable.length === 0
        ? { available: true, reasons: [] }
        : { available: false, reasons: unavailable.map((deviceId) => `Device "${deviceId}" is not available.`) };
    },
  };
}
