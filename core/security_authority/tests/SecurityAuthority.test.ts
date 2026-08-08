import { describe, expect, it } from 'vitest';
import { SecurityAuthority } from '../src/SecurityAuthority.js';
import { InstitutionalEventBus, MemoryEventPersistence } from '../../event_bus/src/index.js';
import { ObservabilityAuthority } from '../../observability_authority/src/index.js';
import { AccessDeniedError, SecretVaultNotConfiguredError } from '../src/errors.js';

describe('SecurityAuthority (Law 1/Law 2/Law 3/Law 4 — the sole security authority)', () => {
  it('an unregistered component is denied — Law 2 "Zero Implicit Trust"', () => {
    const ista = new SecurityAuthority();
    const decision = ista.authorize({ componentId: 'ghost', permissionId: 'mining.start', operation: 'start-mining' });
    expect(decision.approved).toBe(false);
    expect(decision.trustLevel).toBe('untrusted');
    expect(decision.reasons[0]).toMatch(/no trust record/i);
  });

  it('a trusted component with no grant is still denied — deny-by-default', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'certified', certificationStatus: 'certified', riskClassification: 'low' });
    const decision = ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'start-mining' });
    expect(decision.approved).toBe(false);
  });

  it('a trusted, granted component is approved', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'certified', certificationStatus: 'certified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator' });
    const decision = ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'start-mining' });
    expect(decision.approved).toBe(true);
  });

  it('an unregistered permissionId is AuthorizationFailed, distinct from a normal deny', () => {
    const ista = new SecurityAuthority();
    const decision = ista.authorize({ componentId: 'c1', permissionId: 'not-a-real-permission', operation: 'x' });
    expect(decision.approved).toBe(false);
    expect(decision.reasons[0]).toMatch(/unregistered permission/i);
  });

  it('role-based grants extend permissions to every component holding the role', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.registerRole({ roleId: 'operator', description: 'x', permissionIds: ['mining.start', 'mining.stop'] });
    ista.grant('c1', { roleId: 'operator', grantedBy: 'Operator' });
    expect(ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' }).approved).toBe(true);
    expect(ista.authorize({ componentId: 'c1', permissionId: 'mining.stop', operation: 'x' }).approved).toBe(true);
  });

  it('an expired grant no longer authorizes', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' }).approved).toBe(false);
  });

  it('a custom AttributePolicy (ABAC readiness) can still deny an otherwise-granted request', () => {
    const ista = new SecurityAuthority({
      attributePolicies: [{ name: 'business-hours', evaluate: () => ({ approved: false, reasons: ['outside approved hours'] }) }],
    });
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator' });
    const decision = ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' });
    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain('outside approved hours');
  });

  it('minimumTrustLevel gates authorization even with a valid grant', () => {
    const ista = new SecurityAuthority({ minimumTrustLevel: 'certified' });
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator' });
    expect(ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' }).approved).toBe(false);
  });

  it('revokeTrust() causes a previously-approved component to be denied', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'certified', certificationStatus: 'certified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator' });
    expect(ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' }).approved).toBe(true);

    ista.revokeTrust('c1', 'compromised', 'Operator');
    expect(ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' }).approved).toBe(false);
  });

  // ---- Secret management (§8, Law 4) ----

  it('storeSecret()/retrieveSecret() require secret.manage/secret.access respectively', () => {
    const ista = new SecurityAuthority({ masterKey: 'test-key' });
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });

    expect(() => ista.storeSecret('s1', 'api-key', 'real-value', 'c1')).toThrow(AccessDeniedError);

    ista.grant('c1', { permissionId: 'secret.manage', grantedBy: 'Operator' });
    ista.storeSecret('s1', 'api-key', 'real-value', 'c1');

    expect(() => ista.retrieveSecret('s1', 'c1')).toThrow(AccessDeniedError);

    ista.grant('c1', { permissionId: 'secret.access', grantedBy: 'Operator' });
    expect(ista.retrieveSecret('s1', 'c1')).toBe('real-value');
  });

  it('retrieveSecret() throws SecretVaultNotConfiguredError when no masterKey was supplied, even for an authorized caller', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'secret.access', grantedBy: 'Operator' });
    expect(() => ista.retrieveSecret('s1', 'c1')).toThrow(SecretVaultNotConfiguredError);
  });

  it('rotateSecret() changes the retrievable value', () => {
    const ista = new SecurityAuthority({ masterKey: 'test-key' });
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'secret.manage', grantedBy: 'Operator' });
    ista.grant('c1', { permissionId: 'secret.access', grantedBy: 'Operator' });
    ista.storeSecret('s1', 'api-key', 'v1', 'c1');
    ista.rotateSecret('s1', 'v2', 'c1');
    expect(ista.retrieveSecret('s1', 'c1')).toBe('v2');
  });

  // ---- Explainability, metrics, expiry, reporting ----

  it('explain() surfaces trust, grants, and recent audit records together', () => {
    const ista = new SecurityAuthority();
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator' });
    ista.authorize({ componentId: 'c1', permissionId: 'mining.start', operation: 'x' });

    const view = ista.explain('c1');
    expect(view.trust?.componentId).toBe('c1');
    expect(view.grants).toHaveLength(1);
    expect(view.recentAudit.length).toBeGreaterThan(0);
  });

  it('checkExpiredGrants() publishes CredentialExpired exactly once per newly-expired grant', () => {
    const ista = new SecurityAuthority();
    const seen: unknown[] = [];
    ista.events.subscribe('CredentialExpired', (payload) => seen.push(payload));
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    ista.grant('c1', { permissionId: 'mining.start', grantedBy: 'Operator', expiresAt: new Date(Date.now() - 1000).toISOString() });

    ista.checkExpiredGrants(['c1']);
    ista.checkExpiredGrants(['c1']); // second sweep must not re-notify
    expect(seen).toHaveLength(1);
  });

  it('reportSecurityViolation() increments the violation metric and records an audit entry', () => {
    const ista = new SecurityAuthority();
    ista.reportSecurityViolation('unexpected plugin behavior', 'plugin-x', 'IHIS');
    expect(ista.getMetrics().securityViolationCount).toBe(1);
    expect(ista.audit.forComponent('plugin-x')).toHaveLength(1);
  });

  it('getMetrics() tracks authorization counts and denials', () => {
    const ista = new SecurityAuthority();
    ista.authorize({ componentId: 'ghost', permissionId: 'mining.start', operation: 'x' });
    const metrics = ista.getMetrics();
    expect(metrics.authorizationCount).toBe(1);
    expect(metrics.authorizationDenials).toBe(1);
  });

  // ---- Real IEB / IOLA integration ----

  it('wires into a real InstitutionalEventBus under the reserved "security" category', async () => {
    const bus = new InstitutionalEventBus({ persistence: new MemoryEventPersistence() });
    const ista = new SecurityAuthority({ eventBus: bus });
    const seen: unknown[] = [];
    bus.subscribeToEvent(
      'TrustEstablished',
      (envelope) => {
        seen.push(envelope.payload);
      },
      { subscriberAuthority: 'Test' },
    );

    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    await ista.events.flushMirror(); // mirroring is fire-and-forget — wait for it before asserting
    expect(seen).toHaveLength(1);
    expect(bus.getEventDefinition('TrustEstablished')?.category).toBe('security');
  });

  it('wires into a real ObservabilityAuthority: security events are logged under category "security"', () => {
    const iola = new ObservabilityAuthority();
    const ista = new SecurityAuthority({ observabilityAuthority: iola });
    ista.registerTrust({ componentId: 'c1', componentType: 'authority', identity: 'X', trustLevel: 'basic', certificationStatus: 'uncertified', riskClassification: 'low' });
    const logged = iola.search((record) => record.category === 'security' && record.operation === 'TrustEstablished');
    expect(logged).toHaveLength(1);
  });

  it('an observability sink failure never breaks a real authorization decision', () => {
    const brokenSink = {
      name: 'broken',
      write: () => {
        throw new Error('sink down');
      },
    };
    const iola = new ObservabilityAuthority({ sinks: [brokenSink] });
    const ista = new SecurityAuthority({ observabilityAuthority: iola });
    expect(() => ista.authorize({ componentId: 'ghost', permissionId: 'mining.start', operation: 'x' })).not.toThrow();
  });
});
