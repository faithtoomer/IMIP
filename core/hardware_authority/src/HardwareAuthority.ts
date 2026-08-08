import { HardwareRegistry } from './registry.js';
import { SystemInformationDiscoveryProvider, type DiscoveryProvider } from './discovery.js';
import { classifyDevices } from './classification.js';
import { assessCapabilities, assessHealth } from './assessment.js';
import { assertLifecycleTransition, assertRuntimeTransition } from './stateMachine.js';
import { BenchmarkRegistry } from './benchmarks.js';
import { HARDWARE_EVENTS, HardwareEventBus, type HardwareEventName } from './events.js';
import { HardwareAuditTrail } from './explainability.js';
import { assembleDigitalTwin, computeSuitability, initialReliability, recomputeStabilityScore } from './digitalTwin.js';
import { detectDuplicateDeviceIds, detectInventoryInconsistencies, type IntegrityIssue } from './integrity.js';
import { HardwareDiscoveryError } from './errors.js';
import type { InstitutionalEventBus } from '../../event_bus/src/index.js';
import type {
  BenchmarkResult,
  DeviceRecord,
  DigitalTwin,
  DiscoverySnapshot,
  HardwareCapability,
  HardwareCategory,
  LifecycleStage,
  ReliabilityRecord,
  RuntimeState,
  SuitabilityScore,
} from './types.js';

export interface HardwareAuthorityOptions {
  discoveryProvider?: DiscoveryProvider;
  /** Shared Institutional Event Bus (PHASE-05) to mirror events onto. Optional —
   * without it, HardwareEventBus behaves exactly as it did before Phase 05 (ADR-0009). */
  eventBus?: InstitutionalEventBus;
}

/**
 * IHIS — the Institutional Hardware Intelligence System (PHASE-03).
 *
 * Pipeline (§5): OS-level discovery → classification → capability assessment →
 * registry → runtime state management → event publication. Every device is
 * additionally assembled into a Digital Twin (Architect's Enhancement) that
 * scores workload suitability from capability + health + availability +
 * reliability rather than device identity.
 */
export class HardwareAuthority {
  readonly registry = new HardwareRegistry();
  readonly events: HardwareEventBus;
  readonly audit = new HardwareAuditTrail();
  readonly benchmarks = new BenchmarkRegistry();

  private readonly discoveryProvider: DiscoveryProvider;
  private readonly reliability = new Map<string, ReliabilityRecord>();
  private readonly snapshots: DiscoverySnapshot[] = [];
  private snapshotVersion = 0;

  constructor(options: HardwareAuthorityOptions = {}) {
    this.discoveryProvider = options.discoveryProvider ?? new SystemInformationDiscoveryProvider();
    this.events = new HardwareEventBus(options.eventBus);
  }

  /** Runs discovery, classifies, assesses capabilities/health, and reconciles against
   * the existing registry. Never throws on a single category's failure (§15) — that
   * category's previous inventory is preserved and a HardwareFaultDetected event fires. */
  async discover(): Promise<DiscoverySnapshot> {
    const previousById = new Map(this.registry.all().map((device) => [device.deviceId, device]));
    const outcome = await this.discoveryProvider.discover();
    const now = new Date().toISOString();

    for (const failure of outcome.failures) {
      const error = new HardwareDiscoveryError(failure.category, failure.message);
      this.audit.record({
        timestamp: now,
        deviceId: `__category:${failure.category}__`,
        kind: 'fault-detected',
        details: { message: error.message },
        reason: 'discovery-failure',
        initiatingAuthority: 'Hardware Authority',
      });
      this.events.publish(HARDWARE_EVENTS.HardwareFaultDetected, { category: failure.category, message: error.message });
    }

    const failedCategories = new Set(outcome.failures.map((f) => f.category));
    const classified = classifyDevices(outcome.snapshot);

    for (const duplicate of detectDuplicateDeviceIds(classified)) {
      this.audit.record({
        timestamp: now,
        deviceId: duplicate.deviceId,
        kind: 'fault-detected',
        details: { issue: duplicate.issue },
        reason: 'duplicate-device-id',
        initiatingAuthority: 'Hardware Authority',
      });
      this.events.publish(HARDWARE_EVENTS.HardwareFaultDetected, { deviceId: duplicate.deviceId, reason: duplicate.issue });
    }

    const seenIds = new Set<string>();

    for (const raw of classified) {
      seenIds.add(raw.deviceId);
      const withCapabilities: DeviceRecord = { ...raw, capabilities: assessCapabilities(raw) };
      const health = assessHealth(withCapabilities, now);
      const existing = previousById.get(raw.deviceId);

      const record: DeviceRecord = {
        ...withCapabilities,
        health,
        lifecycleStage: existing?.lifecycleStage ?? 'discovered',
        runtimeState: existing?.runtimeState ?? 'offline',
        discoveryTimestamp: existing?.discoveryTimestamp ?? now,
        lastUpdated: now,
      };
      this.registry.upsert(record);

      if (!existing) {
        this.reliability.set(record.deviceId, initialReliability(record.deviceId));
        this.advanceLifecycle(record.deviceId, 'registered', 'auto-registered on discovery', 'Hardware Authority');
        this.events.publish(HARDWARE_EVENTS.DeviceRegistered, { deviceId: record.deviceId });
        this.advanceLifecycle(record.deviceId, 'capability-assessed', 'capabilities assessed on discovery', 'Hardware Authority');
        this.applyRuntimeTransition(record.deviceId, 'available', 'discovered and capability-assessed', 'Hardware Authority');
        this.events.publish(HARDWARE_EVENTS.Discovered, { deviceId: record.deviceId, category: record.category });
        this.audit.record({
          timestamp: now,
          deviceId: record.deviceId,
          kind: 'discovered',
          details: { category: record.category },
        });
      } else {
        const capabilitiesChanged =
          JSON.stringify([...existing.capabilities].sort()) !== JSON.stringify([...record.capabilities].sort());
        const driverChanged = record.identity.driver !== undefined && existing.identity.driver !== record.identity.driver;

        if (capabilitiesChanged) {
          this.events.publish(HARDWARE_EVENTS.CapabilityChanged, {
            deviceId: record.deviceId,
            from: existing.capabilities,
            to: record.capabilities,
          });
          this.audit.record({
            timestamp: now,
            deviceId: record.deviceId,
            kind: 'capability-changed',
            details: { from: existing.capabilities, to: record.capabilities },
          });
        }
        if (driverChanged) {
          this.events.publish(HARDWARE_EVENTS.DriverChanged, {
            deviceId: record.deviceId,
            from: existing.identity.driver,
            to: record.identity.driver,
          });
          this.audit.record({
            timestamp: now,
            deviceId: record.deviceId,
            kind: 'driver-changed',
            details: { from: existing.identity.driver, to: record.identity.driver },
          });
        }

        this.events.publish(HARDWARE_EVENTS.Updated, { deviceId: record.deviceId });
        this.audit.record({ timestamp: now, deviceId: record.deviceId, kind: 'updated', details: {} });
      }
    }

    // Devices previously known but absent this round: mark offline, unless their whole
    // category failed to discover this round (preserve prior inventory — §15).
    for (const [id, existing] of previousById) {
      if (seenIds.has(id) || failedCategories.has(existing.category)) continue;
      // Physical removal is an external fact, not an authority-initiated workflow
      // transition, so it bypasses the runtime transition guard deliberately.
      const removed: DeviceRecord = { ...existing, runtimeState: 'offline', lastUpdated: now };
      this.registry.upsert(removed);
      this.events.publish(HARDWARE_EVENTS.Removed, { deviceId: id });
      this.audit.record({ timestamp: now, deviceId: id, kind: 'removed', details: {} });
    }

    for (const issue of detectInventoryInconsistencies(this.registry.all())) {
      this.audit.record({
        timestamp: now,
        deviceId: issue.deviceId,
        kind: 'fault-detected',
        details: { issue: issue.issue },
        reason: 'inventory-inconsistency',
        initiatingAuthority: 'Hardware Authority',
      });
      this.events.publish(HARDWARE_EVENTS.HardwareFaultDetected, { deviceId: issue.deviceId, reason: issue.issue });
    }

    this.snapshotVersion += 1;
    const snapshot: DiscoverySnapshot = Object.freeze({
      version: this.snapshotVersion,
      createdAt: now,
      devices: Object.freeze(this.registry.all()),
    });
    this.snapshots.push(snapshot);
    return snapshot;
  }

  // ---- Read API (§14) ----

  getInventory(): DeviceRecord[] {
    return this.registry.all();
  }

  getDevice(deviceId: string): DeviceRecord {
    return this.registry.require(deviceId);
  }

  getCategory(category: HardwareCategory): DeviceRecord[] {
    return this.registry.byCategory(category);
  }

  getByCapability(capability: HardwareCapability): DeviceRecord[] {
    return this.registry.byCapability(capability);
  }

  getState(deviceId: string): RuntimeState {
    return this.registry.require(deviceId).runtimeState;
  }

  getHealth(deviceId: string): DeviceRecord['health'] {
    return this.registry.require(deviceId).health;
  }

  getBenchmarks(deviceId: string) {
    return this.benchmarks.summarize(deviceId);
  }

  getDiscoveryHistory(): readonly DiscoverySnapshot[] {
    return this.snapshots;
  }

  /** §15 — on-demand integrity check over the current registry state, independent
   * of discovery. The same checks run automatically at the end of every discover(). */
  checkIntegrity(): IntegrityIssue[] {
    return detectInventoryInconsistencies(this.registry.all());
  }

  /** Read surface for a future Platform Capability Registry to consume (PHASE-01 ADR-0002,
   * PHASE-03 §7) — formal registration into an implemented PCR is deferred until the PCR
   * itself is implemented; this is the data it will consume when it exists. */
  getCapabilityRegistrations(): { deviceId: string; capability: HardwareCapability }[] {
    return this.registry.all().flatMap((device) => device.capabilities.map((capability) => ({ deviceId: device.deviceId, capability })));
  }

  getDigitalTwin(deviceId: string): DigitalTwin {
    const device = this.registry.require(deviceId);
    const reliability = this.reliability.get(deviceId) ?? initialReliability(deviceId);
    return assembleDigitalTwin(device, reliability, this.benchmarks.summarize(deviceId));
  }

  getSuitability(deviceId: string, workload: HardwareCapability): SuitabilityScore {
    const device = this.registry.require(deviceId);
    const reliability = this.reliability.get(deviceId) ?? initialReliability(deviceId);
    return computeSuitability(device, workload, reliability, this.benchmarks.summarize(deviceId));
  }

  /** Architect's Enhancement — "which available hardware has the highest suitability
   * score for the requested workload," ranked descending. */
  rankForWorkload(workload: HardwareCapability): SuitabilityScore[] {
    return this.registry
      .byCapability(workload)
      .map((device) => this.getSuitability(device.deviceId, workload))
      .sort((a, b) => b.score - a.score);
  }

  subscribe(event: HardwareEventName, handler: (payload: unknown) => void): () => void {
    return this.events.subscribe(event, handler);
  }

  // ---- Authorized mutation workflows (§14 — mutation only through approved workflows) ----

  reserve(deviceId: string, reason: string, initiatingAuthority: string): DeviceRecord {
    const updated = this.applyRuntimeTransition(deviceId, 'reserved', reason, initiatingAuthority);
    this.events.publish(HARDWARE_EVENTS.DeviceReserved, { deviceId });
    return updated;
  }

  releaseReservation(deviceId: string, reason: string, initiatingAuthority: string): DeviceRecord {
    const updated = this.applyRuntimeTransition(deviceId, 'available', reason, initiatingAuthority);
    this.events.publish(HARDWARE_EVENTS.DeviceReleased, { deviceId });
    this.events.publish(HARDWARE_EVENTS.DeviceAvailable, { deviceId });
    return updated;
  }

  markState(deviceId: string, to: RuntimeState, reason: string, initiatingAuthority: string): DeviceRecord {
    const updated = this.applyRuntimeTransition(deviceId, to, reason, initiatingAuthority);
    if (to === 'available') this.events.publish(HARDWARE_EVENTS.DeviceAvailable, { deviceId });
    return updated;
  }

  recordFault(deviceId: string, reason: string, initiatingAuthority = 'Hardware Authority'): DeviceRecord {
    const updated = this.applyRuntimeTransition(deviceId, 'faulted', reason, initiatingAuthority);
    const reliability = this.reliability.get(deviceId) ?? initialReliability(deviceId);
    reliability.errorCount += 1;
    reliability.lastErrorAt = new Date().toISOString();
    reliability.stabilityScore = recomputeStabilityScore(reliability);
    this.reliability.set(deviceId, reliability);
    this.audit.record({
      timestamp: new Date().toISOString(),
      deviceId,
      kind: 'fault-detected',
      details: { reason },
      reason,
      initiatingAuthority,
    });
    this.events.publish(HARDWARE_EVENTS.HardwareFaultDetected, { deviceId, reason });
    return updated;
  }

  /** Recovery always lands in 'maintenance', never straight back to 'available' —
   * an institutional safety rule: a faulted device must pass through maintenance
   * before being offered for allocation again. */
  recordRecovery(deviceId: string, reason: string, initiatingAuthority = 'Hardware Authority'): DeviceRecord {
    const updated = this.applyRuntimeTransition(deviceId, 'maintenance', reason, initiatingAuthority);
    const reliability = this.reliability.get(deviceId) ?? initialReliability(deviceId);
    reliability.recoveryCount += 1;
    reliability.lastRecoveryAt = new Date().toISOString();
    reliability.stabilityScore = recomputeStabilityScore(reliability);
    this.reliability.set(deviceId, reliability);
    this.audit.record({
      timestamp: new Date().toISOString(),
      deviceId,
      kind: 'recovery-recorded',
      details: {},
      reason,
      initiatingAuthority,
    });
    return updated;
  }

  recordBenchmark(result: BenchmarkResult): void {
    this.registry.require(result.deviceId);
    this.benchmarks.record(result);

    const device = this.registry.require(result.deviceId);
    if (device.lifecycleStage === 'capability-assessed') {
      this.advanceLifecycle(result.deviceId, 'benchmarked', 'benchmark recorded', 'Hardware Authority');
      this.advanceLifecycle(result.deviceId, 'available', 'benchmark data now available', 'Hardware Authority');
    }

    this.audit.record({
      timestamp: new Date().toISOString(),
      deviceId: result.deviceId,
      kind: 'benchmark-recorded',
      details: { workload: result.workload, metric: result.metric, value: result.value, unit: result.unit },
    });
    this.events.publish(HARDWARE_EVENTS.BenchmarkCompleted, { deviceId: result.deviceId, workload: result.workload });
  }

  /** §9 Digital Twin "Allocation: current ownership" — records who the device is
   * allocated to, not just that it advanced to the 'allocated' lifecycle stage. */
  allocate(deviceId: string, ownerId: string, reason: string, initiatingAuthority: string): DeviceRecord {
    const advanced = this.advanceLifecycle(deviceId, 'allocated', reason, initiatingAuthority);
    const withAllocation: DeviceRecord = {
      ...advanced,
      allocation: { ownerId, ownerAuthority: initiatingAuthority, allocatedAt: new Date().toISOString(), reason },
    };
    this.registry.upsert(withAllocation);
    return withAllocation;
  }

  releaseAllocation(deviceId: string, reason: string, initiatingAuthority: string): DeviceRecord {
    const advanced = this.advanceLifecycle(deviceId, 'released', reason, initiatingAuthority);
    const withoutAllocation: DeviceRecord = { ...advanced, allocation: undefined };
    this.registry.upsert(withoutAllocation);
    return withoutAllocation;
  }

  retire(deviceId: string, reason: string, initiatingAuthority: string): DeviceRecord {
    this.advanceLifecycle(deviceId, 'retired', reason, initiatingAuthority);
    return this.applyRuntimeTransition(deviceId, 'offline', reason, initiatingAuthority);
  }

  // ---- Internal transition helpers ----

  private applyRuntimeTransition(deviceId: string, to: RuntimeState, reason: string, initiatingAuthority: string): DeviceRecord {
    const device = this.registry.require(deviceId);
    assertRuntimeTransition(device.runtimeState, to);
    const now = new Date().toISOString();
    const updated: DeviceRecord = { ...device, runtimeState: to, lastUpdated: now };
    this.registry.upsert(updated);
    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'state-transition',
      details: { from: device.runtimeState, to },
      reason,
      initiatingAuthority,
    });
    return updated;
  }

  private advanceLifecycle(deviceId: string, to: LifecycleStage, reason: string, initiatingAuthority: string): DeviceRecord {
    const device = this.registry.require(deviceId);
    assertLifecycleTransition(device.lifecycleStage, to);
    const now = new Date().toISOString();
    const updated: DeviceRecord = { ...device, lifecycleStage: to, lastUpdated: now };
    this.registry.upsert(updated);
    this.audit.record({
      timestamp: now,
      deviceId,
      kind: 'lifecycle-transition',
      details: { from: device.lifecycleStage, to },
      reason,
      initiatingAuthority,
    });
    return updated;
  }
}
