import type {
  ExternalOAuthCredentialBindingV1,
  ExternalOAuthCredentialLifecycleV1,
  ExternalOAuthCredentialRefV1,
  ExternalOAuthRefreshCapabilityV1
} from '@markorbit/contracts/oauth-credential';
import { parseExternalOAuthCredentialBindingV1 } from '@markorbit/contracts/oauth-credential';
import type { ManagedDatabase } from '@markorbit/persistence';
import {
  OAuthCredentialError,
  type OAuthCredentialRepositoryV1,
  type OAuthPendingGrantV1,
  type OAuthStoredCredentialV1
} from './oauth-credential.js';
import type { EncryptedOAuthSecretV1 } from './oauth-credential-crypto.js';

type GrantAttemptRow = {
  grant_attempt_id: string;
  state_hash_sha256: string;
  workspace_id: string;
  user_id: string;
  membership_id: string;
  membership_version: number;
  provider: string;
  oauth_client_profile_id: string;
  oauth_client_profile_version: string;
  requested_scopes: unknown;
  pkce_key_id: string | null;
  pkce_nonce_base64: string | null;
  pkce_ciphertext_base64: string | null;
  pkce_auth_tag_base64: string | null;
  created_at: Date | string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
};
type CredentialRow = {
  credential_binding_id: string;
  version: number;
  workspace_id: string;
  provider: string;
  oauth_client_profile_id: string;
  oauth_client_profile_version: string;
  external_account_ref: string;
  granted_scopes: unknown;
  grantor_user_id: string;
  grantor_membership_id: string;
  grantor_membership_version: number;
  lifecycle: ExternalOAuthCredentialLifecycleV1;
  refresh_capability: ExternalOAuthRefreshCapabilityV1;
  access_expires_at: Date | string | null;
  granted_at: Date | string;
  updated_at: Date | string;
  revoked_at: Date | string | null;
  reauth_required_at: Date | string | null;
  secret_generation: number;
  key_id: string;
  nonce_base64: string;
  ciphertext_base64: string;
  auth_tag_base64: string;
};

const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const isoOptional = (value: Date | string | null) => (value ? iso(value) : undefined);

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new OAuthCredentialError(
      'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
      `${field} is invalid in OAuth credential persistence.`,
      503,
      true
    );
  return Object.freeze(value as string[]);
}
function fromGrantAttemptRow(row: GrantAttemptRow): Readonly<OAuthPendingGrantV1> {
  const pkceVerifier =
    row.pkce_key_id &&
    row.pkce_nonce_base64 &&
    row.pkce_ciphertext_base64 &&
    row.pkce_auth_tag_base64
      ? {
          keyId: row.pkce_key_id,
          nonceBase64: row.pkce_nonce_base64,
          ciphertextBase64: row.pkce_ciphertext_base64,
          authTagBase64: row.pkce_auth_tag_base64
        }
      : undefined;
  return Object.freeze({
    grantAttemptId: row.grant_attempt_id,
    stateHashSha256: row.state_hash_sha256,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    membershipId: row.membership_id,
    membershipVersion: row.membership_version,
    provider: row.provider,
    oauthClientProfileRef: Object.freeze({
      id: row.oauth_client_profile_id,
      version: row.oauth_client_profile_version
    }),
    requestedScopes: stringArray(row.requested_scopes, 'requested_scopes'),
    ...(pkceVerifier ? { pkceVerifier: Object.freeze(pkceVerifier) } : {}),
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    ...(row.consumed_at ? { consumedAt: iso(row.consumed_at) } : {})
  });
}
function bindingFromRow(row: CredentialRow): Readonly<ExternalOAuthCredentialBindingV1> {
  const revokedAt = isoOptional(row.revoked_at);
  const reauthRequiredAt = isoOptional(row.reauth_required_at);
  const accessExpiresAt = isoOptional(row.access_expires_at);
  return parseExternalOAuthCredentialBindingV1({
    schemaVersion: 1,
    credentialBindingId: row.credential_binding_id,
    version: row.version,
    workspaceId: row.workspace_id,
    provider: row.provider,
    oauthClientProfileRef: {
      id: row.oauth_client_profile_id,
      version: row.oauth_client_profile_version
    },
    externalAccountRef: row.external_account_ref,
    grantedScopes: stringArray(row.granted_scopes, 'granted_scopes'),
    grantor: {
      userId: row.grantor_user_id,
      membershipId: row.grantor_membership_id,
      membershipVersion: row.grantor_membership_version
    },
    lifecycle: row.lifecycle,
    refreshCapability: row.refresh_capability,
    ...(accessExpiresAt ? { accessExpiresAt } : {}),
    grantedAt: iso(row.granted_at),
    updatedAt: iso(row.updated_at),
    ...(revokedAt ? { revokedAt } : {}),
    ...(reauthRequiredAt ? { reauthRequiredAt } : {}),
    authority: {
      protectedActionAuthorized: false,
      externalActionAuthorized: false,
      publishAuthorized: false,
      messageSendAuthorized: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      externalIdentityLegallyVerified: false
    }
  });
}
function secretFromRow(row: CredentialRow): Readonly<EncryptedOAuthSecretV1> {
  return Object.freeze({
    keyId: row.key_id,
    nonceBase64: row.nonce_base64,
    ciphertextBase64: row.ciphertext_base64,
    authTagBase64: row.auth_tag_base64
  });
}

function storedFromRow(row: CredentialRow): Readonly<OAuthStoredCredentialV1> {
  return Object.freeze({
    binding: bindingFromRow(row),
    secretGeneration: row.secret_generation,
    secret: secretFromRow(row)
  });
}

function persistenceFailure(cause: unknown): never {
  if (cause instanceof OAuthCredentialError) throw cause;
  throw new OAuthCredentialError(
    'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
    'OAuth credential persistence is unavailable.',
    503,
    true,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

const credentialSelect = `SELECT b.credential_binding_id,b.version,b.workspace_id,b.provider,
  b.oauth_client_profile_id,b.oauth_client_profile_version,b.external_account_ref,b.granted_scopes,
  b.grantor_user_id,b.grantor_membership_id,b.grantor_membership_version,b.lifecycle,
  b.refresh_capability,b.access_expires_at,b.granted_at,b.updated_at,b.revoked_at,b.reauth_required_at,
  s.secret_generation,s.key_id,s.nonce_base64,s.ciphertext_base64,s.auth_tag_base64
  FROM core_external_oauth_credential_bindings b
  JOIN core_external_oauth_credential_secrets s USING (credential_binding_id)`;
export class PostgresOAuthCredentialRepositoryV1 implements OAuthCredentialRepositoryV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async createGrantAttempt(input: Readonly<OAuthPendingGrantV1>): Promise<void> {
    try {
      await this.database.getPool().query(
        `INSERT INTO core_external_oauth_grant_attempts(
          grant_attempt_id,state_hash_sha256,workspace_id,user_id,membership_id,membership_version,
          provider,oauth_client_profile_id,oauth_client_profile_version,requested_scopes,
          pkce_key_id,pkce_nonce_base64,pkce_ciphertext_base64,pkce_auth_tag_base64,
          created_at,expires_at,consumed_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17)`,
        [
          input.grantAttemptId,
          input.stateHashSha256,
          input.workspaceId,
          input.userId,
          input.membershipId,
          input.membershipVersion,
          input.provider,
          input.oauthClientProfileRef.id,
          input.oauthClientProfileRef.version,
          JSON.stringify(input.requestedScopes),
          input.pkceVerifier?.keyId ?? null,
          input.pkceVerifier?.nonceBase64 ?? null,
          input.pkceVerifier?.ciphertextBase64 ?? null,
          input.pkceVerifier?.authTagBase64 ?? null,
          input.createdAt,
          input.expiresAt,
          input.consumedAt ?? null
        ]
      );
    } catch (cause) {
      persistenceFailure(cause);
    }
  }
  async findGrantAttemptByStateHash(
    stateHashSha256: string
  ): Promise<Readonly<OAuthPendingGrantV1> | undefined> {
    try {
      const result = await this.database.getPool().query<GrantAttemptRow>(
        `SELECT grant_attempt_id,state_hash_sha256,workspace_id,user_id,membership_id,membership_version,
          provider,oauth_client_profile_id,oauth_client_profile_version,requested_scopes,
          pkce_key_id,pkce_nonce_base64,pkce_ciphertext_base64,pkce_auth_tag_base64,
          created_at,expires_at,consumed_at
         FROM core_external_oauth_grant_attempts WHERE state_hash_sha256=$1`,
        [stateHashSha256]
      );
      return result.rows[0] ? fromGrantAttemptRow(result.rows[0]) : undefined;
    } catch (cause) {
      return persistenceFailure(cause);
    }
  }

  async consumeGrantAttempt(
    input: Readonly<{
      grantAttemptId: string;
      stateHashSha256: string;
      consumedAt: string;
    }>
  ): Promise<boolean> {
    try {
      const result = await this.database.getPool().query(
        `UPDATE core_external_oauth_grant_attempts SET consumed_at=$3
         WHERE grant_attempt_id=$1 AND state_hash_sha256=$2 AND consumed_at IS NULL`,
        [input.grantAttemptId, input.stateHashSha256, input.consumedAt]
      );
      return (result.rowCount ?? 0) === 1;
    } catch (cause) {
      return persistenceFailure(cause);
    }
  }
  async createCredential(
    input: Readonly<OAuthStoredCredentialV1>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    try {
      return await this.database.transact(async (client) => {
        const binding = input.binding;
        await client.query(
          `INSERT INTO core_external_oauth_credential_bindings(
            credential_binding_id,version,workspace_id,provider,oauth_client_profile_id,
            oauth_client_profile_version,external_account_ref,granted_scopes,grantor_user_id,
            grantor_membership_id,grantor_membership_version,lifecycle,refresh_capability,
            access_expires_at,granted_at,updated_at,revoked_at,reauth_required_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            binding.credentialBindingId,
            binding.version,
            binding.workspaceId,
            binding.provider,
            binding.oauthClientProfileRef.id,
            binding.oauthClientProfileRef.version,
            binding.externalAccountRef,
            JSON.stringify(binding.grantedScopes),
            binding.grantor.userId,
            binding.grantor.membershipId,
            binding.grantor.membershipVersion,
            binding.lifecycle,
            binding.refreshCapability,
            binding.accessExpiresAt ?? null,
            binding.grantedAt,
            binding.updatedAt,
            binding.revokedAt ?? null,
            binding.reauthRequiredAt ?? null
          ]
        );
        await client.query(
          `INSERT INTO core_external_oauth_credential_secrets(
            credential_binding_id,secret_generation,key_id,nonce_base64,ciphertext_base64,
            auth_tag_base64,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            binding.credentialBindingId,
            input.secretGeneration,
            input.secret.keyId,
            input.secret.nonceBase64,
            input.secret.ciphertextBase64,
            input.secret.authTagBase64,
            binding.updatedAt
          ]
        );
        return binding;
      });
    } catch (cause) {
      return persistenceFailure(cause);
    }
  }

  async findCredential(
    credentialBindingId: string
  ): Promise<Readonly<OAuthStoredCredentialV1> | undefined> {
    try {
      const result = await this.database
        .getPool()
        .query<CredentialRow>(`${credentialSelect} WHERE b.credential_binding_id=$1`, [
          credentialBindingId
        ]);
      return result.rows[0] ? storedFromRow(result.rows[0]) : undefined;
    } catch (cause) {
      return persistenceFailure(cause);
    }
  }
  async withRefreshLock<T>(credentialBindingId: string, callback: () => Promise<T>): Promise<T> {
    const client = await this.database.getPool().connect();
    try {
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        `core-oauth-credential:${credentialBindingId}`
      ]);
      return await callback();
    } catch (cause) {
      return persistenceFailure(cause);
    } finally {
      await client
        .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
          `core-oauth-credential:${credentialBindingId}`
        ])
        .catch(() => undefined);
      client.release();
    }
  }

  async rotateSecret(
    input: Readonly<{
      credentialBindingId: string;
      expectedSecretGeneration: number;
      nextSecret: Readonly<EncryptedOAuthSecretV1>;
      accessExpiresAt: string;
      refreshCapability: ExternalOAuthRefreshCapabilityV1;
      updatedAt: string;
    }>
  ): Promise<number> {
    try {
      return await this.database.transact(async (client) => {
        const secret = await client.query<{ secret_generation: number }>(
          `UPDATE core_external_oauth_credential_secrets
           SET secret_generation=secret_generation+1,key_id=$3,nonce_base64=$4,
               ciphertext_base64=$5,auth_tag_base64=$6,updated_at=$7
           WHERE credential_binding_id=$1 AND secret_generation=$2
           RETURNING secret_generation`,
          [
            input.credentialBindingId,
            input.expectedSecretGeneration,
            input.nextSecret.keyId,
            input.nextSecret.nonceBase64,
            input.nextSecret.ciphertextBase64,
            input.nextSecret.authTagBase64,
            input.updatedAt
          ]
        );
        const nextGeneration = secret.rows[0]?.secret_generation;
        if (!nextGeneration)
          throw new OAuthCredentialError(
            'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
            'OAuth credential secret generation changed during rotation.',
            503,
            true
          );
        await client.query(
          `UPDATE core_external_oauth_credential_bindings
           SET access_expires_at=$2,refresh_capability=$3,updated_at=$4
           WHERE credential_binding_id=$1`,
          [
            input.credentialBindingId,
            input.accessExpiresAt,
            input.refreshCapability,
            input.updatedAt
          ]
        );
        return nextGeneration;
      });
    } catch (cause) {
      return persistenceFailure(cause);
    }
  }

  async transitionLifecycle(
    input: Readonly<{
      credential: Readonly<ExternalOAuthCredentialRefV1>;
      lifecycle: Exclude<ExternalOAuthCredentialLifecycleV1, 'ACTIVE'>;
      at: string;
    }>
  ): Promise<Readonly<ExternalOAuthCredentialBindingV1>> {
    try {
      return await this.database.transact(async (client) => {
        const result = await client.query<CredentialRow>(
          `UPDATE core_external_oauth_credential_bindings
           SET version=version+1,lifecycle=$3,updated_at=$4,
               revoked_at=CASE WHEN $3='REVOKED' THEN $4::timestamptz ELSE NULL END,
               reauth_required_at=CASE WHEN $3='REAUTH_REQUIRED' THEN $4::timestamptz ELSE NULL END
           WHERE credential_binding_id=$1 AND version=$2
           RETURNING *`,
          [
            input.credential.credentialBindingId,
            input.credential.version,
            input.lifecycle,
            input.at
          ]
        );
        if (!result.rows[0]) {
          const current = await client.query<{ version: number }>(
            'SELECT version FROM core_external_oauth_credential_bindings WHERE credential_binding_id=$1',
            [input.credential.credentialBindingId]
          );
          if (!current.rows[0])
            throw new OAuthCredentialError(
              'OAUTH_CREDENTIAL_NOT_FOUND',
              'OAuth credential was not found.',
              404
            );
          throw new OAuthCredentialError(
            'OAUTH_CREDENTIAL_STALE',
            'OAuth credential reference is no longer current.',
            409
          );
        }
        const stored = await client.query<CredentialRow>(
          `${credentialSelect} WHERE b.credential_binding_id=$1`,
          [input.credential.credentialBindingId]
        );
        if (!stored.rows[0])
          throw new OAuthCredentialError(
            'OAUTH_CREDENTIAL_SOURCE_UNAVAILABLE',
            'OAuth credential secret lineage is unavailable.',
            503,
            true
          );
        return bindingFromRow(stored.rows[0]);
      });
    } catch (cause) {
      return persistenceFailure(cause);
    }
  }
}
