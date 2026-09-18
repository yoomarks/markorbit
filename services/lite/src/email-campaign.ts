import { createHash } from 'node:crypto';
import {
  assessEmailCampaignAssemblyV1,
  assertCampaignAudienceSnapshotSafetyV1,
  emailCampaignStatusesV1,
  noEmailCampaignAuthorityConsequencesV1,
  type CampaignAudienceSnapshotV1,
  type CampaignBrandProjectionV1,
  type CampaignContentProjectionV1,
  type CampaignReviewDecisionV1,
  type EmailCampaignIdV1,
  type EmailCampaignStatusV1,
  type EmailCampaignV1
} from '@markorbit/contracts/email-campaign';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;
type CommandType =
  | 'SAVE_AUDIENCE'
  | 'SAVE_CONTENT'
  | 'SAVE_BRAND'
  | 'SAVE_CAMPAIGN'
  | 'SAVE_REVIEW';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const CAMPAIGN_ID = /^email-campaign_[A-Za-z0-9_-]+$/u;
const AUDIENCE_ID = /^campaign-audience_[A-Za-z0-9_-]+$/u;
const CONTENT_ID = /^campaign-content_[A-Za-z0-9_-]+$/u;
const BRAND_ID = /^campaign-brand_[A-Za-z0-9_-]+$/u;
const REVIEW_ID = /^campaign-review_[A-Za-z0-9_-]+$/u;

export type EmailCampaignPersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class EmailCampaignPersistenceError extends Error {
  constructor(
    readonly code: EmailCampaignPersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'EmailCampaignPersistenceError';
  }
}

export interface SaveCampaignObjectCommand<T> {
  value: Readonly<T>;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ListEmailCampaignOptions {
  statuses?: readonly EmailCampaignStatusV1[];
  limit?: number;
}

export interface ReviewedEmailCampaignAggregateV1 {
  campaign: EmailCampaignV1;
  audience: CampaignAudienceSnapshotV1;
  content: CampaignContentProjectionV1;
  brand: CampaignBrandProjectionV1;
  review: CampaignReviewDecisionV1;
}

const clone = <T,>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function cleanWorkspaceId(value: string): string {
  if (!UUID.test(value))
    throw new EmailCampaignPersistenceError('INVALID_INPUT', 'workspaceId must be a UUID.', 422);
  return value.toLowerCase();
}

function positiveVersion(value: number, field = 'version'): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      422
    );
  return value;
}

function expectedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be a non-negative integer.',
      422
    );
  return value;
}

function required(value: string, field: string, max = 500): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${max} characters.`,
      422
    );
  return cleaned;
}

function iso(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value)))
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422
    );
  return new Date(value).toISOString();
}

function sha(value: string, field: string): string {
  if (!SHA256.test(value))
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      `${field} must be lowercase SHA-256 hex.`,
      422
    );
  return value;
}

function id(value: string, pattern: RegExp, field: string): string {
  if (!pattern.test(value))
    throw new EmailCampaignPersistenceError('INVALID_INPUT', `${field} is invalid.`, 422);
  return value;
}

function assertAuthorityLocks(authority: Readonly<Record<string, boolean>>, field: string): void {
  if (Object.keys(noEmailCampaignAuthorityConsequencesV1).some((key) => authority[key] !== false))
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      `${field} authority consequences must remain false.`,
      422
    );
}

function assertAudience(value: Readonly<CampaignAudienceSnapshotV1>): void {
  try {
    assertCampaignAudienceSnapshotSafetyV1(value);
  } catch (error) {
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Audience Snapshot contract validation failed.',
      422,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  cleanWorkspaceId(value.workspaceId);
  id(value.audienceSnapshotId, AUDIENCE_ID, 'audienceSnapshotId');
  positiveVersion(value.version);
  iso(value.capturedAt, 'capturedAt');
  if (value.channel !== 'EMAIL')
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Audience channel must be EMAIL.',
      422
    );
}

function assertContent(value: Readonly<CampaignContentProjectionV1>): void {
  cleanWorkspaceId(value.workspaceId);
  id(value.contentProjectionId, CONTENT_ID, 'contentProjectionId');
  positiveVersion(value.version);
  required(value.publishPackageRef.publishPackageId, 'publishPackageRef.publishPackageId');
  positiveVersion(value.publishPackageRef.version, 'publishPackageRef.version');
  sha(value.publishPackageRef.fingerprintSha256, 'publishPackageRef.fingerprintSha256');
  required(value.subject, 'subject', 500);
  if (value.preheader !== undefined) required(value.preheader, 'preheader', 1000);
  sha(value.reviewedSendFingerprintSha256, 'reviewedSendFingerprintSha256');
  sha(value.projectionFingerprintSha256, 'projectionFingerprintSha256');
  iso(value.createdAt, 'createdAt');
  if (!value.bodyOwnedByPublishPackage || value.externalSendAuthorized)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Content Projection authority/body ownership locks are invalid.',
      422
    );
}

function assertBrand(value: Readonly<CampaignBrandProjectionV1>): void {
  cleanWorkspaceId(value.workspaceId);
  id(value.brandProjectionId, BRAND_ID, 'brandProjectionId');
  positiveVersion(value.version);
  required(value.source.sourceRef, 'source.sourceRef');
  if (value.source.kind === 'SITE_CONFIGURATION') {
    required(value.source.siteId, 'source.siteId');
    positiveVersion(value.source.configurationVersion, 'source.configurationVersion');
  } else if (value.source.kind !== 'CAMPAIGN_LOCAL_PRESENTATION') {
    throw new EmailCampaignPersistenceError('INVALID_INPUT', 'Brand source kind is invalid.', 422);
  }
  required(value.presentation.displayName, 'presentation.displayName');
  sha(value.brandProjectionFingerprintSha256, 'brandProjectionFingerprintSha256');
  iso(value.capturedAt, 'capturedAt');
  if (value.canonicalWorkspaceBrandCreated)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Campaign Brand Projection cannot create canonical Workspace brand truth.',
      422
    );
}

function assertCampaign(value: Readonly<EmailCampaignV1>): void {
  cleanWorkspaceId(value.workspaceId);
  id(value.campaignId, CAMPAIGN_ID, 'campaignId');
  positiveVersion(value.version);
  if (value.featureKey !== 'EMAIL_CAMPAIGN')
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'featureKey must be EMAIL_CAMPAIGN.',
      422
    );
  if (!emailCampaignStatusesV1.includes(value.status))
    throw new EmailCampaignPersistenceError('INVALID_INPUT', 'Campaign status is invalid.', 422);
  id(value.audience.audienceSnapshotId, AUDIENCE_ID, 'audience.audienceSnapshotId');
  positiveVersion(value.audience.version, 'audience.version');
  sha(value.audience.fingerprintSha256, 'audience.fingerprintSha256');
  id(value.content.contentProjectionId, CONTENT_ID, 'content.contentProjectionId');
  positiveVersion(value.content.version, 'content.version');
  sha(value.content.fingerprintSha256, 'content.fingerprintSha256');
  id(value.brand.brandProjectionId, BRAND_ID, 'brand.brandProjectionId');
  positiveVersion(value.brand.version, 'brand.version');
  sha(value.brand.fingerprintSha256, 'brand.fingerprintSha256');
  sha(value.campaignFingerprintSha256, 'campaignFingerprintSha256');
  iso(value.createdAt, 'createdAt');
  iso(value.updatedAt, 'updatedAt');
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt))
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Campaign updatedAt cannot precede createdAt.',
      422
    );
  if (!value.humanReviewRequired)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Campaign human review must remain required.',
      422
    );
  assertAuthorityLocks(value.authority, 'Campaign');
}

function assertReview(value: Readonly<CampaignReviewDecisionV1>): void {
  cleanWorkspaceId(value.workspaceId);
  id(value.campaignReviewDecisionId, REVIEW_ID, 'campaignReviewDecisionId');
  positiveVersion(value.version);
  id(value.campaign.campaignId, CAMPAIGN_ID, 'campaign.campaignId');
  positiveVersion(value.campaign.version, 'campaign.version');
  sha(value.expectedCampaignFingerprintSha256, 'expectedCampaignFingerprintSha256');
  required(value.reviewerPrincipalId, 'reviewerPrincipalId');
  required(value.rationale, 'rationale', 4000);
  iso(value.reviewedAt, 'reviewedAt');
  if (!value.deliveryPreparationOnly)
    throw new EmailCampaignPersistenceError(
      'INVALID_INPUT',
      'Review must remain delivery-preparation-only.',
      422
    );
  assertAuthorityLocks(value.authority, 'Review');
}

function asIntegrity<T>(parse: () => T, message: string): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof EmailCampaignPersistenceError && error.code === 'INTEGRITY_FAILURE')
      throw error;
    throw new EmailCampaignPersistenceError('INTEGRITY_FAILURE', message, 500, false, {
      cause: error instanceof Error ? error : undefined
    });
  }
}

function sameTimestamp(rowValue: unknown, documentValue: string): boolean {
  if (rowValue === null || rowValue === undefined) return false;
  const left = rowValue instanceof Date ? rowValue.getTime() : Date.parse(String(rowValue));
  return Number.isFinite(left) && left === Date.parse(documentValue);
}

function parseAudienceRow(row: Row): CampaignAudienceSnapshotV1 {
  return asIntegrity(() => {
    const value = clone(row.document_json as CampaignAudienceSnapshotV1);
    assertAudience(value);
    if (
      value.workspaceId !== String(row.workspace_id) ||
      value.audienceSnapshotId !== String(row.audience_snapshot_id) ||
      value.version !== Number(row.version) ||
      value.reviewedSendFingerprintSha256 !== String(row.reviewed_send_fingerprint_sha256) ||
      value.audienceFingerprintSha256 !== String(row.audience_fingerprint_sha256) ||
      value.entries.length !== Number(row.recipient_count) ||
      !sameTimestamp(row.captured_at, value.capturedAt)
    )
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        'Audience row/document mismatch.',
        500
      );
    return value;
  }, 'Persisted Audience Snapshot failed integrity validation.');
}

function parseContentRow(row: Row): CampaignContentProjectionV1 {
  return asIntegrity(() => {
    const value = clone(row.document_json as CampaignContentProjectionV1);
    assertContent(value);
    if (
      value.workspaceId !== String(row.workspace_id) ||
      value.contentProjectionId !== String(row.content_projection_id) ||
      value.version !== Number(row.version) ||
      value.publishPackageRef.publishPackageId !== String(row.publish_package_id) ||
      value.publishPackageRef.version !== Number(row.publish_package_version) ||
      value.publishPackageRef.fingerprintSha256 !==
        String(row.publish_package_fingerprint_sha256) ||
      value.reviewedSendFingerprintSha256 !== String(row.reviewed_send_fingerprint_sha256) ||
      value.projectionFingerprintSha256 !== String(row.projection_fingerprint_sha256) ||
      !sameTimestamp(row.created_at, value.createdAt)
    )
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        'Content row/document mismatch.',
        500
      );
    return value;
  }, 'Persisted Content Projection failed integrity validation.');
}

function parseBrandRow(row: Row): CampaignBrandProjectionV1 {
  return asIntegrity(() => {
    const value = clone(row.document_json as CampaignBrandProjectionV1);
    assertBrand(value);
    if (
      value.workspaceId !== String(row.workspace_id) ||
      value.brandProjectionId !== String(row.brand_projection_id) ||
      value.version !== Number(row.version) ||
      value.source.kind !== String(row.source_kind) ||
      value.source.sourceRef !== String(row.source_ref) ||
      value.brandProjectionFingerprintSha256 !== String(row.brand_projection_fingerprint_sha256) ||
      !sameTimestamp(row.captured_at, value.capturedAt)
    )
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        'Brand row/document mismatch.',
        500
      );
    return value;
  }, 'Persisted Brand Projection failed integrity validation.');
}

function parseCampaignRow(row: Row): EmailCampaignV1 {
  return asIntegrity(() => {
    const value = clone(row.document_json as EmailCampaignV1);
    assertCampaign(value);
    if (
      value.workspaceId !== String(row.workspace_id) ||
      value.campaignId !== String(row.campaign_id) ||
      value.version !== Number(row.version) ||
      value.purpose !== String(row.purpose) ||
      value.status !== String(row.status) ||
      value.audience.audienceSnapshotId !== String(row.audience_snapshot_id) ||
      value.audience.version !== Number(row.audience_snapshot_version) ||
      value.content.contentProjectionId !== String(row.content_projection_id) ||
      value.content.version !== Number(row.content_projection_version) ||
      value.brand.brandProjectionId !== String(row.brand_projection_id) ||
      value.brand.version !== Number(row.brand_projection_version) ||
      value.campaignFingerprintSha256 !== String(row.campaign_fingerprint_sha256) ||
      !sameTimestamp(row.created_at, value.createdAt) ||
      !sameTimestamp(row.updated_at, value.updatedAt)
    )
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        'Campaign row/document mismatch.',
        500
      );
    return value;
  }, 'Persisted Campaign failed integrity validation.');
}

function parseReviewRow(row: Row): CampaignReviewDecisionV1 {
  return asIntegrity(() => {
    const value = clone(row.document_json as CampaignReviewDecisionV1);
    assertReview(value);
    if (
      value.workspaceId !== String(row.workspace_id) ||
      value.campaignReviewDecisionId !== String(row.campaign_review_decision_id) ||
      value.version !== Number(row.version) ||
      value.campaign.campaignId !== String(row.campaign_id) ||
      value.campaign.version !== Number(row.campaign_version) ||
      value.expectedCampaignFingerprintSha256 !==
        String(row.expected_campaign_fingerprint_sha256) ||
      value.outcome !== String(row.outcome) ||
      value.reviewerPrincipalId !== String(row.reviewer_principal_id) ||
      !sameTimestamp(row.reviewed_at, value.reviewedAt)
    )
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        'Review row/document mismatch.',
        500
      );
    return value;
  }, 'Persisted Campaign Review failed integrity validation.');
}

export class PostgresEmailCampaignStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async saveAudienceSnapshot(
    command: Readonly<SaveCampaignObjectCommand<CampaignAudienceSnapshotV1>>
  ): Promise<CampaignAudienceSnapshotV1> {
    let value = clone(command.value);
    assertAudience(value);
    value = { ...value, workspaceId: cleanWorkspaceId(value.workspaceId) };
    return this.saveVersioned({
      workspaceId: value.workspaceId,
      objectKind: 'audience',
      objectId: value.audienceSnapshotId,
      version: value.version,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'SAVE_AUDIENCE',
      request: value,
      table: 'lite_campaign_audience_snapshot_versions',
      idColumn: 'audience_snapshot_id',
      parse: parseAudienceRow,
      insert: async (client) => {
        await client.query(
          `INSERT INTO lite_campaign_audience_snapshot_versions(
             workspace_id,audience_snapshot_id,version,reviewed_send_fingerprint_sha256,
             audience_fingerprint_sha256,recipient_count,captured_at,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            value.workspaceId,
            value.audienceSnapshotId,
            value.version,
            value.reviewedSendFingerprintSha256,
            value.audienceFingerprintSha256,
            value.entries.length,
            value.capturedAt,
            JSON.stringify(value),
            this.timestamp()
          ]
        );
      }
    });
  }

  async saveContentProjection(
    command: Readonly<SaveCampaignObjectCommand<CampaignContentProjectionV1>>
  ): Promise<CampaignContentProjectionV1> {
    let value = clone(command.value);
    assertContent(value);
    value = { ...value, workspaceId: cleanWorkspaceId(value.workspaceId) };
    return this.saveVersioned({
      workspaceId: value.workspaceId,
      objectKind: 'content',
      objectId: value.contentProjectionId,
      version: value.version,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'SAVE_CONTENT',
      request: value,
      table: 'lite_campaign_content_projection_versions',
      idColumn: 'content_projection_id',
      parse: parseContentRow,
      insert: async (client) => {
        await client.query(
          `INSERT INTO lite_campaign_content_projection_versions(
             workspace_id,content_projection_id,version,publish_package_id,publish_package_version,
             publish_package_fingerprint_sha256,reviewed_send_fingerprint_sha256,
             projection_fingerprint_sha256,created_at,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            value.workspaceId,
            value.contentProjectionId,
            value.version,
            value.publishPackageRef.publishPackageId,
            value.publishPackageRef.version,
            value.publishPackageRef.fingerprintSha256,
            value.reviewedSendFingerprintSha256,
            value.projectionFingerprintSha256,
            value.createdAt,
            JSON.stringify(value),
            this.timestamp()
          ]
        );
      }
    });
  }

  async saveBrandProjection(
    command: Readonly<SaveCampaignObjectCommand<CampaignBrandProjectionV1>>
  ): Promise<CampaignBrandProjectionV1> {
    let value = clone(command.value);
    assertBrand(value);
    value = { ...value, workspaceId: cleanWorkspaceId(value.workspaceId) };
    return this.saveVersioned({
      workspaceId: value.workspaceId,
      objectKind: 'brand',
      objectId: value.brandProjectionId,
      version: value.version,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'SAVE_BRAND',
      request: value,
      table: 'lite_campaign_brand_projection_versions',
      idColumn: 'brand_projection_id',
      parse: parseBrandRow,
      insert: async (client) => {
        await client.query(
          `INSERT INTO lite_campaign_brand_projection_versions(
             workspace_id,brand_projection_id,version,source_kind,source_ref,
             brand_projection_fingerprint_sha256,captured_at,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            value.workspaceId,
            value.brandProjectionId,
            value.version,
            value.source.kind,
            value.source.sourceRef,
            value.brandProjectionFingerprintSha256,
            value.capturedAt,
            JSON.stringify(value),
            this.timestamp()
          ]
        );
      }
    });
  }

  async saveCampaign(
    command: Readonly<SaveCampaignObjectCommand<EmailCampaignV1>>
  ): Promise<EmailCampaignV1> {
    let value = clone(command.value);
    assertCampaign(value);
    value = { ...value, workspaceId: cleanWorkspaceId(value.workspaceId) };
    return this.saveVersioned({
      workspaceId: value.workspaceId,
      objectKind: 'campaign',
      objectId: value.campaignId,
      version: value.version,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'SAVE_CAMPAIGN',
      request: value,
      table: 'lite_email_campaign_versions',
      idColumn: 'campaign_id',
      parse: parseCampaignRow,
      beforeInsert: async (client) => {
        const audience = await this.readAudienceWithClient(
          client,
          value.workspaceId,
          value.audience.audienceSnapshotId,
          value.audience.version
        );
        const content = await this.readContentWithClient(
          client,
          value.workspaceId,
          value.content.contentProjectionId,
          value.content.version
        );
        const brand = await this.readBrandWithClient(
          client,
          value.workspaceId,
          value.brand.brandProjectionId,
          value.brand.version
        );
        const assessment = assessEmailCampaignAssemblyV1(value, audience, content, brand);
        if (!assessment.matches)
          throw new EmailCampaignPersistenceError(
            'VERSION_CONFLICT',
            `Campaign exact projection assembly failed: ${assessment.reason}.`
          );
      },
      insert: async (client) => {
        await client.query(
          `INSERT INTO lite_email_campaign_versions(
             workspace_id,campaign_id,version,purpose,status,
             audience_snapshot_id,audience_snapshot_version,
             content_projection_id,content_projection_version,
             brand_projection_id,brand_projection_version,campaign_fingerprint_sha256,
             document_json,created_at,updated_at,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)`,
          [
            value.workspaceId,
            value.campaignId,
            value.version,
            value.purpose,
            value.status,
            value.audience.audienceSnapshotId,
            value.audience.version,
            value.content.contentProjectionId,
            value.content.version,
            value.brand.brandProjectionId,
            value.brand.version,
            value.campaignFingerprintSha256,
            JSON.stringify(value),
            value.createdAt,
            value.updatedAt,
            this.timestamp()
          ]
        );
      }
    });
  }

  async saveReviewDecision(
    command: Readonly<SaveCampaignObjectCommand<CampaignReviewDecisionV1>>
  ): Promise<CampaignReviewDecisionV1> {
    let value = clone(command.value);
    assertReview(value);
    value = { ...value, workspaceId: cleanWorkspaceId(value.workspaceId) };
    return this.saveVersioned({
      workspaceId: value.workspaceId,
      objectKind: 'review',
      objectId: value.campaignReviewDecisionId,
      version: value.version,
      expectedVersion: command.expectedVersion,
      idempotencyKey: command.idempotencyKey,
      commandType: 'SAVE_REVIEW',
      request: value,
      table: 'lite_campaign_review_decision_versions',
      idColumn: 'campaign_review_decision_id',
      parse: parseReviewRow,
      beforeInsert: async (client) => {
        const campaign = await this.readCampaignWithClient(
          client,
          value.workspaceId,
          value.campaign.campaignId,
          value.campaign.version
        );
        if (value.expectedCampaignFingerprintSha256 !== campaign.campaignFingerprintSha256)
          throw new EmailCampaignPersistenceError(
            'VERSION_CONFLICT',
            'Campaign Review must bind the exact persisted Campaign fingerprint.'
          );
      },
      insert: async (client) => {
        await client.query(
          `INSERT INTO lite_campaign_review_decision_versions(
             workspace_id,campaign_review_decision_id,version,campaign_id,campaign_version,
             expected_campaign_fingerprint_sha256,outcome,reviewer_principal_id,reviewed_at,
             document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            value.workspaceId,
            value.campaignReviewDecisionId,
            value.version,
            value.campaign.campaignId,
            value.campaign.version,
            value.expectedCampaignFingerprintSha256,
            value.outcome,
            value.reviewerPrincipalId,
            value.reviewedAt,
            JSON.stringify(value),
            this.timestamp()
          ]
        );
      }
    });
  }

  async getAudienceSnapshot(
    workspaceId: string,
    audienceSnapshotId: string,
    version: number
  ): Promise<CampaignAudienceSnapshotV1> {
    return this.readExact(
      'lite_campaign_audience_snapshot_versions',
      'audience_snapshot_id',
      cleanWorkspaceId(workspaceId),
      id(audienceSnapshotId, AUDIENCE_ID, 'audienceSnapshotId'),
      positiveVersion(version),
      parseAudienceRow
    );
  }

  async getContentProjection(
    workspaceId: string,
    contentProjectionId: string,
    version: number
  ): Promise<CampaignContentProjectionV1> {
    return this.readExact(
      'lite_campaign_content_projection_versions',
      'content_projection_id',
      cleanWorkspaceId(workspaceId),
      id(contentProjectionId, CONTENT_ID, 'contentProjectionId'),
      positiveVersion(version),
      parseContentRow
    );
  }

  async getBrandProjection(
    workspaceId: string,
    brandProjectionId: string,
    version: number
  ): Promise<CampaignBrandProjectionV1> {
    return this.readExact(
      'lite_campaign_brand_projection_versions',
      'brand_projection_id',
      cleanWorkspaceId(workspaceId),
      id(brandProjectionId, BRAND_ID, 'brandProjectionId'),
      positiveVersion(version),
      parseBrandRow
    );
  }

  async getCampaignVersion(
    workspaceId: string,
    campaignId: EmailCampaignIdV1,
    version: number
  ): Promise<EmailCampaignV1> {
    return this.readExact(
      'lite_email_campaign_versions',
      'campaign_id',
      cleanWorkspaceId(workspaceId),
      id(campaignId, CAMPAIGN_ID, 'campaignId'),
      positiveVersion(version),
      parseCampaignRow
    );
  }

  async getLatestCampaign(
    workspaceId: string,
    campaignId: EmailCampaignIdV1
  ): Promise<EmailCampaignV1> {
    const workspace = cleanWorkspaceId(workspaceId);
    const campaign = id(campaignId, CAMPAIGN_ID, 'campaignId');
    return this.queryOne(
      `SELECT * FROM lite_email_campaign_versions
        WHERE workspace_id=$1 AND campaign_id=$2
        ORDER BY version DESC LIMIT 1`,
      [workspace, campaign],
      parseCampaignRow
    );
  }

  async getReviewDecision(
    workspaceId: string,
    reviewId: string,
    version: number
  ): Promise<CampaignReviewDecisionV1> {
    return this.readExact(
      'lite_campaign_review_decision_versions',
      'campaign_review_decision_id',
      cleanWorkspaceId(workspaceId),
      id(reviewId, REVIEW_ID, 'campaignReviewDecisionId'),
      positiveVersion(version),
      parseReviewRow
    );
  }

  async listLatestCampaigns(
    workspaceId: string,
    options: Readonly<ListEmailCampaignOptions> = {}
  ): Promise<readonly EmailCampaignV1[]> {
    const workspace = cleanWorkspaceId(workspaceId);
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new EmailCampaignPersistenceError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        422
      );
    const statuses = options.statuses ? [...new Set(options.statuses)] : undefined;
    if (statuses?.some((status) => !emailCampaignStatusesV1.includes(status)))
      throw new EmailCampaignPersistenceError(
        'INVALID_INPUT',
        'statuses contains an invalid status.',
        422
      );
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM (
           SELECT DISTINCT ON (campaign_id) *
             FROM lite_email_campaign_versions
            WHERE workspace_id=$1
            ORDER BY campaign_id,version DESC
         ) heads
         WHERE ($2::text[] IS NULL OR status = ANY($2::text[]))
         ORDER BY updated_at DESC,campaign_id ASC
         LIMIT $3`,
        [workspace, statuses ?? null, limit]
      );
      return result.rows.map(parseCampaignRow);
    } catch (error) {
      if (error instanceof EmailCampaignPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  async loadReviewedAggregate(
    workspaceId: string,
    campaignId: EmailCampaignIdV1,
    campaignVersion: number,
    reviewId: string,
    reviewVersion: number
  ): Promise<ReviewedEmailCampaignAggregateV1> {
    const campaign = await this.getCampaignVersion(workspaceId, campaignId, campaignVersion);
    const review = await this.getReviewDecision(workspaceId, reviewId, reviewVersion);
    if (
      review.campaign.campaignId !== campaign.campaignId ||
      review.campaign.version !== campaign.version ||
      review.expectedCampaignFingerprintSha256 !== campaign.campaignFingerprintSha256
    )
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        'Persisted Review does not bind the requested exact Campaign.',
        500
      );
    const [audience, content, brand] = await Promise.all([
      this.getAudienceSnapshot(
        workspaceId,
        campaign.audience.audienceSnapshotId,
        campaign.audience.version
      ),
      this.getContentProjection(
        workspaceId,
        campaign.content.contentProjectionId,
        campaign.content.version
      ),
      this.getBrandProjection(workspaceId, campaign.brand.brandProjectionId, campaign.brand.version)
    ]);
    const assembly = assessEmailCampaignAssemblyV1(campaign, audience, content, brand);
    if (!assembly.matches)
      throw new EmailCampaignPersistenceError(
        'INTEGRITY_FAILURE',
        `Persisted Campaign aggregate failed exact assembly: ${assembly.reason}.`,
        500
      );
    return { campaign, audience, content, brand, review };
  }

  private async saveVersioned<T>(input: {
    workspaceId: string;
    objectKind: string;
    objectId: string;
    version: number;
    expectedVersion: number;
    idempotencyKey: string;
    commandType: CommandType;
    request: Readonly<T>;
    table: string;
    idColumn: string;
    parse: (row: Row) => T;
    beforeInsert?: (client: QueryClient) => Promise<void>;
    insert: (client: QueryClient) => Promise<void>;
  }): Promise<T> {
    const expected = expectedVersion(input.expectedVersion);
    if (input.version !== expected + 1)
      throw new EmailCampaignPersistenceError(
        'VERSION_CONFLICT',
        `Version ${input.version} must immediately follow expectedVersion ${expected}.`
      );
    const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      commandType: input.commandType,
      value: input.request,
      expectedVersion: expected
    });

    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${input.workspaceId}:campaign-idempotency:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_campaign_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [input.workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            String(prior.command_type) !== input.commandType ||
            String(prior.request_fingerprint_sha256) !== requestFingerprint
          )
            throw new EmailCampaignPersistenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Campaign command.'
            );
          return clone(prior.result_json as T);
        }

        await this.lock(
          client,
          `${input.workspaceId}:campaign:${input.objectKind}:${input.objectId}`
        );
        const actual = await this.latestVersion(
          client,
          input.table,
          input.idColumn,
          input.workspaceId,
          input.objectId
        );
        if (actual !== expected)
          throw new EmailCampaignPersistenceError(
            'VERSION_CONFLICT',
            `Expected ${input.objectKind} version ${expected}, found ${actual}.`
          );

        if (input.beforeInsert) await input.beforeInsert(client);
        await input.insert(client);
        await client.query(
          `INSERT INTO lite_campaign_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            input.workspaceId,
            idempotencyKey,
            input.commandType,
            requestFingerprint,
            JSON.stringify(input.request),
            this.timestamp()
          ]
        );
        return clone(input.request as T);
      });
    } catch (error) {
      if (error instanceof EmailCampaignPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async latestVersion(
    client: QueryClient,
    table: string,
    idColumn: string,
    workspaceId: string,
    objectId: string
  ): Promise<number> {
    const result = await client.query<Row>(
      `SELECT version FROM ${table}
        WHERE workspace_id=$1 AND ${idColumn}=$2
        ORDER BY version DESC LIMIT 1`,
      [workspaceId, objectId]
    );
    return result.rows[0] ? Number(result.rows[0].version) : 0;
  }

  private async readExact<T>(
    table: string,
    idColumn: string,
    workspaceId: string,
    objectId: string,
    version: number,
    parse: (row: Row) => T
  ): Promise<T> {
    return this.queryOne(
      `SELECT * FROM ${table}
        WHERE workspace_id=$1 AND ${idColumn}=$2 AND version=$3`,
      [workspaceId, objectId, version],
      parse
    );
  }

  private async queryOne<T>(
    sql: string,
    params: readonly unknown[],
    parse: (row: Row) => T
  ): Promise<T> {
    try {
      const result = await this.query.query<Row>(sql, [...params]);
      const row = result.rows[0];
      if (!row)
        throw new EmailCampaignPersistenceError('NOT_FOUND', 'Campaign object was not found.', 404);
      return parse(row);
    } catch (error) {
      if (error instanceof EmailCampaignPersistenceError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async readAudienceWithClient(
    client: QueryClient,
    workspaceId: string,
    objectId: string,
    version: number
  ): Promise<CampaignAudienceSnapshotV1> {
    return this.readWithClient(
      client,
      'lite_campaign_audience_snapshot_versions',
      'audience_snapshot_id',
      workspaceId,
      objectId,
      version,
      parseAudienceRow
    );
  }

  private async readContentWithClient(
    client: QueryClient,
    workspaceId: string,
    objectId: string,
    version: number
  ): Promise<CampaignContentProjectionV1> {
    return this.readWithClient(
      client,
      'lite_campaign_content_projection_versions',
      'content_projection_id',
      workspaceId,
      objectId,
      version,
      parseContentRow
    );
  }

  private async readBrandWithClient(
    client: QueryClient,
    workspaceId: string,
    objectId: string,
    version: number
  ): Promise<CampaignBrandProjectionV1> {
    return this.readWithClient(
      client,
      'lite_campaign_brand_projection_versions',
      'brand_projection_id',
      workspaceId,
      objectId,
      version,
      parseBrandRow
    );
  }

  private async readCampaignWithClient(
    client: QueryClient,
    workspaceId: string,
    objectId: string,
    version: number
  ): Promise<EmailCampaignV1> {
    return this.readWithClient(
      client,
      'lite_email_campaign_versions',
      'campaign_id',
      workspaceId,
      objectId,
      version,
      parseCampaignRow
    );
  }

  private async readWithClient<T>(
    client: QueryClient,
    table: string,
    idColumn: string,
    workspaceId: string,
    objectId: string,
    version: number,
    parse: (row: Row) => T
  ): Promise<T> {
    const result = await client.query<Row>(
      `SELECT * FROM ${table}
        WHERE workspace_id=$1 AND ${idColumn}=$2 AND version=$3`,
      [workspaceId, objectId, version]
    );
    const row = result.rows[0];
    if (!row)
      throw new EmailCampaignPersistenceError(
        'NOT_FOUND',
        'Referenced Campaign object was not found.',
        404
      );
    return parse(row);
  }

  private async lock(client: QueryClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }

  private timestamp(): string {
    const value = this.now();
    if (!Number.isFinite(Date.parse(value)))
      throw new EmailCampaignPersistenceError('INVALID_INPUT', 'Runtime clock is invalid.', 500);
    return new Date(value).toISOString();
  }

  private persistenceError(cause: unknown): EmailCampaignPersistenceError {
    return new EmailCampaignPersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Campaign persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}
