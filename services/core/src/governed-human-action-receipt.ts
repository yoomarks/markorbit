import type { ManagedDatabase } from '@markorbit/persistence';
import { uuidV7 } from './auth.js';

export type GovernedHumanActionKind = 'PROVIDER_SELECTION' | 'CONTROLLED_HANDOFF';

export interface GovernedHumanActionReceiptMaterializationV1 {
  schemaVersion: 1;
  kind: GovernedHumanActionKind;
  workspaceId: string;
  userId: string;
  membershipId: string;
  principalReference: string;
  authorityReference: string;
  idempotencyKeySha256: string;
  requestFingerprintSha256: string;
  authenticatedAt: string;
}

export interface GovernedHumanActionReceiptV1
  extends GovernedHumanActionReceiptMaterializationV1 {
  receiptId: string;
  receiptReference: string;
  createdAt: string;
}

export type GovernedHumanActionReceiptErrorCode =
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'PERSISTENCE_UNAVAILABLE';

export class GovernedHumanActionReceiptError extends Error {
  constructor(
    readonly code: GovernedHumanActionReceiptErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'GovernedHumanActionReceiptError';
  }
}

const sha256 = /^[0-9a-f]{64}$/u;
const reference = /^[a-z0-9][a-z0-9:_-]{7,511}$/iu;

function validate(input: Readonly<GovernedHumanActionReceiptMaterializationV1>): void {
  if (
    input.schemaVersion !== 1 ||
    (input.kind !== 'PROVIDER_SELECTION' && input.kind !== 'CONTROLLED_HANDOFF') ||
    !input.workspaceId.trim() ||
    !input.userId.trim() ||
    !input.membershipId.trim() ||
    !reference.test(input.principalReference) ||
    !reference.test(input.authorityReference) ||
    !sha256.test(input.idempotencyKeySha256) ||
    !sha256.test(input.requestFingerprintSha256) ||
    !input.authenticatedAt.trim() ||
    Number.isNaN(Date.parse(input.authenticatedAt))
  )
    throw new GovernedHumanActionReceiptError(
      'INVALID_INPUT',
      'Governed human-action receipt materialization is invalid.'
    );
}

function stored(value: unknown): GovernedHumanActionReceiptV1 {
  const row = value as GovernedHumanActionReceiptV1;
  validate(row);
  if (
    typeof row.receiptId !== 'string' ||
    !row.receiptId.startsWith('governed-human-action-receipt_') ||
    row.receiptReference !== `core-governed-human-action-receipt:${row.receiptId}` ||
    typeof row.createdAt !== 'string' ||
    Number.isNaN(Date.parse(row.createdAt))
  )
    throw new GovernedHumanActionReceiptError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored governed human-action receipt is invalid.'
    );
  return structuredClone(row);
}

function sameMaterialization(
  receipt: Readonly<GovernedHumanActionReceiptV1>,
  input: Readonly<GovernedHumanActionReceiptMaterializationV1>
): boolean {
  return (
    receipt.schemaVersion === input.schemaVersion &&
    receipt.kind === input.kind &&
    receipt.workspaceId === input.workspaceId &&
    receipt.userId === input.userId &&
    receipt.membershipId === input.membershipId &&
    receipt.principalReference === input.principalReference &&
    receipt.authorityReference === input.authorityReference &&
    receipt.idempotencyKeySha256 === input.idempotencyKeySha256 &&
    receipt.requestFingerprintSha256 === input.requestFingerprintSha256 &&
    receipt.authenticatedAt === input.authenticatedAt
  );
}

function persistenceFailure(error: unknown): never {
  if (error instanceof GovernedHumanActionReceiptError) throw error;
  throw new GovernedHumanActionReceiptError(
    'PERSISTENCE_UNAVAILABLE',
    'Governed human-action receipt persistence is unavailable.'
  );
}

type ReceiptRow = { receipt_json: unknown };

export interface GovernedHumanActionReceiptAuthorityV1 {
  materialize(
    input: Readonly<GovernedHumanActionReceiptMaterializationV1>
  ): Promise<Readonly<GovernedHumanActionReceiptV1>>;
  get(receiptId: string): Promise<Readonly<GovernedHumanActionReceiptV1> | undefined>;
}

export class PostgresGovernedHumanActionReceiptStore
  implements GovernedHumanActionReceiptAuthorityV1
{
  constructor(private readonly database: ManagedDatabase) {}

  async materialize(
    input: Readonly<GovernedHumanActionReceiptMaterializationV1>
  ): Promise<Readonly<GovernedHumanActionReceiptV1>> {
    validate(input);
    try {
      return await this.database.transact(async (client) => {
        const replayIdentity = `${input.kind}:${input.workspaceId}:${input.userId}:${input.membershipId}:${input.idempotencyKeySha256}`;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `core:governed-human-action-receipt:${replayIdentity}`
        ]);
        const existingResult = await client.query<ReceiptRow>(
          `SELECT receipt_json
             FROM governed_human_action_receipts
            WHERE kind=$1 AND workspace_id=$2 AND user_id=$3 AND membership_id=$4
              AND idempotency_key_sha256=$5
            LIMIT 1`,
          [
            input.kind,
            input.workspaceId,
            input.userId,
            input.membershipId,
            input.idempotencyKeySha256
          ]
        );
        const existing = existingResult.rows[0]
          ? stored(existingResult.rows[0].receipt_json)
          : undefined;
        if (existing) {
          if (!sameMaterialization(existing, input))
            throw new GovernedHumanActionReceiptError(
              'CONFLICT',
              'The same governed human-action replay identity was used with different action evidence.'
            );
          return existing;
        }

        const receiptId = `governed-human-action-receipt_${uuidV7()}`;
        const receipt: GovernedHumanActionReceiptV1 = {
          ...input,
          receiptId,
          receiptReference: `core-governed-human-action-receipt:${receiptId}`,
          createdAt: new Date().toISOString()
        };
        await client.query(
          `INSERT INTO governed_human_action_receipts(
             receipt_id,kind,workspace_id,user_id,membership_id,principal_reference,
             authority_reference,idempotency_key_sha256,request_fingerprint_sha256,
             authenticated_at,receipt_json,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
          [
            receipt.receiptId,
            receipt.kind,
            receipt.workspaceId,
            receipt.userId,
            receipt.membershipId,
            receipt.principalReference,
            receipt.authorityReference,
            receipt.idempotencyKeySha256,
            receipt.requestFingerprintSha256,
            receipt.authenticatedAt,
            JSON.stringify(receipt),
            receipt.createdAt
          ]
        );
        return structuredClone(receipt);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async get(receiptId: string): Promise<Readonly<GovernedHumanActionReceiptV1> | undefined> {
    if (!receiptId.startsWith('governed-human-action-receipt_'))
      throw new GovernedHumanActionReceiptError('INVALID_INPUT', 'Receipt id is invalid.');
    try {
      const result = await this.database
        .getPool()
        .query<ReceiptRow>(
          'SELECT receipt_json FROM governed_human_action_receipts WHERE receipt_id=$1',
          [receiptId]
        );
      return result.rows[0] ? stored(result.rows[0].receipt_json) : undefined;
    } catch (error) {
      persistenceFailure(error);
    }
  }
}
