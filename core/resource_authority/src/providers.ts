import type { HealthStatus, ResourceType } from './types.js';

export interface HardwareInventoryUnit {
  hardwareId: string;
  resourceType: ResourceType;
  maximumCapacity: number;
  capabilityRefs: string[];
  healthStatus: HealthStatus;
}

export interface HardwareInventoryProvider {
  listAllocatableUnits(): HardwareInventoryUnit[] | Promise<HardwareInventoryUnit[]>;
}

export interface PowerConstraintProvider {
  isPowerBlocking?(hardwareId: string): boolean;
  powerProfileRef?(hardwareId: string): string | undefined;
}

export interface ThermalConstraintProvider {
  isThermalBlocking?(hardwareId: string): boolean;
  thermalProfileRef?(hardwareId: string): string | undefined;
}

export class NullHardwareInventoryProvider implements HardwareInventoryProvider {
  listAllocatableUnits(): HardwareInventoryUnit[] {
    return [];
  }
}

export class MapHardwareInventoryProvider implements HardwareInventoryProvider {
  constructor(private readonly units: HardwareInventoryUnit[]) {}

  listAllocatableUnits(): HardwareInventoryUnit[] {
    return [...this.units];
  }
}

export class InjectableHardwareInventoryProvider implements HardwareInventoryProvider {
  constructor(private readonly fn: () => HardwareInventoryUnit[] | Promise<HardwareInventoryUnit[]>) {}

  listAllocatableUnits(): HardwareInventoryUnit[] | Promise<HardwareInventoryUnit[]> {
    return this.fn();
  }
}

export class NullPowerConstraintProvider implements PowerConstraintProvider {
  isPowerBlocking(): boolean {
    return false;
  }

  powerProfileRef(): string | undefined {
    return undefined;
  }
}

export class MapPowerConstraintProvider implements PowerConstraintProvider {
  constructor(
    private readonly blocking = new Map<string, boolean>(),
    private readonly profiles = new Map<string, string>(),
  ) {}

  isPowerBlocking(hardwareId: string): boolean {
    return this.blocking.get(hardwareId) ?? false;
  }

  powerProfileRef(hardwareId: string): string | undefined {
    return this.profiles.get(hardwareId);
  }
}

export class InjectablePowerConstraintProvider implements PowerConstraintProvider {
  constructor(
    private readonly blockingFn: (hardwareId: string) => boolean = () => false,
    private readonly profileFn: (hardwareId: string) => string | undefined = () => undefined,
  ) {}

  isPowerBlocking(hardwareId: string): boolean {
    return this.blockingFn(hardwareId);
  }

  powerProfileRef(hardwareId: string): string | undefined {
    return this.profileFn(hardwareId);
  }
}

export class NullThermalConstraintProvider implements ThermalConstraintProvider {
  isThermalBlocking(): boolean {
    return false;
  }

  thermalProfileRef(): string | undefined {
    return undefined;
  }
}

export class MapThermalConstraintProvider implements ThermalConstraintProvider {
  constructor(
    private readonly blocking = new Map<string, boolean>(),
    private readonly profiles = new Map<string, string>(),
  ) {}

  isThermalBlocking(hardwareId: string): boolean {
    return this.blocking.get(hardwareId) ?? false;
  }

  thermalProfileRef(hardwareId: string): string | undefined {
    return this.profiles.get(hardwareId);
  }
}

export class InjectableThermalConstraintProvider implements ThermalConstraintProvider {
  constructor(
    private readonly blockingFn: (hardwareId: string) => boolean = () => false,
    private readonly profileFn: (hardwareId: string) => string | undefined = () => undefined,
  ) {}

  isThermalBlocking(hardwareId: string): boolean {
    return this.blockingFn(hardwareId);
  }

  thermalProfileRef(hardwareId: string): string | undefined {
    return this.profileFn(hardwareId);
  }
}
