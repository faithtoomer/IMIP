import { describe, expect, it } from 'vitest';
import { SecurityAuthority } from '../src/SecurityAuthority.js';

describe('performance smoke tests', () => {
  it('performs 500 authorization checks well under 1s', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'certified', certificationStatus: 'certified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator' });

    const start = performance.now();
    for (let i = 0; i < 500; i += 1) {
      ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' });
    }
    expect(performance.now() - start).toBeLessThan(1000);
    expect(ista.getMetrics().authorizationCount).toBe(500);
  });

  it('stores and retrieves 200 secrets well under 1s', () => {
    const ista = new SecurityAuthority({ masterKey: 'test-key' });
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'secret.manage', grantedBy: 'Operator' });
    ista.grant('c1', { permissionId: 'secret.access', grantedBy: 'Operator' });

    const start = performance.now();
    for (let i = 0; i < 200; i += 1) {
      ista.storeSecret(`s${i}`, 'api-key', `value-${i}`, 'c1');
      ista.retrieveSecret(`s${i}`, 'c1');
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
