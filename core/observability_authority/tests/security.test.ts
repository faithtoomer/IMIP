import { describe, expect, it } from 'vitest';
import { maskSensitiveContext, REDACTED } from '../src/security.js';

describe('maskSensitiveContext() (§14/Law 5)', () => {
  it('redacts common sensitive key patterns unconditionally', () => {
    const masked = maskSensitiveContext({
      password: 'hunter2',
      apiKey: 'sk-abc',
      walletPrivateKey: '0xdead',
      token: 'jwt.token.here',
      username: 'alice',
    });
    expect(masked?.password).toBe(REDACTED);
    expect(masked?.apiKey).toBe(REDACTED);
    expect(masked?.walletPrivateKey).toBe(REDACTED);
    expect(masked?.token).toBe(REDACTED);
    expect(masked?.username).toBe('alice');
  });

  it('is a no-op for undefined context', () => {
    expect(maskSensitiveContext(undefined)).toBeUndefined();
  });

  it('supports caller-supplied extra sensitive key patterns', () => {
    const masked = maskSensitiveContext({ internalRigId: 'rig-42' }, ['rigId']);
    expect(masked?.internalRigId).toBe(REDACTED);
  });

  it('leaves non-matching keys untouched', () => {
    const masked = maskSensitiveContext({ hashrate: 123, poolUrl: 'stratum+tcp://x' });
    expect(masked).toEqual({ hashrate: 123, poolUrl: 'stratum+tcp://x' });
  });
});
