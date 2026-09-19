import type {
  ProtectedExternalActionAuthorizationId,
  ProtectedExternalActionAuthorizationStatusV1,
  ProtectedExternalActionAuthorizationV1,
  ProtectedExternalActionReleaseV1
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProtectedExternalActionError,
  type ProtectedActionCommandEntry,
  type ProtectedExternalActionRepository
} from './protected-external-action.js';

type Row = Record<string, unknown>;
export interface ProtectedExternalActionTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

function authorizationReceiptReference(
  authorization: Readonly<ProtectedExternalActionAuthorizationV1>
): Readonly<{ receiptId: string; receiptVersion: 1 }> {
  if (authorization.actionKind !== 'EMAIL_NOTIFICATION_SEND')
    return {
      receiptId: authorization.humanReceipt.receiptId,
      receiptVersion: authorization.humanReceipt.receiptVersion
    };

  const prefix = 'core-governed-human-action-receipt:';
  const receiptId = authorization.activationEvidence.evidenceRef.startsWith(prefix)
    ? authorization.activationEvidence.evidenceRef.slice(prefix.length)
    : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(receiptId))
    throw new ProtectedExternalActionError(
      'INVALID_REQUEST',
      'Notification authorization requires an exact Core activation receipt reference.',
      400
    );
  return { receiptId, receiptVersion: 1 };
}

export class PostgresProtectedExternalActionRepository implements ProtectedExternalActionRepository {
  constructor(
    private readonly database: ProtectedExternalActionTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findAuthorizationByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
    return this.command<ProtectedExternalActionAuthorizationV1>(
      workspaceId,
      idempotencyKey,
      'AUTHORIZE'
    );
  }

  async createAuthorization(
    authorization: Readonly<ProtectedExternalActionAuthorizationV1>,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.commandWithClient<ProtectedExternalActionAuthorizationV1>(
          client,
          authorization.workspaceId,
          authorization.idempotencyKey,
          'AUTHORIZE'
        );
        if (replay) {
          if (replay.requestFingerprint !== requestFingerprint) this.conflict();
          return replay.result;
        }
        const receipt = authorizationReceiptReference(authorization);
        await client.query(
          `INSERT INTO execution_protected_action_authorizations(
             workspace_id,authorization_id,version,action_kind,effect_fingerprint_sha256,
             receipt_id,receipt_version,status,authorization_record,authorized_at,expires_at,last_validated_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
          [
            authorization.workspaceId,
            authorization.authorizationId,
            authorization.version,
            authorization.actionKind,
            authorization.effectFingerprintSha256,
            receipt.receiptId,
            receipt.receiptVersion,
            authorization.authorizationStatus,
            JSON.stringify(authorization),
            authorization.authorizedAt,
            authorization.expiresAt,
            authorization.lastValidatedAt
          ]
        );
        await this.insertCommand(
          client,
          authorization.workspaceId,
          authorization.idempotencyKey,
          'AUTHORIZE',
          requestFingerprint,
          authorization,
          authorization.authorizedAt
        );
        return structuredClone(authorization);
      });
    } catch (cause) {
      throw this.map(cause);
    }
  }

  async findAuthorization(
    workspaceId: string,
    authorizationId: ProtectedExternalActionAuthorizationId
  ) {
    try {
      const result = await this.query.query(
        `SELECT authorization_record,status FROM execution_protected_action_authorizations
          WHERE workspace_id=$1 AND authorization_id=$2`,
        [workspaceId, authorizationId]
      );
      const row = result.rows[0] as Row | undefined;
      return row
        ? ({
            ...(row.authorization_record as ProtectedExternalActionAuthorizationV1),
            authorizationStatus: String(row.status) as ProtectedExternalActionAuthorizationStatusV1
          } satisfies ProtectedExternalActionAuthorizationV1)
        : undefined;
    } catch (cause) {
      throw this.map(cause);
    }
  }

  async updateAuthorizationStatus(
    workspaceId: string,
    authorizationId: ProtectedExternalActionAuthorizationId,
    status: ProtectedExternalActionAuthorizationStatusV1
  ) {
    try {
      await this.query.query(
        `UPDATE execution_protected_action_authorizations
            SET status=$3,
                authorization_record=jsonb_set(authorization_record,'{authorizationStatus}',to_jsonb($3::text))
          WHERE workspace_id=$1 AND authorization_id=$2`,
        [workspaceId, authorizationId, status]
      );
    } catch (cause) {
      throw this.map(cause);
    }
  }

  async findReleaseByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
    return this.command<ProtectedExternalActionReleaseV1>(workspaceId, idempotencyKey, 'RELEASE');
  }

  async createRelease(
    release: Readonly<ProtectedExternalActionReleaseV1>,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.commandWithClient<ProtectedExternalActionReleaseV1>(
          client,
          release.workspaceId,
          release.idempotencyKey,
          'RELEASE'
        );
        if (replay) {
          if (replay.requestFingerprint !== requestFingerprint) this.conflict();
          return replay.result;
        }
        await client.query(
          `INSERT INTO execution_protected_action_releases(
             workspace_id,release_id,version,authorization_id,authorization_version,
             action_kind,effect_fingerprint_sha256,status,release_record,released_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
          [
            release.workspaceId,
            release.releaseId,
            release.version,
            release.authorization.id,
            release.authorization.version,
            release.actionKind,
            release.effectFingerprintSha256,
            release.status,
            JSON.stringify(release),
            release.releasedAt
          ]
        );
        await this.insertCommand(
          client,
          release.workspaceId,
          release.idempotencyKey,
          'RELEASE',
          requestFingerprint,
          release,
          release.releasedAt
        );
        return structuredClone(release);
      });
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505')
        throw new ProtectedExternalActionError(
          'RELEASE_ALREADY_EXISTS',
          'This exact authorization already has an immutable release.'
        );
      throw this.map(cause);
    }
  }

  private async command<T>(
    workspaceId: string,
    idempotencyKey: string,
    kind: 'AUTHORIZE' | 'RELEASE'
  ) {
    try {
      const result = await this.query.query(
        `SELECT command_kind,request_fingerprint_sha256,result_record
           FROM execution_protected_action_commands
          WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row) return undefined;
      if (row.command_kind !== kind) this.conflict();
      return {
        requestFingerprint: String(row.request_fingerprint_sha256),
        result: structuredClone(row.result_record as T)
      } satisfies ProtectedActionCommandEntry<T>;
    } catch (cause) {
      throw this.map(cause);
    }
  }

  private async commandWithClient<T>(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    kind: 'AUTHORIZE' | 'RELEASE'
  ) {
    const result = await client.query(
      `SELECT command_kind,request_fingerprint_sha256,result_record
         FROM execution_protected_action_commands
        WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [workspaceId, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    if (row.command_kind !== kind) this.conflict();
    return {
      requestFingerprint: String(row.request_fingerprint_sha256),
      result: structuredClone(row.result_record as T)
    } satisfies ProtectedActionCommandEntry<T>;
  }

  private insertCommand(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    kind: 'AUTHORIZE' | 'RELEASE',
    requestFingerprint: string,
    result: unknown,
    createdAt: string
  ) {
    return client.query(
      `INSERT INTO execution_protected_action_commands(
         workspace_id,idempotency_key,command_kind,request_fingerprint_sha256,result_record,created_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
      [workspaceId, idempotencyKey, kind, requestFingerprint, JSON.stringify(result), createdAt]
    );
  }

  private conflict(): never {
    throw new ProtectedExternalActionError(
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key was used with a different protected action command.'
    );
  }

  private map(cause: unknown): ProtectedExternalActionError {
    if (cause instanceof ProtectedExternalActionError) return cause;
    if ((cause as { code?: string }).code === '23505')
      return new ProtectedExternalActionError(
        'IDEMPOTENCY_CONFLICT',
        'Protected action uniqueness or idempotency was violated.'
      );
    return new ProtectedExternalActionError(
      'PERSISTENCE_UNAVAILABLE',
      'Execution protected action persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
