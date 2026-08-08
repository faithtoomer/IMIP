export class ResourceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ResourceError';
    this.code = code;
  }
}

export class ResourceNotFoundError extends ResourceError {
  readonly resourceId: string;

  constructor(resourceId: string) {
    super('RESOURCE_NOT_FOUND', `Unknown resource: "${resourceId}"`);
    this.name = 'ResourceNotFoundError';
    this.resourceId = resourceId;
  }
}

export class DoubleAllocationError extends ResourceError {
  readonly resourceId: string;

  constructor(resourceId: string, message?: string) {
    super('RESOURCE_DOUBLE_ALLOCATION', message ?? `Resource "${resourceId}" already has an active exclusive allocation.`);
    this.name = 'DoubleAllocationError';
    this.resourceId = resourceId;
  }
}

export class ReservationConflictError extends ResourceError {
  readonly resourceId: string;

  constructor(resourceId: string, message?: string) {
    super('RESOURCE_RESERVATION_CONFLICT', message ?? `Reservation conflict on resource "${resourceId}".`);
    this.name = 'ReservationConflictError';
    this.resourceId = resourceId;
  }
}

export class CapacityOvercommitError extends ResourceError {
  readonly resourceId: string;

  constructor(resourceId: string, requested: number, available: number) {
    super(
      'RESOURCE_CAPACITY_OVERCOMMIT',
      `Capacity overcommit on "${resourceId}": requested ${requested}, available ${available}.`,
    );
    this.name = 'CapacityOvercommitError';
    this.resourceId = resourceId;
  }
}

export class InvalidOwnershipError extends ResourceError {
  readonly resourceId: string;

  constructor(resourceId: string, message?: string) {
    super('RESOURCE_INVALID_OWNERSHIP', message ?? `Invalid ownership on resource "${resourceId}".`);
    this.name = 'InvalidOwnershipError';
    this.resourceId = resourceId;
  }
}

export class IllegalStateTransitionError extends ResourceError {
  constructor(from: string, to: string) {
    super('RESOURCE_ILLEGAL_STATE_TRANSITION', `Illegal resource state transition: "${from}" -> "${to}".`);
    this.name = 'IllegalStateTransitionError';
  }
}
