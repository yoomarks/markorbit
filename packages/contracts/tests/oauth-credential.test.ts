import { describe, expect, it } from 'vitest';
import {
  parseExternalOAuthCredentialBindingV1,
  parseExternalOAuthCredentialRefV1,
  parseExternalOAuthCredentialVerificationV1
} from '../src/oauth-credential.js';

const authority = {
  protectedActionAuthorized: false,
  externalActionAuthorized: false,
  publishAuthorized: false,
  messageSendAuthorized: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  externalIdentityLegallyVerified: false
} as const;

const binding = {
  schemaVersion: 1,
  credentialBindingId: 'oauth-credential-binding_test-1',
  version: 3,
  workspaceId: 'workspace_test',
  provider: 'MICROSOFT_GRAPH',
  oauthClientProfileRef: { id: 'profile_ms_graph', version: '1' },
  externalAccountRef: 'graph-user-1',
  grantedScopes: ['Mail.Read', 'Mail.Send'],
  grantor: { userId: 'user_test', membershipId: 'membership_test', membershipVersion: 4 },
  lifecycle: 'ACTIVE',
  refreshCapability: 'AVAILABLE',
  accessExpiresAt: '2026-09-11T02:00:00.000Z',
  grantedAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-11T00:00:00.000Z',
  authority
} as const;

describe('external OAuth credential contract', () => {
  it('accepts safe opaque credential metadata with no business authority', () => {
    const parsed = parseExternalOAuthCredentialBindingV1(binding);
    expect(parsed).toMatchObject({
      credentialBindingId: binding.credentialBindingId,
      workspaceId: binding.workspaceId,
      provider: binding.provider,
      grantedScopes: binding.grantedScopes,
      lifecycle: 'ACTIVE',
      authority
    });
  });

  it('accepts only CORE_IDENTITY opaque refs', () => {
    expect(
      parseExternalOAuthCredentialRefV1({
        owner: 'CORE_IDENTITY',
        credentialBindingId: binding.credentialBindingId,
        version: 3
      })
    ).toEqual({
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: 3
    });
  });

  it.each([
    ['accessToken', 'secret-access'],
    ['refreshToken', 'secret-refresh'],
    ['authorizationCode', 'secret-code'],
    ['clientSecret', 'secret-client'],
    ['pkceVerifier', 'secret-pkce'],
    ['ciphertext', 'secret-ciphertext'],
    ['nonce', 'secret-nonce'],
    ['authTag', 'secret-tag']
  ] as const)('rejects forbidden secret material: %s', (key, value) => {
    expect(() =>
      parseExternalOAuthCredentialBindingV1({
        ...binding,
        [key]: value
      })
    ).toThrow('forbidden secret material');
  });

  it('rejects authority escalation and generic escape hatches', () => {
    expect(() =>
      parseExternalOAuthCredentialBindingV1({
        ...binding,
        authority: { ...authority, publishAuthorized: true }
      })
    ).toThrow('authority.publishAuthorized must be false');
    expect(() =>
      parseExternalOAuthCredentialBindingV1({ ...binding, metadata: { anything: true } })
    ).toThrow('unsupported fields');
  });

  it('separates verification uncertainty from durable lifecycle', () => {
    expect(
      parseExternalOAuthCredentialVerificationV1({
        schemaVersion: 1,
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: binding.version
        },
        status: 'UNAVAILABLE',
        observedAt: '2026-09-11T00:05:00.000Z',
        reasonCode: 'PROVIDER_TIMEOUT'
      })
    ).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'PROVIDER_TIMEOUT' });
  });

  it('requires lifecycle-specific timestamps and rejects stale secret-shaped refs', () => {
    expect(() =>
      parseExternalOAuthCredentialBindingV1({ ...binding, lifecycle: 'REVOKED' })
    ).toThrow('REVOKED binding requires revokedAt');
    expect(() =>
      parseExternalOAuthCredentialRefV1({
        owner: 'CORE_IDENTITY',
        credentialBindingId: binding.credentialBindingId,
        version: binding.version,
        accessToken: 'never'
      })
    ).toThrow('forbidden secret material');
  });
});
