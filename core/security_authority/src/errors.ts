export class SecurityAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SecurityAuthorityError';
    this.code = code;
  }
}

export class TrustNotFoundError extends SecurityAuthorityError {
  constructor(componentId: string) {
    super('SECURITY_TRUST_NOT_FOUND', `No trust record for component "${componentId}".`);
    this.name = 'TrustNotFoundError';
  }
}

export class DuplicateTrustError extends SecurityAuthorityError {
  constructor(componentId: string) {
    super('SECURITY_DUPLICATE_TRUST', `Component "${componentId}" already has a trust record.`);
    this.name = 'DuplicateTrustError';
  }
}

export class UnregisteredPermissionError extends SecurityAuthorityError {
  constructor(permissionId: string) {
    super('SECURITY_UNREGISTERED_PERMISSION', `"${permissionId}" is not a registered permission.`);
    this.name = 'UnregisteredPermissionError';
  }
}

export class DuplicatePermissionError extends SecurityAuthorityError {
  constructor(permissionId: string) {
    super('SECURITY_DUPLICATE_PERMISSION', `Permission "${permissionId}" is already registered.`);
    this.name = 'DuplicatePermissionError';
  }
}

export class RoleNotFoundError extends SecurityAuthorityError {
  constructor(roleId: string) {
    super('SECURITY_ROLE_NOT_FOUND', `No role "${roleId}" is registered.`);
    this.name = 'RoleNotFoundError';
  }
}

export class GrantNotFoundError extends SecurityAuthorityError {
  constructor(grantId: string) {
    super('SECURITY_GRANT_NOT_FOUND', `No grant "${grantId}" is registered.`);
    this.name = 'GrantNotFoundError';
  }
}

export class AccessDeniedError extends SecurityAuthorityError {
  constructor(componentId: string, permissionId: string, reasons: string[]) {
    super('SECURITY_ACCESS_DENIED', `Access denied for "${componentId}" requesting "${permissionId}": ${reasons.join('; ')}`);
    this.name = 'AccessDeniedError';
  }
}

export class SecretVaultNotConfiguredError extends SecurityAuthorityError {
  constructor() {
    super('SECURITY_VAULT_NOT_CONFIGURED', 'The Secret Vault has no master key configured — secret storage/retrieval is unavailable.');
    this.name = 'SecretVaultNotConfiguredError';
  }
}

export class SecretNotFoundError extends SecurityAuthorityError {
  constructor(secretId: string) {
    super('SECURITY_SECRET_NOT_FOUND', `No secret "${secretId}" is stored.`);
    this.name = 'SecretNotFoundError';
  }
}
