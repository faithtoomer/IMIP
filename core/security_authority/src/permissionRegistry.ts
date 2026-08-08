import { DuplicatePermissionError, GrantNotFoundError, RoleNotFoundError, UnregisteredPermissionError } from './errors.js';
import type { Grant, PermissionDefinition, Role } from './types.js';

/** §7 — the real permission examples the spec names, seeded into the
 * registry (not hardcoded into the authorization logic itself) — the same
 * "real, from the spec, registered not fabricated" posture as every other
 * default catalog in this platform (IOLA's 19 log categories, etc.). */
export const DEFAULT_PERMISSIONS: PermissionDefinition[] = [
  { permissionId: 'configuration.read', category: 'configuration', description: 'Read configuration values.' },
  { permissionId: 'configuration.modify', category: 'configuration', description: 'Modify configuration values.' },
  { permissionId: 'plugin.register', category: 'plugin', description: 'Register a plugin.' },
  { permissionId: 'plugin.enable', category: 'plugin', description: 'Enable a plugin.' },
  { permissionId: 'plugin.disable', category: 'plugin', description: 'Disable a plugin.' },
  { permissionId: 'hardware.read', category: 'hardware', description: 'Read hardware inventory/state.' },
  { permissionId: 'hardware.reserve', category: 'hardware', description: 'Reserve hardware for exclusive use.' },
  { permissionId: 'runtime.restart', category: 'runtime', description: 'Restart the platform runtime.' },
  { permissionId: 'runtime.shutdown', category: 'runtime', description: 'Shut down the platform runtime.' },
  { permissionId: 'runtime.maintenance', category: 'runtime', description: 'Place the runtime into maintenance mode.' },
  { permissionId: 'mining.start', category: 'mining', description: 'Start a mining operation.' },
  { permissionId: 'mining.stop', category: 'mining', description: 'Stop a mining operation.' },
  { permissionId: 'secret.access', category: 'secret', description: 'Retrieve a secret from the Secret Vault.' },
  { permissionId: 'secret.manage', category: 'secret', description: 'Store or rotate a secret in the Secret Vault.' },
];

/** §7/§9 — the Permission Registry plus the Role/Grant primitives RBAC is
 * built on. */
export class PermissionRegistry {
  private permissions = new Map<string, PermissionDefinition>();
  private roles = new Map<string, Role>();
  private grants = new Map<string, Grant>();

  constructor(seed: PermissionDefinition[] = DEFAULT_PERMISSIONS) {
    for (const permission of seed) this.permissions.set(permission.permissionId, permission);
  }

  registerPermission(permission: PermissionDefinition): void {
    if (this.permissions.has(permission.permissionId)) throw new DuplicatePermissionError(permission.permissionId);
    this.permissions.set(permission.permissionId, permission);
  }

  hasPermission(permissionId: string): boolean {
    return this.permissions.has(permissionId);
  }

  requirePermission(permissionId: string): PermissionDefinition {
    const permission = this.permissions.get(permissionId);
    if (!permission) throw new UnregisteredPermissionError(permissionId);
    return permission;
  }

  allPermissions(): PermissionDefinition[] {
    return [...this.permissions.values()];
  }

  registerRole(role: Role): void {
    for (const permissionId of role.permissionIds) this.requirePermission(permissionId);
    this.roles.set(role.roleId, role);
  }

  requireRole(roleId: string): Role {
    const role = this.roles.get(roleId);
    if (!role) throw new RoleNotFoundError(roleId);
    return role;
  }

  grant(grant: Grant): void {
    if (grant.permissionId) this.requirePermission(grant.permissionId);
    if (grant.roleId) this.requireRole(grant.roleId);
    this.grants.set(grant.grantId, grant);
  }

  revokeGrant(grantId: string): Grant {
    const grant = this.grants.get(grantId);
    if (!grant) throw new GrantNotFoundError(grantId);
    this.grants.delete(grantId);
    return grant;
  }

  grantsFor(componentId: string): Grant[] {
    return [...this.grants.values()].filter((grant) => grant.componentId === componentId);
  }

  /** §9 — resolves whether `componentId` holds `permissionId` right now,
   * either directly or via a role, ignoring expired grants. */
  hasEffectivePermission(componentId: string, permissionId: string, at: Date): boolean {
    const now = at.getTime();
    for (const grant of this.grantsFor(componentId)) {
      if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= now) continue;
      if (grant.permissionId === permissionId) return true;
      if (grant.roleId) {
        const role = this.roles.get(grant.roleId);
        if (role?.permissionIds.includes(permissionId)) return true;
      }
    }
    return false;
  }
}
