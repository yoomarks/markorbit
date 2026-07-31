import { describe, expect, it } from 'vitest';
import {
  clearSessionCookie,
  csrfToken,
  readSessionCookie,
  requireTrustedOrigin,
  sessionCookie,
  validateCsrf
} from '../src/auth.js';
describe('Gateway browser authentication boundary', () => {
  it('sets and clears the canonical HttpOnly cookie', () => {
    expect(sessionCookie('opaque', 300, true)).toBe(
      'mo_session=opaque; Max-Age=300; Path=/; HttpOnly; SameSite=Lax; Secure'
    );
    expect(clearSessionCookie(false)).toContain('Max-Age=0');
    expect(readSessionCookie('a=b; mo_session=opaque')).toBe('opaque');
  });
  it('binds a distinct CSRF token to the session', () => {
    const secret = 's'.repeat(32),
      token = csrfToken('session', secret);
    expect(token).not.toBe('session');
    expect(() => validateCsrf('session', secret, token)).not.toThrow();
    expect(() => validateCsrf('session', secret, 'wrong')).toThrow();
  });
  it('requires an explicit trusted origin', () => {
    expect(() =>
      requireTrustedOrigin('https://app.example', ['https://app.example'])
    ).not.toThrow();
    expect(() => requireTrustedOrigin(undefined, ['https://app.example'])).toThrow();
    expect(() => requireTrustedOrigin('https://evil.example', ['https://app.example'])).toThrow();
  });
});
