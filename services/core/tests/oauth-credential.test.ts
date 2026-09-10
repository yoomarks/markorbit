import { describe, expect, it, vi } from 'vitest';
import type {
  ExternalOAuthCredentialBindingV1,
  ExternalOAuthCredentialRefV1,
  WorkspacePrincipal
} from '@markorbit/contracts';
import type { CurrentWorkspaceAuthorityService } from '../src/current-workspace-authority.js';
import {
  OAuthCredentialServiceV1,
  OAuthProviderDriverError,
  OAuthProviderRegistryV1,
  type OAuthCredentialRepositoryV1,
  type OAuthPendingGrantV1,
  type OAuthProviderGrantV1,
  type OAuthStoredCredentialV1
} from '../src/oauth-credential.js';
import {
  OAuthCredentialKeyringV1,
  type EncryptedOAuthSecretV1
} from '../src/oauth-credential-crypto.js';

const workspaceId = '018f0000-0000-7000-8000-000000001134';
const otherWorkspaceId = '018f0000-0000-7000-8000-000000001135';
const userId = '018f0000-0000-7000-8000-000000001136';
const membershipId = '018f0000-0000-7000-8000-000000001137';
const provider = 'MICROSOFT_GRAPH';
const profile = { id: 'microsoft-graph-default', version: '1' } as const;

class InMemoryOAuthCredentialRepository implements OAuthCredentialRepositoryV1 {
  readonly grants = new Map<string, OAuthPendingGrantV1>();
  readonly credentials = new Map<string, OAuthStoredCredentialV1>();

  createGrantAttempt(input: Readonly<OAuthPendingGrantV1>): Promise<void> {
    this.grants.set(input.stateHashSha256, structuredClone(input));
    return Promise.resolve();
  }

  findGrantAttemptByStateHash(
    stateHashSha256: string
  ): Promise<Readonly<OAuthPendingGrantV1> | undefined> {
    return Promise.resolve(structuredClone(this.grants.get(stateHashSha256)));
  }

  consumeGrantAttempt(
    input: Readonly<{
      grantAttemptId: string;
      stateHashSha256: string;
      consumedAt: string;
    }>
  ): Promise<boolean> {
    const current = this.grants.get(input.stateHashSha256);
    if (!current || current.grantAttemptId !== input.grantAttemptId || current.consumedAt)
      return Promise.resolve(false);
    this.grants.set(input.stateHashSha256, { ...current, consumedAt: input.consumedAt });
    return Promise.resolve(true);
  }

  createCredential(
    input: Readonly<OAuthStoredCredentialV1>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    this.credentials.set(input.binding.credentialBindingId, structuredClone(input));
    return Promise.resolve(structuredClone(input.binding));
  }

  findCredential(
    credentialBindingId: string
  ): Promise<Readonly<OAuthStoredCredentialV1> | undefined> {
    return Promise.resolve(structuredClone(this.credentials.get(credentialBindingId)));
  }

  withRefreshLock<T>(_credentialBindingId: string, callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  rotateSecret(
    input: Readonly<{
      credentialBindingId: string;
      expectedSecretGeneration: number;
      nextSecret: Readonly<EncryptedOAuthSecretV1>;
      accessExpiresAt: string;
      refreshCapability: 'AVAILABLE' | 'NOT_AVAILABLE' | 'UNKNOWN';
      updatedAt: string;
    }>
  ): Promise<number> {
    const current = this.credentials.get(input.credentialBindingId);
    if (!current || current.secretGeneration !== input.expectedSecretGeneration)
      return Promise.reject(new Error('secret generation conflict'));
    const nextGeneration = current.secretGeneration + 1;
    this.credentials.set(input.credentialBindingId, {
      binding: {
        ...current.binding,
        accessExpiresAt: input.accessExpiresAt,
        refreshCapability: input.refreshCapability,
        updatedAt: input.updatedAt
      },
      secretGeneration: nextGeneration,
      secret: structuredClone(input.nextSecret)
    });
    return Promise.resolve(nextGeneration);
  }

  transitionLifecycle(
    input: Readonly<{
      credential: Readonly<ExternalOAuthCredentialRefV1>;
      lifecycle: 'EXPIRED' | 'REAUTH_REQUIRED' | 'REVOKED';
      at: string;
    }>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    const current = this.credentials.get(input.credential.credentialBindingId);
    if (!current || current.binding.version !== input.credential.version)
      return Promise.reject(new Error('binding version conflict'));
    const binding: ExternalOAuthCredentialBindingV1 = {
      ...current.binding,
      version: current.binding.version + 1,
      lifecycle: input.lifecycle,
      updatedAt: input.at,
      ...(input.lifecycle === 'REVOKED' ? { revokedAt: input.at } : {}),
      ...(input.lifecycle === 'REAUTH_REQUIRED' ? { reauthRequiredAt: input.at } : {})
    };
    this.credentials.set(input.credential.credentialBindingId, { ...current, binding });
    return Promise.resolve(structuredClone(binding));
  }
}

function principal(workspace = workspaceId): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_oauth_test',
    userId,
    workspaceId: workspace,
    membershipId,
    role: 'WORKSPACE_ADMIN',
    permissions: ['workspace:read', 'workspace:manage'],
    sessionExpiresAt: '2026-09-12T00:00:00.000Z'
  };
}

function currentAuthority() {
  const validate = vi.fn((request: Parameters<CurrentWorkspaceAuthorityService['validate']>[0]) =>
    Promise.resolve({
      schemaVersion: 1 as const,
      authorityAvailable: true as const,
      workspaceCurrent: true as const,
      userCurrent: true as const,
      membershipCurrent: true as const,
      bindingMatches: true as const,
      permissionCurrent: request.requiredPermission ? (true as const) : null,
      workspace: { workspaceId: request.workspaceId, version: 2 },
      user: { userId: request.userId, version: 3 },
      membership: {
        membershipId: request.membershipId,
        workspaceId: request.workspaceId,
        userId: request.userId,
        role: 'WORKSPACE_ADMIN',
        version: 4
      },
      requiredPermission: request.requiredPermission ?? null
    })
  );
  return { validate } satisfies Pick<CurrentWorkspaceAuthorityService, 'validate'>;
}

function keyring() {
  return new OAuthCredentialKeyringV1({
    activeKeyId: 'test-key-v1',
    keys: { 'test-key-v1': Buffer.alloc(32, 7) }
  });
}

function createHarness() {
  const repository = new InMemoryOAuthCredentialRepository();
  const authority = currentAuthority();
  let nowMs = Date.parse('2026-09-11T00:00:00.000Z');
  const exchangeAuthorizationCode = vi.fn((): Promise<Readonly<OAuthProviderGrantV1>> =>
    Promise.resolve({
      accessToken: 'initial-access-token',
      refreshToken: 'initial-refresh-token',
      accessExpiresAt: '2026-09-11T00:10:00.000Z',
      externalAccountRef: 'graph-user-1134',
      grantedScopes: ['Mail.Read', 'Mail.Send']
    })
  );
  const refresh = vi.fn(() =>
    Promise.resolve({
      accessToken: 'rotated-access-token',
      accessExpiresAt: '2026-09-11T02:00:00.000Z',
      refreshTokenDisposition: 'REPLACE' as const,
      refreshToken: 'rotated-refresh-token'
    })
  );
  const revoke = vi.fn(() => Promise.resolve());
  const driver = {
    provider,
    oauthClientProfileRef: profile,
    allowedScopes: ['Mail.Read', 'Mail.Send'],
    supportsPkceS256: true,
    buildAuthorizationUrl: ({
      state,
      codeChallenge
    }: {
      state: string;
      codeChallenge?: string;
    }) => {
      const url = new URL('https://login.example.test/oauth2/authorize');
      url.searchParams.set('state', state);
      if (codeChallenge) url.searchParams.set('code_challenge', codeChallenge);
      return url.toString();
    },
    exchangeAuthorizationCode,
    refresh,
    revoke
  };
  const service = new OAuthCredentialServiceV1({
    repository,
    currentWorkspaceAuthority: authority,
    providers: new OAuthProviderRegistryV1([driver]),
    keyring: keyring(),
    clock: () => new Date(nowMs)
  });
  return {
    repository,
    authority,
    service,
    exchangeAuthorizationCode,
    refresh,
    revoke,
    setNow(value: string) {
      nowMs = Date.parse(value);
    }
  };
}

async function connect(harness: ReturnType<typeof createHarness>) {
  const begin = await harness.service.beginGrant(principal(), {
    provider,
    oauthClientProfileRef: profile,
    requestedScopes: ['Mail.Read', 'Mail.Send']
  });
  const state = new URL(begin.authorizationUrl).searchParams.get('state');
  if (!state) throw new Error('Expected OAuth state.');
  const binding = await harness.service.completeGrant(principal(), {
    state,
    authorizationCode: 'authorization-code-test-only'
  });
  return { binding, state, begin };
}

describe('Core OAuth credential owner', () => {
  it('binds one-time state and PKCE to current Workspace authority without exposing secrets', async () => {
    const h = createHarness();
    const { binding, state, begin } = await connect(h);
    expect(new URL(begin.authorizationUrl).searchParams.get('code_challenge')).toBeTruthy();
    expect(h.authority.validate).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: 'workspace:manage' })
    );
    expect(binding.authority).toEqual({
      protectedActionAuthorized: false,
      externalActionAuthorized: false,
      publishAuthorized: false,
      messageSendAuthorized: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      externalIdentityLegallyVerified: false
    });
    expect(JSON.stringify(binding)).not.toContain('initial-access-token');
    expect(JSON.stringify(binding)).not.toContain('initial-refresh-token');
    const grant = [...h.repository.grants.values()][0];
    expect(grant?.stateHashSha256).not.toBe(state);
    expect(JSON.stringify(grant)).not.toContain(state);
    const stored = h.repository.credentials.get(binding.credentialBindingId);
    expect(stored?.secret.ciphertextBase64).not.toContain('initial-access-token');
    expect(stored?.secretGeneration).toBe(1);
  });

  it('rejects callback replay and cross-Workspace callback context', async () => {
    const h = createHarness();
    const { state } = await connect(h);
    await expect(
      h.service.completeGrant(principal(), {
        state,
        authorizationCode: 'authorization-code-replay'
      })
    ).rejects.toMatchObject({ code: 'OAUTH_GRANT_REPLAYED' });

    const other = createHarness();
    const begin = await other.service.beginGrant(principal(), {
      provider,
      oauthClientProfileRef: profile,
      requestedScopes: ['Mail.Read']
    });
    const state2 = new URL(begin.authorizationUrl).searchParams.get('state')!;
    await expect(
      other.service.completeGrant(principal(otherWorkspaceId), {
        state: state2,
        authorizationCode: 'authorization-code-cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH' });
  });

  it('returns only an ephemeral access token for exact trusted adapter context', async () => {
    const h = createHarness();
    const { binding } = await connect(h);
    const credential = {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: binding.version
    } as const;
    await expect(
      h.service.resolveAccessToken({
        credential,
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).resolves.toEqual({
      accessToken: 'initial-access-token',
      expiresAt: '2026-09-11T00:10:00.000Z',
      credentialBindingId: binding.credentialBindingId,
      bindingVersion: 1
    });
  });

  it.each([
    ['expectedWorkspaceId', otherWorkspaceId, 'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH'],
    ['expectedProvider', 'LINKEDIN', 'OAUTH_CREDENTIAL_PROVIDER_MISMATCH'],
    ['expectedExternalAccountRef', 'other-account', 'OAUTH_CREDENTIAL_ACCOUNT_MISMATCH']
  ] as const)('fails closed for trusted context mismatch: %s', async (field, value, code) => {
    const h = createHarness();
    const { binding } = await connect(h);
    const credential = {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: binding.version
    } as const;
    const request = {
      credential,
      expectedWorkspaceId: workspaceId,
      expectedProvider: provider,
      expectedExternalAccountRef: 'graph-user-1134',
      requiredScopes: ['Mail.Read']
    };
    await expect(
      h.service.resolveAccessToken({ ...request, [field]: value })
    ).rejects.toMatchObject({ code });
  });

  it('fails closed when an actual granted scope is missing', async () => {
    const h = createHarness();
    const { binding } = await connect(h);
    await expect(
      h.service.resolveAccessToken({
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 1
        },
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Calendars.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_SCOPE_MISSING' });
  });

  it('rotates owner-private secrets without changing public binding semantic version', async () => {
    const h = createHarness();
    const { binding } = await connect(h);
    h.setNow('2026-09-11T00:20:00.000Z');
    const credential = {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: binding.version
    } as const;
    await expect(
      h.service.resolveAccessToken({
        credential,
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Send']
      })
    ).resolves.toMatchObject({
      accessToken: 'rotated-access-token',
      bindingVersion: 1
    });
    const stored = h.repository.credentials.get(binding.credentialBindingId)!;
    expect(stored.secretGeneration).toBe(2);
    expect(stored.binding.version).toBe(1);
    expect(stored.binding.accessExpiresAt).toBe('2026-09-11T02:00:00.000Z');
    expect(h.refresh).toHaveBeenCalledWith({
      refreshToken: 'initial-refresh-token',
      grantedScopes: ['Mail.Read', 'Mail.Send']
    });
  });

  it('marks REAUTH_REQUIRED only for authoritative provider reauth signals', async () => {
    const h = createHarness();
    const { binding } = await connect(h);
    h.setNow('2026-09-11T00:20:00.000Z');
    h.refresh.mockRejectedValueOnce(
      new OAuthProviderDriverError('REAUTH_REQUIRED', 'invalid_grant')
    );
    const credential = {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: 1
    } as const;
    await expect(
      h.service.resolveAccessToken({
        credential,
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_REAUTH_REQUIRED' });
    const stored = h.repository.credentials.get(binding.credentialBindingId)!;
    expect(stored.binding.lifecycle).toBe('REAUTH_REQUIRED');
    expect(stored.binding.version).toBe(2);
  });

  it('keeps lifecycle ACTIVE when provider refresh is unavailable', async () => {
    const h = createHarness();
    const { binding } = await connect(h);
    h.setNow('2026-09-11T00:20:00.000Z');
    h.refresh.mockRejectedValueOnce(new OAuthProviderDriverError('UNAVAILABLE', 'provider 503'));
    await expect(
      h.service.resolveAccessToken({
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 1
        },
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE', retryable: true });
    expect(h.repository.credentials.get(binding.credentialBindingId)?.binding.lifecycle).toBe(
      'ACTIVE'
    );
  });

  it('revokes locally before remote revoke and never restores usability after remote failure', async () => {
    const h = createHarness();
    const { binding } = await connect(h);
    h.revoke.mockRejectedValueOnce(new Error('remote revoke unavailable'));
    const revoked = await h.service.revokeCredential(principal(), {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: binding.version
    });
    expect(revoked.lifecycle).toBe('REVOKED');
    expect(revoked.version).toBe(2);
    expect(h.revoke).toHaveBeenCalledTimes(1);
    await expect(
      h.service.resolveAccessToken({
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 2
        },
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_INELIGIBLE' });
  });

  it('expires a credential when access expires and no refresh token exists', async () => {
    const h = createHarness();
    h.exchangeAuthorizationCode.mockResolvedValueOnce({
      accessToken: 'short-lived-access',
      accessExpiresAt: '2026-09-11T00:05:00.000Z',
      externalAccountRef: 'graph-user-1134',
      grantedScopes: ['Mail.Read']
    });
    const { binding } = await connect(h);
    h.setNow('2026-09-11T00:10:00.000Z');
    await expect(
      h.service.resolveAccessToken({
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 1
        },
        expectedWorkspaceId: workspaceId,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_EXPIRED' });
    expect(h.repository.credentials.get(binding.credentialBindingId)?.binding.lifecycle).toBe(
      'EXPIRED'
    );
  });
});
