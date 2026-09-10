import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  noExternalOAuthCredentialAuthorityConsequencesV1,
  parseExternalOAuthCredentialBindingV1,
  parseExternalOAuthCredentialRefV1,
  type ExternalOAuthClientProfileRefV1,
  type ExternalOAuthCredentialBindingV1,
  type ExternalOAuthCredentialLifecycleV1,
  type ExternalOAuthCredentialRefV1,
  type ExternalOAuthRefreshCapabilityV1,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import {
  OAuthCredentialCryptoError,
  oauthCredentialSecretAadV1,
  type EncryptedOAuthSecretV1,
  type OAuthCredentialKeyringV1,
  type OAuthCredentialSecretMaterialV1
} from './oauth-credential-crypto.js';

export type OAuthCredentialErrorCode =
  | 'INVALID_OAUTH_CREDENTIAL_REQUEST'
  | 'OAUTH_PROVIDER_NOT_APPROVED'
  | 'OAUTH_GRANT_NOT_FOUND'
  | 'OAUTH_GRANT_EXPIRED'
  | 'OAUTH_GRANT_REPLAYED'
  | 'OAUTH_CREDENTIAL_NOT_FOUND'
  | 'OAUTH_CREDENTIAL_STALE'
  | 'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH'
  | 'OAUTH_CREDENTIAL_PROVIDER_MISMATCH'
  | 'OAUTH_CREDENTIAL_ACCOUNT_MISMATCH'
  | 'OAUTH_CREDENTIAL_SCOPE_MISSING'
  | 'OAUTH_CREDENTIAL_INELIGIBLE'
  | 'OAUTH_CREDENTIAL_REAUTH_REQUIRED'
  | 'OAUTH_CREDENTIAL_EXPIRED'
  | 'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE';
export class OAuthCredentialError extends Error {
  constructor(
    readonly code: OAuthCredentialErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OAuthCredentialError';
  }
}

export type OAuthProviderDriverErrorKind = 'REAUTH_REQUIRED' | 'UNAVAILABLE' | 'UNKNOWN';
export class OAuthProviderDriverError extends Error {
  constructor(
    readonly kind: OAuthProviderDriverErrorKind,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OAuthProviderDriverError';
  }
}

export interface OAuthProviderGrantV1 {
  accessToken: string;
  refreshToken?: string;
  accessExpiresAt: string;
  externalAccountRef: string;
  grantedScopes: readonly string[];
}

export interface OAuthProviderRefreshV1 {
  accessToken: string;
  accessExpiresAt: string;
  refreshTokenDisposition: 'REUSE_EXISTING' | 'REPLACE';
  refreshToken?: string;
}
export interface OAuthProviderDriverV1 {
  provider: string;
  oauthClientProfileRef: Readonly<ExternalOAuthClientProfileRefV1>;
  allowedScopes: readonly string[];
  supportsPkceS256: boolean;
  buildAuthorizationUrl(
    input: Readonly<{
      state: string;
      requestedScopes: readonly string[];
      codeChallenge?: string;
    }>
  ): string;
  exchangeAuthorizationCode(
    input: Readonly<{
      authorizationCode: string;
      requestedScopes: readonly string[];
      pkceVerifier?: string;
    }>
  ): Promise<Readonly<OAuthProviderGrantV1>>;
  refresh(
    input: Readonly<{
      refreshToken: string;
      grantedScopes: readonly string[];
    }>
  ): Promise<Readonly<OAuthProviderRefreshV1>>;
  revoke?(input: Readonly<{ accessToken: string; refreshToken?: string }>): Promise<void>;
}

export class OAuthProviderRegistryV1 {
  private readonly drivers = new Map<string, OAuthProviderDriverV1>();

  constructor(drivers: readonly OAuthProviderDriverV1[]) {
    for (const driver of drivers) {
      const key = this.key(driver.provider, driver.oauthClientProfileRef);
      if (this.drivers.has(key)) throw new Error('Duplicate OAuth provider/client profile.');
      this.drivers.set(key, driver);
    }
  }

  resolve(
    provider: string,
    profile: Readonly<ExternalOAuthClientProfileRefV1>
  ): OAuthProviderDriverV1 {
    const driver = this.drivers.get(this.key(provider, profile));
    if (!driver)
      throw new OAuthCredentialError(
        'OAUTH_PROVIDER_NOT_APPROVED',
        'OAuth provider/client profile is not approved.',
        400
      );
    return driver;
  }

  private key(provider: string, profile: Readonly<ExternalOAuthClientProfileRefV1>): string {
    return `${provider}\u0000${profile.id}\u0000${profile.version}`;
  }
}
export interface OAuthPendingGrantV1 {
  grantAttemptId: string;
  stateHashSha256: string;
  workspaceId: string;
  userId: string;
  membershipId: string;
  membershipVersion: number;
  provider: string;
  oauthClientProfileRef: Readonly<ExternalOAuthClientProfileRefV1>;
  requestedScopes: readonly string[];
  pkceVerifier?: Readonly<EncryptedOAuthSecretV1>;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface OAuthStoredCredentialV1 {
  binding: Readonly<ExternalOAuthCredentialBindingV1>;
  secretGeneration: number;
  secret: Readonly<EncryptedOAuthSecretV1>;
}

export interface OAuthCredentialRepositoryV1 {
  createGrantAttempt(input: Readonly<OAuthPendingGrantV1>): Promise<void>;
  findGrantAttemptByStateHash(
    stateHashSha256: string
  ): Promise<Readonly<OAuthPendingGrantV1> | undefined>;
  consumeGrantAttempt(
    input: Readonly<{ grantAttemptId: string; stateHashSha256: string; consumedAt: string }>
  ): Promise<boolean>;
  createCredential(
    input: Readonly<OAuthStoredCredentialV1>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>>;
  findCredential(
    credentialBindingId: string
  ): Promise<Readonly<OAuthStoredCredentialV1> | undefined>;
  withRefreshLock<T>(credentialBindingId: string, callback: () => Promise<T>): Promise<T>;
  rotateSecret(
    input: Readonly<{
      credentialBindingId: string;
      expectedSecretGeneration: number;
      nextSecret: Readonly<EncryptedOAuthSecretV1>;
      accessExpiresAt: string;
      refreshCapability: ExternalOAuthRefreshCapabilityV1;
      updatedAt: string;
    }>
  ): Promise<number>;
  transitionLifecycle(
    input: Readonly<{
      credential: Readonly<ExternalOAuthCredentialRefV1>;
      lifecycle: Exclude<ExternalOAuthCredentialLifecycleV1, 'ACTIVE'>;
      at: string;
    }>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>>;
}
function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new OAuthCredentialError('INVALID_OAUTH_CREDENTIAL_REQUEST', `${field} is invalid.`, 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new OAuthCredentialError('INVALID_OAUTH_CREDENTIAL_REQUEST', `${field} is invalid.`, 400);
  return normalized;
}

function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new OAuthCredentialError('INVALID_OAUTH_CREDENTIAL_REQUEST', `${field} is invalid.`, 400);
  return new Date(normalized).toISOString();
}

function normalizeScopes(value: readonly string[], allowed: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new OAuthCredentialError(
      'INVALID_OAUTH_CREDENTIAL_REQUEST',
      'At least one OAuth scope is required.',
      400
    );
  const scopes = value.map((scope) => text(scope, 'scope', 200));
  if (new Set(scopes).size !== scopes.length || scopes.some((scope) => !allowed.includes(scope)))
    throw new OAuthCredentialError(
      'OAUTH_PROVIDER_NOT_APPROVED',
      'OAuth scope is not approved for this provider/client profile.',
      400
    );
  return Object.freeze(scopes);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function base64urlSha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}
export interface OAuthCredentialServiceOptionsV1 {
  repository: OAuthCredentialRepositoryV1;
  currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
  providers: OAuthProviderRegistryV1;
  keyring: OAuthCredentialKeyringV1;
  clock?: () => Date;
  grantTtlMs?: number;
}

export class OAuthCredentialServiceV1 {
  private readonly clock: () => Date;
  private readonly grantTtlMs: number;

  constructor(private readonly options: OAuthCredentialServiceOptionsV1) {
    this.clock = options.clock ?? (() => new Date());
    this.grantTtlMs = options.grantTtlMs ?? 10 * 60 * 1000;
    if (
      !Number.isSafeInteger(this.grantTtlMs) ||
      this.grantTtlMs < 60_000 ||
      this.grantTtlMs > 30 * 60 * 1000
    )
      throw new OAuthCredentialError(
        'INVALID_OAUTH_CREDENTIAL_REQUEST',
        'OAuth grant TTL is invalid.',
        400
      );
  }

  async beginGrant(
    principal: Readonly<WorkspacePrincipal>,
    request: Readonly<{
      provider: string;
      oauthClientProfileRef: Readonly<ExternalOAuthClientProfileRefV1>;
      requestedScopes: readonly string[];
    }>
  ): Promise<Readonly<{ authorizationUrl: string; expiresAt: string }>> {
    if (principal.kind !== 'WORKSPACE')
      throw new OAuthCredentialError(
        'INVALID_OAUTH_CREDENTIAL_REQUEST',
        'Workspace Principal is required.',
        400
      );
    const provider = text(request.provider, 'provider', 120);
    const profile = {
      id: text(request.oauthClientProfileRef.id, 'oauthClientProfileRef.id', 240),
      version: text(request.oauthClientProfileRef.version, 'oauthClientProfileRef.version', 120)
    };
    const driver = this.options.providers.resolve(provider, profile);
    const requestedScopes = normalizeScopes(request.requestedScopes, driver.allowedScopes);
    const authority = await this.options.currentWorkspaceAuthority.validate({
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      requiredPermission: 'workspace:manage'
    });
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + this.grantTtlMs).toISOString();
    const state = randomBytes(32).toString('base64url');
    const verifier = driver.supportsPkceS256 ? randomBytes(32).toString('base64url') : undefined;
    const grantAttemptId = `oauth-grant-attempt_${randomUUID()}`;
    const pkceVerifier = verifier
      ? this.options.keyring.encryptText(
          verifier,
          `oauth-grant-attempt:v1:${grantAttemptId}:${principal.workspaceId}:${provider}`
        )
      : undefined;
    await this.options.repository.createGrantAttempt({
      grantAttemptId,
      stateHashSha256: sha256(state),
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      membershipVersion: authority.membership.version,
      provider,
      oauthClientProfileRef: profile,
      requestedScopes,
      ...(pkceVerifier ? { pkceVerifier } : {}),
      createdAt: now.toISOString(),
      expiresAt
    });
    const authorizationUrl = driver.buildAuthorizationUrl({
      state,
      requestedScopes,
      ...(verifier ? { codeChallenge: base64urlSha256(verifier) } : {})
    });
    const parsedUrl = new URL(authorizationUrl);
    if (parsedUrl.protocol !== 'https:')
      throw new OAuthCredentialError(
        'OAUTH_PROVIDER_NOT_APPROVED',
        'OAuth authorization endpoint must use HTTPS.',
        400
      );
    return Object.freeze({ authorizationUrl, expiresAt });
  }
  async completeGrant(
    principal: Readonly<WorkspacePrincipal>,
    request: Readonly<{ state: string; authorizationCode: string }>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    const state = text(request.state, 'state', 2_000);
    const authorizationCode = text(request.authorizationCode, 'authorizationCode', 20_000);
    const attempt = await this.options.repository.findGrantAttemptByStateHash(sha256(state));
    if (!attempt)
      throw new OAuthCredentialError(
        'OAUTH_GRANT_NOT_FOUND',
        'OAuth grant attempt was not found.',
        404
      );
    if (attempt.consumedAt)
      throw new OAuthCredentialError(
        'OAUTH_GRANT_REPLAYED',
        'OAuth grant attempt was already consumed.',
        409
      );
    if (Date.parse(attempt.expiresAt) <= this.clock().getTime())
      throw new OAuthCredentialError(
        'OAUTH_GRANT_EXPIRED',
        'OAuth grant attempt has expired.',
        409
      );
    if (
      principal.kind !== 'WORKSPACE' ||
      principal.workspaceId !== attempt.workspaceId ||
      principal.userId !== attempt.userId ||
      principal.membershipId !== attempt.membershipId
    )
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH',
        'OAuth callback Workspace/member context does not match the pending grant.',
        403
      );
    await this.options.currentWorkspaceAuthority.validate({
      workspaceId: attempt.workspaceId,
      userId: attempt.userId,
      membershipId: attempt.membershipId,
      expectedMembershipVersion: attempt.membershipVersion,
      requiredPermission: 'workspace:manage'
    });
    const consumedAt = this.clock().toISOString();
    const consumed = await this.options.repository.consumeGrantAttempt({
      grantAttemptId: attempt.grantAttemptId,
      stateHashSha256: attempt.stateHashSha256,
      consumedAt
    });
    if (!consumed)
      throw new OAuthCredentialError(
        'OAUTH_GRANT_REPLAYED',
        'OAuth grant attempt was already consumed.',
        409
      );
    const driver = this.options.providers.resolve(attempt.provider, attempt.oauthClientProfileRef);
    const pkceVerifier = attempt.pkceVerifier
      ? this.options.keyring.decryptText(
          attempt.pkceVerifier,
          `oauth-grant-attempt:v1:${attempt.grantAttemptId}:${attempt.workspaceId}:${attempt.provider}`
        )
      : undefined;
    let grant: Readonly<OAuthProviderGrantV1>;
    try {
      grant = await driver.exchangeAuthorizationCode({
        authorizationCode,
        requestedScopes: attempt.requestedScopes,
        ...(pkceVerifier ? { pkceVerifier } : {})
      });
    } catch (cause) {
      if (cause instanceof OAuthProviderDriverError)
        throw new OAuthCredentialError(
          cause.kind === 'UNAVAILABLE'
            ? 'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE'
            : 'OAUTH_CREDENTIAL_REAUTH_REQUIRED',
          cause.kind === 'UNAVAILABLE'
            ? 'OAuth provider is unavailable during authorization exchange.'
            : 'OAuth authorization could not establish a usable credential.',
          cause.kind === 'UNAVAILABLE' ? 503 : 409,
          cause.kind === 'UNAVAILABLE',
          { cause }
        );
      throw cause;
    }
    const accessToken = text(grant.accessToken, 'providerGrant.accessToken', 20_000);
    const accessExpiresAt = timestamp(grant.accessExpiresAt, 'providerGrant.accessExpiresAt');
    if (Date.parse(accessExpiresAt) <= this.clock().getTime())
      throw new OAuthCredentialError(
        'INVALID_OAUTH_CREDENTIAL_REQUEST',
        'OAuth provider returned an already-expired access token.',
        400
      );
    const externalAccountRef = text(
      grant.externalAccountRef,
      'providerGrant.externalAccountRef',
      500
    );
    const grantedScopes = normalizeScopes(grant.grantedScopes, driver.allowedScopes);
    const refreshToken = grant.refreshToken
      ? text(grant.refreshToken, 'providerGrant.refreshToken', 20_000)
      : undefined;
    const credentialBindingId = `oauth-credential-binding_${randomUUID()}` as const;
    const binding = parseExternalOAuthCredentialBindingV1({
      schemaVersion: 1,
      credentialBindingId,
      version: 1,
      workspaceId: attempt.workspaceId,
      provider: attempt.provider,
      oauthClientProfileRef: attempt.oauthClientProfileRef,
      externalAccountRef,
      grantedScopes,
      grantor: {
        userId: attempt.userId,
        membershipId: attempt.membershipId,
        membershipVersion: attempt.membershipVersion
      },
      lifecycle: 'ACTIVE',
      refreshCapability: refreshToken ? 'AVAILABLE' : 'NOT_AVAILABLE',
      accessExpiresAt,
      grantedAt: consumedAt,
      updatedAt: consumedAt,
      authority: noExternalOAuthCredentialAuthorityConsequencesV1
    });
    const secretGeneration = 1;
    const secret = this.options.keyring.encrypt(
      {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        accessExpiresAt
      },
      oauthCredentialSecretAadV1({
        credentialBindingId,
        workspaceId: attempt.workspaceId,
        provider: attempt.provider,
        secretGeneration
      })
    );
    return this.options.repository.createCredential({ binding, secretGeneration, secret });
  }

  async readCredential(
    credential: Readonly<ExternalOAuthCredentialRefV1>,
    expectedWorkspaceId: string
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    const ref = parseExternalOAuthCredentialRefV1(credential);
    const stored = await this.requiredCredential(ref.credentialBindingId);
    this.assertExactRef(stored.binding, ref);
    if (stored.binding.workspaceId !== expectedWorkspaceId)
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH',
        'OAuth credential does not belong to the expected Workspace.',
        403
      );
    return stored.binding;
  }
  async resolveAccessToken(
    input: Readonly<{
      credential: Readonly<ExternalOAuthCredentialRefV1>;
      expectedWorkspaceId: string;
      expectedProvider: string;
      expectedExternalAccountRef: string;
      requiredScopes: readonly string[];
    }>
  ): Promise<
    Readonly<{
      accessToken: string;
      expiresAt: string;
      credentialBindingId: string;
      bindingVersion: number;
    }>
  > {
    const ref = parseExternalOAuthCredentialRefV1(input.credential);
    return this.options.repository.withRefreshLock(ref.credentialBindingId, async () => {
      const stored = await this.requiredCredential(ref.credentialBindingId);
      this.assertExactRef(stored.binding, ref);
      this.assertTrustedContext(stored.binding, input);
      await this.options.currentWorkspaceAuthority.validate({
        workspaceId: stored.binding.workspaceId,
        userId: stored.binding.grantor.userId,
        membershipId: stored.binding.grantor.membershipId,
        expectedMembershipVersion: stored.binding.grantor.membershipVersion
      });
      this.assertUsableLifecycle(stored.binding);
      const currentSecret = this.decryptSecret(stored);
      if (Date.parse(currentSecret.accessExpiresAt) > this.clock().getTime() + 30_000)
        return this.tokenResult(stored.binding, currentSecret);
      if (stored.binding.refreshCapability === 'UNKNOWN')
        throw new OAuthCredentialError(
          'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
          'OAuth credential refresh capability is unavailable.',
          503,
          true
        );
      if (stored.binding.refreshCapability !== 'AVAILABLE' || !currentSecret.refreshToken) {
        await this.options.repository.transitionLifecycle({
          credential: ref,
          lifecycle: 'EXPIRED',
          at: this.clock().toISOString()
        });
        throw new OAuthCredentialError(
          'OAUTH_CREDENTIAL_EXPIRED',
          'OAuth credential access has expired and cannot be refreshed.',
          409
        );
      }
      const driver = this.options.providers.resolve(
        stored.binding.provider,
        stored.binding.oauthClientProfileRef
      );
      let refreshed: Readonly<OAuthProviderRefreshV1>;
      try {
        refreshed = await driver.refresh({
          refreshToken: currentSecret.refreshToken,
          grantedScopes: stored.binding.grantedScopes
        });
      } catch (cause) {
        if (cause instanceof OAuthProviderDriverError) {
          if (cause.kind === 'REAUTH_REQUIRED') {
            await this.options.repository.transitionLifecycle({
              credential: ref,
              lifecycle: 'REAUTH_REQUIRED',
              at: this.clock().toISOString()
            });
            throw new OAuthCredentialError(
              'OAUTH_CREDENTIAL_REAUTH_REQUIRED',
              'OAuth credential requires interactive re-authorization.',
              409,
              false,
              { cause }
            );
          }
          throw new OAuthCredentialError(
            'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
            'OAuth credential refresh source is unavailable.',
            503,
            true,
            { cause }
          );
        }
        throw cause;
      }
      const nextAccessToken = text(refreshed.accessToken, 'providerRefresh.accessToken', 20_000);
      const nextAccessExpiresAt = timestamp(
        refreshed.accessExpiresAt,
        'providerRefresh.accessExpiresAt'
      );
      if (Date.parse(nextAccessExpiresAt) <= this.clock().getTime())
        throw new OAuthCredentialError(
          'INVALID_OAUTH_CREDENTIAL_REQUEST',
          'OAuth provider returned an already-expired refreshed access token.',
          400
        );
      let nextRefreshToken = currentSecret.refreshToken;
      if (refreshed.refreshTokenDisposition === 'REPLACE') {
        nextRefreshToken = text(refreshed.refreshToken, 'providerRefresh.refreshToken', 20_000);
      } else if (refreshed.refreshTokenDisposition !== 'REUSE_EXISTING') {
        throw new OAuthCredentialError(
          'INVALID_OAUTH_CREDENTIAL_REQUEST',
          'OAuth provider returned an invalid refresh-token disposition.',
          400
        );
      }
      const nextGeneration = stored.secretGeneration + 1;
      const nextMaterial = {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        accessExpiresAt: nextAccessExpiresAt
      };
      const nextSecret = this.options.keyring.encrypt(
        nextMaterial,
        oauthCredentialSecretAadV1({
          credentialBindingId: stored.binding.credentialBindingId,
          workspaceId: stored.binding.workspaceId,
          provider: stored.binding.provider,
          secretGeneration: nextGeneration
        })
      );
      const persistedGeneration = await this.options.repository.rotateSecret({
        credentialBindingId: stored.binding.credentialBindingId,
        expectedSecretGeneration: stored.secretGeneration,
        nextSecret,
        accessExpiresAt: nextAccessExpiresAt,
        refreshCapability: 'AVAILABLE',
        updatedAt: this.clock().toISOString()
      });
      if (persistedGeneration !== nextGeneration)
        throw new OAuthCredentialError(
          'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
          'OAuth credential secret rotation did not preserve exact generation lineage.',
          503,
          true
        );
      return this.tokenResult(stored.binding, nextMaterial);
    });
  }

  async revokeCredential(
    principal: Readonly<WorkspacePrincipal>,
    credential: Readonly<ExternalOAuthCredentialRefV1>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    const ref = parseExternalOAuthCredentialRefV1(credential);
    return this.options.repository.withRefreshLock(ref.credentialBindingId, async () => {
      const stored = await this.requiredCredential(ref.credentialBindingId);
      this.assertExactRef(stored.binding, ref);
      if (
        principal.kind !== 'WORKSPACE' ||
        principal.workspaceId !== stored.binding.workspaceId ||
        principal.userId !== stored.binding.grantor.userId ||
        principal.membershipId !== stored.binding.grantor.membershipId
      )
        throw new OAuthCredentialError(
          'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH',
          'OAuth credential revoke context does not match the grantor Workspace/member.',
          403
        );
      await this.options.currentWorkspaceAuthority.validate({
        workspaceId: stored.binding.workspaceId,
        userId: stored.binding.grantor.userId,
        membershipId: stored.binding.grantor.membershipId,
        expectedMembershipVersion: stored.binding.grantor.membershipVersion,
        requiredPermission: 'workspace:manage'
      });
      if (stored.binding.lifecycle === 'REVOKED') return stored.binding;
      const material = this.decryptSecret(stored);
      const revoked = await this.options.repository.transitionLifecycle({
        credential: ref,
        lifecycle: 'REVOKED',
        at: this.clock().toISOString()
      });
      const driver = this.options.providers.resolve(
        stored.binding.provider,
        stored.binding.oauthClientProfileRef
      );
      if (driver.revoke) {
        try {
          await driver.revoke({
            accessToken: material.accessToken,
            ...(material.refreshToken ? { refreshToken: material.refreshToken } : {})
          });
        } catch {
          // Local revocation is authoritative for MO usability. Remote failure never restores it.
        }
      }
      return revoked;
    });
  }
  private async requiredCredential(
    credentialBindingId: string
  ): Promise<Readonly<OAuthStoredCredentialV1>> {
    const stored = await this.options.repository.findCredential(credentialBindingId);
    if (!stored)
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_NOT_FOUND',
        'OAuth credential was not found.',
        404
      );
    return stored;
  }

  private assertExactRef(
    binding: Readonly<ExternalOAuthCredentialBindingV1>,
    ref: Readonly<ExternalOAuthCredentialRefV1>
  ): void {
    if (binding.credentialBindingId !== ref.credentialBindingId || binding.version !== ref.version)
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_STALE',
        'OAuth credential reference is not the exact current semantic version.',
        409
      );
  }

  private assertTrustedContext(
    binding: Readonly<ExternalOAuthCredentialBindingV1>,
    input: Readonly<{
      expectedWorkspaceId: string;
      expectedProvider: string;
      expectedExternalAccountRef: string;
      requiredScopes: readonly string[];
    }>
  ): void {
    if (binding.workspaceId !== input.expectedWorkspaceId)
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH',
        'OAuth credential does not belong to the expected Workspace.',
        403
      );
    if (binding.provider !== input.expectedProvider)
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_PROVIDER_MISMATCH',
        'OAuth credential provider does not match the trusted adapter context.',
        409
      );
    if (binding.externalAccountRef !== input.expectedExternalAccountRef)
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_ACCOUNT_MISMATCH',
        'OAuth credential external account does not match the trusted adapter context.',
        409
      );
    const requiredScopes = input.requiredScopes.map((scope) => text(scope, 'requiredScope', 200));
    if (requiredScopes.some((scope) => !binding.grantedScopes.includes(scope)))
      throw new OAuthCredentialError(
        'OAUTH_CREDENTIAL_SCOPE_MISSING',
        'OAuth credential does not include all required granted scopes.',
        403
      );
  }

  private assertUsableLifecycle(binding: Readonly<ExternalOAuthCredentialBindingV1>): void {
    if (binding.lifecycle === 'ACTIVE') return;
    const code =
      binding.lifecycle === 'REAUTH_REQUIRED'
        ? 'OAUTH_CREDENTIAL_REAUTH_REQUIRED'
        : binding.lifecycle === 'EXPIRED'
          ? 'OAUTH_CREDENTIAL_EXPIRED'
          : 'OAUTH_CREDENTIAL_INELIGIBLE';
    throw new OAuthCredentialError(
      code,
      'OAuth credential is not eligible for token resolution.',
      409
    );
  }
  private decryptSecret(
    stored: Readonly<OAuthStoredCredentialV1>
  ): OAuthCredentialSecretMaterialV1 {
    try {
      return this.options.keyring.decrypt(
        stored.secret,
        oauthCredentialSecretAadV1({
          credentialBindingId: stored.binding.credentialBindingId,
          workspaceId: stored.binding.workspaceId,
          provider: stored.binding.provider,
          secretGeneration: stored.secretGeneration
        })
      );
    } catch (cause) {
      if (cause instanceof OAuthCredentialCryptoError)
        throw new OAuthCredentialError(
          'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
          'OAuth credential secret backend is unavailable.',
          503,
          true,
          { cause }
        );
      throw cause;
    }
  }

  private tokenResult(
    binding: Readonly<ExternalOAuthCredentialBindingV1>,
    material: Readonly<OAuthCredentialSecretMaterialV1>
  ) {
    return Object.freeze({
      accessToken: material.accessToken,
      expiresAt: material.accessExpiresAt,
      credentialBindingId: binding.credentialBindingId,
      bindingVersion: binding.version
    });
  }
}
