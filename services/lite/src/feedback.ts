import { createHash, randomUUID } from 'node:crypto';
import {
  productLoopFeedbackOutcomes,
  type ProductLoopFeedbackId,
  type ProductLoopFeedbackOutcome,
  type ProductLoopSourceReference,
  type ProductLoopUseFeedback,
  type PublishPackage,
  type PublishPackageId
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

type Row = Record<string, unknown>;

type CommandType = 'RECORD_USE_FEEDBACK';

export type ProductLoopFeedbackErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class ProductLoopFeedbackError extends Error {
  constructor(
    readonly code: ProductLoopFeedbackErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductLoopFeedbackError';
  }
}

export interface RecordProductLoopUseFeedbackCommand {
  workspaceId: string;
  publishPackage: Readonly<{ id: PublishPackageId; version: number }>;
  expectedPublishPackageFingerprintSha256: string;
  outcome: ProductLoopFeedbackOutcome;
  externalReference?: string;
  recordedByPrincipalId: string;
  idempotencyKey: string;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function rowDocument<T>(row: Row | undefined, field = 'document_json'): T | undefined {
  return row ? clone(row[field] as T) : undefined;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new ProductLoopFeedbackError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new ProductLoopFeedbackError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new ProductLoopFeedbackError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422
    );
  return cleaned;
}

function optionalText(value: string | undefined, field: string, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  return cleanText(value, field, maximum);
}

function exactVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value !== 1)
    throw new ProductLoopFeedbackError('INVALID_INPUT', `${field} must be version 1.`, 422);
  return value;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new ProductLoopFeedbackError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new ProductLoopFeedbackError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return parsed.toISOString();
}

function nextFeedbackId(): ProductLoopFeedbackId {
  return `product-loop-feedback_${randomUUID().replaceAll('-', '')}`;
}

export class PostgresProductLoopFeedbackStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly feedbackId: () => ProductLoopFeedbackId = nextFeedbackId
  ) {}

  async recordUseFeedback(
    command: Readonly<RecordProductLoopUseFeedbackCommand>
  ): Promise<ProductLoopUseFeedback> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const publishPackageId = cleanText(
      command.publishPackage.id,
      'publishPackage.id',
      300
    ) as PublishPackageId;
    const publishPackageVersion = exactVersion(command.publishPackage.version, 'publishPackage.version');
    const expectedFingerprint = exactSha256(
      command.expectedPublishPackageFingerprintSha256,
      'expectedPublishPackageFingerprintSha256'
    );
    if (!productLoopFeedbackOutcomes.includes(command.outcome))
      throw new ProductLoopFeedbackError('INVALID_INPUT', 'Feedback outcome is invalid.', 422);
    const externalReference = optionalText(command.externalReference, 'externalReference', 2000);
    const recordedByPrincipalId = cleanText(
      command.recordedByPrincipalId,
      'recordedByPrincipalId',
      300
    );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      publishPackageId,
      publishPackageVersion,
      expectedFingerprint,
      outcome: command.outcome,
      externalReference,
      recordedByPrincipalId
    });

    return this.command(
      workspaceId,
      idempotencyKey,
      requestFingerprintSha256,
      async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:${publishPackageId}:${publishPackageVersion}:use-feedback`
        );
        const publishPackage = await this.publishPackage(
          client,
          workspaceId,
          publishPackageId,
          publishPackageVersion
        );
        if (publishPackage.publishPackageFingerprintSha256 !== expectedFingerprint)
          throw new ProductLoopFeedbackError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'PublishPackage fingerprint no longer matches the feedback request.'
          );
        const existing = await client.query(
          'SELECT document_json FROM lite_product_loop_use_feedback WHERE workspace_id=$1 AND publish_package_id=$2 AND publish_package_version=$3',
          [workspaceId, publishPackageId, publishPackageVersion]
        );
        if (existing.rowCount)
          throw new ProductLoopFeedbackError(
            'VERSION_CONFLICT',
            'This exact PublishPackage already has a Product-loop use feedback record.'
          );
        const recordedAt = exactTimestamp(this.now(), 'now');
        const feedback: ProductLoopUseFeedback = {
          schemaVersion: 1,
          productLoopFeedbackId: this.feedbackId(),
          workspaceId,
          version: 1,
          publishPackage: { id: publishPackageId, version: publishPackageVersion },
          outcome: command.outcome,
          ...(externalReference ? { externalReference } : {}),
          recordedByPrincipalId,
          recordedAt,
          externalActionExecutedByMarkOrbit: false,
          externalOutcomeVerifiedByMarkOrbit: false
        };
        await client.query(
          'INSERT INTO lite_product_loop_use_feedback (workspace_id,product_loop_feedback_id,version,publish_package_id,publish_package_version,expected_publish_package_fingerprint_sha256,outcome,external_reference,recorded_by_principal_id,document_json,recorded_at) VALUES ($1,$2,1,$3,1,$4,$5,$6,$7,$8::jsonb,$9)',
          [
            workspaceId,
            feedback.productLoopFeedbackId,
            publishPackageId,
            expectedFingerprint,
            feedback.outcome,
            feedback.externalReference ?? null,
            recordedByPrincipalId,
            JSON.stringify(feedback),
            recordedAt
          ]
        );
        return feedback;
      }
    );
  }

  async findByPackage(
    workspaceIdValue: string,
    publishPackageId: PublishPackageId,
    version = 1
  ): Promise<ProductLoopUseFeedback | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_product_loop_use_feedback WHERE workspace_id=$1 AND publish_package_id=$2 AND publish_package_version=$3',
      [workspaceId, publishPackageId, exactVersion(version, 'version')]
    );
    return rowDocument<ProductLoopUseFeedback>(result.rows[0] as Row | undefined);
  }

  async listRecent(workspaceIdValue: string, limit = 20): Promise<ProductLoopUseFeedback[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ProductLoopFeedbackError('INVALID_INPUT', 'limit must be between 1 and 100.', 422);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM lite_product_loop_use_feedback WHERE workspace_id=$1 ORDER BY recorded_at DESC,product_loop_feedback_id ASC LIMIT $2',
        [workspaceId, limit]
      );
      return result.rows.map((row) => rowDocument<ProductLoopUseFeedback>(row as Row)!);
    } catch (error) {
      if (error instanceof ProductLoopFeedbackError) throw error;
      throw new ProductLoopFeedbackError(
        'PERSISTENCE_UNAVAILABLE',
        'Product-loop feedback persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async sourceReference(
    workspaceIdValue: string,
    feedbackIdValue: ProductLoopFeedbackId
  ): Promise<ProductLoopSourceReference | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const feedbackId = cleanText(feedbackIdValue, 'productLoopFeedbackId', 300) as ProductLoopFeedbackId;
    const result = await this.query.query(
      'SELECT document_json FROM lite_product_loop_use_feedback WHERE workspace_id=$1 AND product_loop_feedback_id=$2 AND version=1',
      [workspaceId, feedbackId]
    );
    const feedback = rowDocument<ProductLoopUseFeedback>(result.rows[0] as Row | undefined);
    if (!feedback) return undefined;
    return {
      schemaVersion: 1,
      owner: 'LITE',
      kind: 'CONTENT_USE_FEEDBACK',
      sourceId: feedback.productLoopFeedbackId,
      sourceVersion: feedback.version,
      sourceFingerprintSha256: fingerprint(feedback),
      observedAt: feedback.recordedAt
    };
  }

  private async publishPackage(
    client: QueryClient,
    workspaceId: string,
    publishPackageId: PublishPackageId,
    version: number
  ): Promise<PublishPackage> {
    const result = await client.query(
      'SELECT document_json FROM lite_publish_packages WHERE workspace_id=$1 AND publish_package_id=$2 AND version=$3',
      [workspaceId, publishPackageId, version]
    );
    const publishPackage = rowDocument<PublishPackage>(result.rows[0] as Row | undefined);
    if (!publishPackage)
      throw new ProductLoopFeedbackError('NOT_FOUND', 'PublishPackage was not found.', 404);
    return publishPackage;
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprintSha256: string,
    write: (client: QueryClient) => Promise<ProductLoopUseFeedback>
  ): Promise<ProductLoopUseFeedback> {
    try {
      return await this.database.transact(async (client) => {
        await this.resourceLock(
          client,
          `${workspaceId}:product-loop-feedback-idempotency:${idempotencyKey}`
        );
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_product_loop_feedback_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            prior.command_type !== 'RECORD_USE_FEEDBACK' ||
            prior.request_fingerprint_sha256 !== requestFingerprintSha256
          )
            throw new ProductLoopFeedbackError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency-Key was already used for a different feedback command.'
            );
          return rowDocument<ProductLoopUseFeedback>(prior, 'result_json')!;
        }
        const result = await write(client);
        await client.query(
          'INSERT INTO lite_product_loop_feedback_commands (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
          [
            workspaceId,
            idempotencyKey,
            'RECORD_USE_FEEDBACK' satisfies CommandType,
            requestFingerprintSha256,
            JSON.stringify(result),
            exactTimestamp(this.now(), 'now')
          ]
        );
        return result;
      });
    } catch (error) {
      if (error instanceof ProductLoopFeedbackError) throw error;
      throw new ProductLoopFeedbackError(
        'PERSISTENCE_UNAVAILABLE',
        'Product-loop feedback persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async resourceLock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }
}
