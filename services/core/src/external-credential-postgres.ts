import {
  noExternalCredentialAuthorityConsequencesV1,
  parseExternalCredentialBindingV1,
  type ExternalCredentialBindingV1,
  type ExternalCredentialLifecycleV1,
  type ExternalCredentialSecretKindV1
} from '@markorbit/contracts/external-credential';
import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import {
  ExternalCredentialError,
  type ExternalCredentialAuditEventV1,
  type ExternalCredentialRepositoryV1,
  type ExternalCredentialStoredV1
} from './external-credential.js';
import type { EncryptedExternalCredentialSecretV1 } from './external-credential-crypto.js';

type CredentialRow = {
  credential_binding_id: string;
  version: number;
  workspace_id: string;
  provider: string;
  external_account_ref: string;
  secret_kind: ExternalCredentialSecretKindV1;
  allowed_capability_ids: unknown;
  grantor_user_id: string;
  grantor_membership_id: string;
  grantor_membership_version: number;
  lifecycle: ExternalCredentialLifecycleV1;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  expired_at: Date | string | null;
  reauth_required_at: Date | string | null;
  revoked_at: Date | string | null;
  secret_generation: number | null;
  key_id: string | null;
  nonce_base64: string | null;
  ciphertext_base64: string | null;
  auth_tag_base64: string | null;
};

const iso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const optionalIso = (value: Date | string | null) => (value ? iso(value) : undefined);

function capabilityIds(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string'))
    throw new ExternalCredentialError(
      'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
      'External credential capability binding is invalid.',
      503,
      true
    );
  return value as string[];
}

function bindingFromRow(row: CredentialRow): Readonly<ExternalCredentialBindingV1> {
  const expiresAt = optionalIso(row.expires_at);
  const expiredAt = optionalIso(row.expired_at);
  const reauthRequiredAt = optionalIso(row.reauth_required_at);
  const revokedAt = optionalIso(row.revoked_at);
  return parseExternalCredentialBindingV1({
    schemaVersion: 1,
    credentialBindingId: row.credential_binding_id,
    version: row.version,
    workspaceId: row.workspace_id,
    provider: row.provider,
    externalAccountRef: row.external_account_ref,
    secretKind: row.secret_kind,
    allowedCapabilityIds: capabilityIds(row.allowed_capability_ids),
    grantor: {
      userId: row.grantor_user_id,
      membershipId: row.grantor_membership_id,
      membershipVersion: row.grantor_membership_version
    },
    lifecycle: row.lifecycle,
    ...(expiresAt ? { expiresAt } : {}),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...(expiredAt ? { expiredAt } : {}),
    ...(reauthRequiredAt ? { reauthRequiredAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    authority: noExternalCredentialAuthorityConsequencesV1
  });
}

function secretFromRow(
  row: CredentialRow
): Readonly<EncryptedExternalCredentialSecretV1> | undefined {
  if (!row.key_id || !row.nonce_base64 || !row.ciphertext_base64 || !row.auth_tag_base64)
    return undefined;
  return Object.freeze({
    keyId: row.key_id,
    nonceBase64: row.nonce_base64,
    ciphertextBase64: row.ciphertext_base64,
    authTagBase64: row.auth_tag_base64
  });
}

function storedFromRow(row: CredentialRow): Readonly<ExternalCredentialStoredV1> {
  const secret = secretFromRow(row);
  return Object.freeze({
    binding: bindingFromRow(row),
    secretGeneration: row.secret_generation ?? 0,
    ...(secret ? { secret } : {})
  });
}

function failure(cause: unknown): never {
  if (cause instanceof ExternalCredentialError) throw cause;
  throw new ExternalCredentialError(
    'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
    'External credential persistence is unavailable.',
    503,
    true,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

const selectCredential = `SELECT b.credential_binding_id,b.version,b.workspace_id,b.provider,
  b.external_account_ref,b.secret_kind,b.allowed_capability_ids,b.grantor_user_id,
  b.grantor_membership_id,b.grantor_membership_version,b.lifecycle,b.expires_at,b.created_at,
  b.updated_at,b.expired_at,b.reauth_required_at,b.revoked_at,s.secret_generation,s.key_id,
  s.nonce_base64,s.ciphertext_base64,s.auth_tag_base64
  FROM core_external_credential_bindings b
  LEFT JOIN core_external_credential_secrets s USING (credential_binding_id)`;

function eventValues(event: Readonly<ExternalCredentialAuditEventV1>): unknown[] {
  return [
    event.eventId,
    event.credentialBindingId,
    event.workspaceId,
    event.provider,
    event.externalAccountRef,
    event.secretKind,
    event.action,
    event.fromVersion ?? null,
    event.toVersion,
    event.actorUserId ?? null,
    event.actorMembershipId ?? null,
    event.occurredAt
  ];
}

const insertEvent = `INSERT INTO core_external_credential_audit_events(
  event_id,credential_binding_id,workspace_id,provider,external_account_ref,secret_kind,
  action,from_version,to_version,actor_user_id,actor_membership_id,occurred_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`;

export class PostgresExternalCredentialRepositoryV1 implements ExternalCredentialRepositoryV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async createCredential(
    stored: Readonly<ExternalCredentialStoredV1>,
    event: Readonly<ExternalCredentialAuditEventV1>
  ): Promise<Readonly<ExternalCredentialBindingV1>> {
    if (!stored.secret) return failure(new Error('Secret is required when creating a credential.'));
    const encryptedSecret = stored.secret;
    try {
      return await this.database.transact(async (client) => {
        const binding = stored.binding;
        await client.query(
          `INSERT INTO core_external_credential_bindings(
            credential_binding_id,version,workspace_id,provider,external_account_ref,secret_kind,
            allowed_capability_ids,grantor_user_id,grantor_membership_id,grantor_membership_version,
            lifecycle,expires_at,created_at,updated_at,expired_at,reauth_required_at,revoked_at)
           VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            binding.credentialBindingId,
            binding.version,
            binding.workspaceId,
            binding.provider,
            binding.externalAccountRef,
            binding.secretKind,
            JSON.stringify(binding.allowedCapabilityIds),
            binding.grantor.userId,
            binding.grantor.membershipId,
            binding.grantor.membershipVersion,
            binding.lifecycle,
            binding.expiresAt ?? null,
            binding.createdAt,
            binding.updatedAt,
            binding.expiredAt ?? null,
            binding.reauthRequiredAt ?? null,
            binding.revokedAt ?? null
          ]
        );
        await client.query(
          `INSERT INTO core_external_credential_secrets(
            credential_binding_id,secret_generation,key_id,nonce_base64,ciphertext_base64,
            auth_tag_base64,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            binding.credentialBindingId,
            stored.secretGeneration,
            encryptedSecret.keyId,
            encryptedSecret.nonceBase64,
            encryptedSecret.ciphertextBase64,
            encryptedSecret.authTagBase64,
            binding.updatedAt
          ]
        );
        await client.query(insertEvent, eventValues(event));
        return binding;
      });
    } catch (cause) {
      return failure(cause);
    }
  }

  async findCredential(id: string): Promise<Readonly<ExternalCredentialStoredV1> | undefined> {
    try {
      const result = await this.database
        .getPool()
        .query<CredentialRow>(`${selectCredential} WHERE b.credential_binding_id=$1`, [id]);
      return result.rows[0] ? storedFromRow(result.rows[0]) : undefined;
    } catch (cause) {
      return failure(cause);
    }
  }

  async withCredentialLock<T>(id: string, callback: () => Promise<T>): Promise<T> {
    const client = await this.database.getPool().connect();
    try {
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        `core-external-credential:${id}`
      ]);
      return await callback();
    } catch (cause) {
      return failure(cause);
    } finally {
      await client
        .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
          `core-external-credential:${id}`
        ])
        .catch(() => undefined);
      client.release();
    }
  }

  async rotateCredential(
    input: Parameters<ExternalCredentialRepositoryV1['rotateCredential']>[0]
  ): Promise<Readonly<ExternalCredentialStoredV1>> {
    try {
      return await this.database.transact(async (client) => {
        const binding = input.nextBinding;
        const updated = await client.query(
          `UPDATE core_external_credential_bindings SET version=$3,grantor_user_id=$4,
             grantor_membership_id=$5,grantor_membership_version=$6,expires_at=$7,
             updated_at=$8
           WHERE credential_binding_id=$1 AND version=$2 AND lifecycle='ACTIVE'`,
          [
            input.credential.credentialBindingId,
            input.credential.version,
            binding.version,
            binding.grantor.userId,
            binding.grantor.membershipId,
            binding.grantor.membershipVersion,
            binding.expiresAt ?? null,
            binding.updatedAt
          ]
        );
        if (updated.rowCount !== 1)
          await this.throwStale(client, input.credential.credentialBindingId);
        const secret = await client.query(
          `UPDATE core_external_credential_secrets SET secret_generation=secret_generation+1,
             key_id=$3,nonce_base64=$4,ciphertext_base64=$5,auth_tag_base64=$6,updated_at=$7
           WHERE credential_binding_id=$1 AND secret_generation=$2`,
          [
            input.credential.credentialBindingId,
            input.expectedSecretGeneration,
            input.nextSecret.keyId,
            input.nextSecret.nonceBase64,
            input.nextSecret.ciphertextBase64,
            input.nextSecret.authTagBase64,
            binding.updatedAt
          ]
        );
        if (secret.rowCount !== 1)
          throw new ExternalCredentialError(
            'EXTERNAL_CREDENTIAL_STALE',
            'External credential secret generation changed during rotation.',
            409
          );
        await client.query(insertEvent, eventValues(input.event));
        return {
          binding,
          secretGeneration: input.expectedSecretGeneration + 1,
          secret: input.nextSecret
        };
      });
    } catch (cause) {
      return failure(cause);
    }
  }

  async transitionLifecycle(
    input: Parameters<ExternalCredentialRepositoryV1['transitionLifecycle']>[0]
  ): Promise<Readonly<ExternalCredentialBindingV1>> {
    try {
      return await this.database.transact(async (client) => {
        const result = await client.query<CredentialRow>(
          `UPDATE core_external_credential_bindings SET version=version+1,lifecycle=$3,updated_at=$4,
             expired_at=CASE WHEN $3='EXPIRED' THEN $4::timestamptz ELSE NULL END,
             reauth_required_at=CASE WHEN $3='REAUTH_REQUIRED' THEN $4::timestamptz ELSE NULL END,
             revoked_at=CASE WHEN $3='REVOKED' THEN $4::timestamptz ELSE NULL END
           WHERE credential_binding_id=$1 AND version=$2 AND lifecycle='ACTIVE' RETURNING *`,
          [
            input.credential.credentialBindingId,
            input.credential.version,
            input.lifecycle,
            input.at
          ]
        );
        if (!result.rows[0]) await this.throwStale(client, input.credential.credentialBindingId);
        if (input.lifecycle === 'REVOKED')
          await client.query(
            'DELETE FROM core_external_credential_secrets WHERE credential_binding_id=$1',
            [input.credential.credentialBindingId]
          );
        await client.query(insertEvent, eventValues(input.event));
        const stored = await client.query<CredentialRow>(
          `${selectCredential} WHERE b.credential_binding_id=$1`,
          [input.credential.credentialBindingId]
        );
        if (!stored.rows[0]) return failure(new Error('Updated credential was not found.'));
        return bindingFromRow(stored.rows[0]);
      });
    } catch (cause) {
      return failure(cause);
    }
  }

  async rewrapSecret(
    input: Parameters<ExternalCredentialRepositoryV1['rewrapSecret']>[0]
  ): Promise<number> {
    try {
      return await this.database.transact(async (client) => {
        const result = await client.query<{ secret_generation: number }>(
          `UPDATE core_external_credential_secrets SET secret_generation=secret_generation+1,
             key_id=$3,nonce_base64=$4,ciphertext_base64=$5,auth_tag_base64=$6,updated_at=$7
           WHERE credential_binding_id=$1 AND secret_generation=$2 RETURNING secret_generation`,
          [
            input.credentialBindingId,
            input.expectedSecretGeneration,
            input.nextSecret.keyId,
            input.nextSecret.nonceBase64,
            input.nextSecret.ciphertextBase64,
            input.nextSecret.authTagBase64,
            input.at
          ]
        );
        const generation = result.rows[0]?.secret_generation;
        if (!generation)
          throw new ExternalCredentialError(
            'EXTERNAL_CREDENTIAL_STALE',
            'External credential secret generation changed during key rewrap.',
            409
          );
        await client.query(insertEvent, eventValues(input.event));
        return generation;
      });
    } catch (cause) {
      return failure(cause);
    }
  }

  private async throwStale(client: QueryClient, id: string): Promise<never> {
    const current = await client.query(
      'SELECT version FROM core_external_credential_bindings WHERE credential_binding_id=$1',
      [id]
    );
    if (!current.rows[0])
      throw new ExternalCredentialError(
        'EXTERNAL_CREDENTIAL_NOT_FOUND',
        'External credential was not found.',
        404
      );
    throw new ExternalCredentialError(
      'EXTERNAL_CREDENTIAL_STALE',
      'External credential reference is stale or ineligible.',
      409
    );
  }
}
