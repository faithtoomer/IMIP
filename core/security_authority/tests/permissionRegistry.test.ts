import { describe, expect, it } from 'vitest';
import { PermissionRegistry, DEFAULT_PERMISSIONS } from '../src/permissionRegistry.js';
import { DuplicatePermissionError, GrantNotFoundError, RoleNotFoundError, UnregisteredPermissionError } from '../src/errors.js';

describe('PermissionRegistry (§7/§9 — permissions, roles, grants)', () => {
  it('pre-seeds the spec\'s named example permissions', () => {
    const registry = new PermissionRegistry();
    expect(registry.hasPermission('configuration.modify')).toBe(true);
    expect(registry.hasPermission('mining.start')).toBe(true);
    expect(registry.hasPermission('secret.access')).toBe(true);
    expect(registry.allPermissions().length).toBe(DEFAULT_PERMISSIONS.length);
  });

  it('rejects a duplicate permission registration', () => {
    const registry = new PermissionRegistry();
    expect(() => registry.registerPermission({ permissionId: 'mining.start', category: 'mining', description: 'x' })).toThrow(
      DuplicatePermissionError,
    );
  });

  it('registerRole() requires every listed permission to already exist', () => {
    const registry = new PermissionRegistry();
    expect(() => registry.registerRole({ roleId: 'r1', description: 'x', permissionIds: ['not-real'] })).toThrow(
      UnregisteredPermissionError,
    );
  });

  it('grant() by direct permissionId makes hasEffectivePermission() true', () => {
    const registry = new PermissionRegistry();
    registry.grant({ grantId: 'g1', componentId: 'c1', permissionId: 'mining.start', grantedAt: new Date().toISOString(), grantedBy: 'X' });
    expect(registry.hasEffectivePermission('c1', 'mining.start', new Date())).toBe(true);
    expect(registry.hasEffectivePermission('c1', 'mining.stop', new Date())).toBe(false);
  });

  it('grant() by roleId grants every permission the role bundles', () => {
    const registry = new PermissionRegistry();
    registry.registerRole({ roleId: 'operator', description: 'x', permissionIds: ['mining.start', 'mining.stop'] });
    registry.grant({ grantId: 'g1', componentId: 'c1', roleId: 'operator', grantedAt: new Date().toISOString(), grantedBy: 'X' });
    expect(registry.hasEffectivePermission('c1', 'mining.start', new Date())).toBe(true);
    expect(registry.hasEffectivePermission('c1', 'mining.stop', new Date())).toBe(true);
  });

  it('an expired grant does not count as an effective permission', () => {
    const registry = new PermissionRegistry();
    registry.grant({
      grantId: 'g1',
      componentId: 'c1',
      permissionId: 'mining.start',
      grantedAt: new Date('2020-01-01').toISOString(),
      grantedBy: 'X',
      expiresAt: new Date('2020-01-02').toISOString(),
    });
    expect(registry.hasEffectivePermission('c1', 'mining.start', new Date())).toBe(false);
  });

  it('revokeGrant() removes the grant', () => {
    const registry = new PermissionRegistry();
    registry.grant({ grantId: 'g1', componentId: 'c1', permissionId: 'mining.start', grantedAt: new Date().toISOString(), grantedBy: 'X' });
    registry.revokeGrant('g1');
    expect(registry.hasEffectivePermission('c1', 'mining.start', new Date())).toBe(false);
    expect(() => registry.revokeGrant('g1')).toThrow(GrantNotFoundError);
  });

  it('grant() with an unregistered roleId throws', () => {
    const registry = new PermissionRegistry();
    expect(() =>
      registry.grant({ grantId: 'g1', componentId: 'c1', roleId: 'nonexistent', grantedAt: new Date().toISOString(), grantedBy: 'X' }),
    ).toThrow(RoleNotFoundError);
  });
});
