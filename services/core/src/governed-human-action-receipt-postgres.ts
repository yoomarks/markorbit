import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import {
  GovernedHumanActionReceiptError,
  type GovernedHumanActionKind,
  type GovernedHumanActionReceipt,
  type GovernedHumanActionReceiptStore
} from './governed-human-action-receipt.js';

type ReceiptRow = {
  receipt_id: string;
  receipt_version: number;
  workspace_id: string;
  user_id: string;
  membership_id: string;
  principal_reference: string;
  action_kind: GovernedHumanActionKind;
  mutation_route: string;
  reviewed_action_digest: string;
  idempotency_key: string;
  authenticated_at: Date | string;
  workspace_version: number;
  user_version: number;
  membership_version: number;
  created_at: Date | string;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fromRow(row: ReceiptRow): Readonly<GovernedHumanActionReceipt> {
  return Object.freeze({
    schemaVersion: 1,
    receiptId: row.receipt_id,
    receiptVersion: 1,
    authorityReference: `core-governed-human-action-receipt:${row.receipt_id}`,
    authorityVersion: 1,
    affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${row.receipt_id}`,
    source: 'CORE',
    actorKind: 'HUMAN_USER',
    workspaceId: row.workspace_id,
    userId: row.user_id,
    membershipId: row.membership_id,
    principalReference: row.principal_reference,
    kind: row.action_kind,
    mutationRoute: row.mutation_route,
    reviewedActionDigest: row.reviewed_action_digest,
    idempotencyKey: row.idempotency_key,
    authenticatedAt: iso(row.authenticated_at),
    workspaceVersion: row.workspace_version,
    userVersion: row.user_version,
    membershipVersion: row.membership_version,
    createdAt: iso(row.created_at)
  });
}

function exactReplay(
  existing: Readonly<GovernedHumanActionReceipt>,
  incoming: Readonly<GovernedHumanActionReceipt>
) {
  return (
    existing.workspaceId === incoming.workspaceId &&
    existing.userId === incoming.userId &&
    existing.membershipId === incoming.membershipId &&
    existing.principalReference === incoming.principalReference &&
    existing.kind === incoming.kind &&
    existing.mutationRoute === incoming.mutationRoute &&
    existing.reviewedActionDigest === incoming.reviewedActionDigest &&
    existing.idempotencyKey === incoming.idempotencyKey &&
    existing.authenticatedAt === incoming.authenticatedAt
  );
}

async function lock(
  client: QueryClient,
  workspaceId: string,
  idempotencyKey: string
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `core-governed-human-action:${workspaceId}:${idempotencyKey}`
  ]);
}

async function byIdempotency(
  client: QueryClient,
  workspaceId: string,
  idempotencyKey: string
): Promise<Readonly<GovernedHumanActionReceipt> | undefined> {
  const result = await client.query<ReceiptRow>(
    `SELECT receipt_id,receipt_version,workspace_id,user_id,membership_id,principal_reference,
            action_kind,mutation_route,reviewed_action_digest,idempotency_key,authenticated_at,
            workspace_version,user_version,membership_version,created_at
       FROM core_governed_human_action_receipts
      WHERE workspace_id=$1 AND idempotency_key=$2`,
    [workspaceId, idempotencyKey]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : undefined;
}

export class PostgresGovernedHumanActionReceiptStore implements GovernedHumanActionReceiptStore {
  constructor(private readonly database: ManagedDatabase) {}

  async materializeOrResolve(
    receipt: Readonly<GovernedHumanActionReceipt>
  ): Promise<Readonly<GovernedHumanActionReceipt>> {
    try {
      return await this.database.transact(async (client) => {
        await lock(client, receipt.workspaceId, receipt.idempotencyKey);
        const existing = await byIdempotency(client, receipt.workspaceId, receipt.idempotencyKey);
        if (existing) {
          if (!exactReplay(existing, receipt))
            throw new GovernedHumanActionReceiptError(
              'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT',
              'Idempotency key is already bound to a different governed human action.',
              409
            );
          return existing;
        }
        await client.query(
          `INSERT INTO core_governed_human_action_receipts(
             receipt_id,receipt_version,workspace_id,user_id,membership_id,principal_reference,
             action_kind,mutation_route,reviewed_action_digest,idempotency_key,authenticated_at,
             workspace_version,user_version,membership_version,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            receipt.receiptId,
            receipt.receiptVersion,
            receipt.workspaceId,
            receipt.userId,
            receipt.membershipId,
            receipt.principalReference,
            receipt.kind,
            receipt.mutationRoute,
            receipt.reviewedActionDigest,
            receipt.idempotencyKey,
            receipt.authenticatedAt,
            receipt.workspaceVersion,
            receipt.userVersion,
            receipt.membershipVersion,
            receipt.createdAt
          ]
        );
        return receipt;
      });
    } catch (error) {
      if (error instanceof GovernedHumanActionReceiptError) throw error;
      throw new GovernedHumanActionReceiptError(
        'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
        'Governed human-action receipt persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findById(receiptId: string): Promise<Readonly<GovernedHumanActionReceipt> | undefined> {
    try {
      const result = await this.database.getPool().query<ReceiptRow>(
        `SELECT receipt_id,receipt_version,workspace_id,user_id,membership_id,principal_reference,
                action_kind,mutation_route,reviewed_action_digest,idempotency_key,authenticated_at,
                workspace_version,user_version,membership_version,created_at
           FROM core_governed_human_action_receipts
          WHERE receipt_id=$1`,
        [receiptId]
      );
      return result.rows[0] ? fromRow(result.rows[0]) : undefined;
    } catch (error) {
      throw new GovernedHumanActionReceiptError(
        'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
        'Governed human-action receipt source is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
