export class CertificationError extends Error {
  override name = 'CertificationError';
}

export class CertificationValidationError extends CertificationError {
  override name = 'CertificationValidationError';
}

export class CertificationNotFoundError extends CertificationError {
  override name = 'CertificationNotFoundError';
}

export class CertificationLifecycleError extends CertificationError {
  override name = 'CertificationLifecycleError';

  constructor(from: string | undefined, to: string) {
    super(`Invalid certification lifecycle transition from ${from ?? 'none'} to ${to}.`);
  }
}

export class EvidenceImmutabilityError extends CertificationError {
  override name = 'EvidenceImmutabilityError';
}
