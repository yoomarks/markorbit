import { createHash, randomUUID } from 'node:crypto';
import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import type { TransactionHost } from './formal-matter.js';

export const MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION = 1 as const;

export type MatterIntelligenceReviewOutcome = 'CONFIRMED' | 'OVERRIDDEN' | 'INCONCLUSIVE';
export type MatterIntelligenceReviewReason =
  | 'METHOD_ERROR'
  | 'INPUT_DATA_ERROR'
  | 'APPLICABILITY_ERROR'
  | 'PRODUCT_USER_PREFERENCE'
  | 'INCONCLUSIVE_EVIDENCE';

export type MatterIntelligenceReviewErrorCode =
  | 'INVALID_REVIEW'
  | 'AUTHENTICATION_REQUIRED'
  | 'WORKSPACE_MISMATCH'
  | 'OBSERVATION_NOT_FOUND'
  | 'REVIEW_SUPERSESSION_REQUIRED'
  | 'REVIEW_SUPERSESSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class MatterIntelligenceReviewError extends Error {
  constructor(
    readonly code: MatterIntelligenceReviewErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MatterIntelligenceReviewError';
  }
}

export type MatterIntelligenceReviewId = `matter-intelligence-review_${string}`;

export interface MarkRegMatterIntelligenceReviewV1 {
  schemaVersion: typeof MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION;
  matterIntelligenceReviewId: MatterIntelligenceReviewId;
  workspaceId: string;
  formalMatterId: FormalMatterId;
  matterIntelligenceObservationId: string;
  observationFingerprintSha256: string;
  reviewVersion: number;
  outcome: MatterIntelligenceReviewOutcome;
  reason?: MatterIntelligenceReviewReason;
  rationale?: string;
  reviewedByPrincipalId: string;
  reviewedAt: string;
  supersedes?: Readonly<{
    reviewId: MatterIntelligenceReviewId;
    reviewVersion: number;
  }>;
  reviewPayloadFingerprintSha256: string;
  reviewFingerprintSha256: string;
  productSourceFingerprintSha256: string;
  correlationId: string;
}

export interface RecordMatterIntelligenceReviewCommand {
  workspaceId: string;
  formalMatterId: FormalMatterId;
  matterIntelligenceObservationId: string;
  outcome: MatterIntelligenceReviewOutcome;
  reason?: MatterIntelligenceReviewReason;
  rationale?: string;
  supersedes?: Readonly<{
    reviewId: MatterIntelligenceReviewId;
    reviewVersion: number;
  }>;
  principal: WorkspacePrincipal;
  idempotencyKey: string;
  correlationId: string;
}

export interface MatterIntelligenceReviewDisposition {
  review: MarkRegMatterIntelligenceReviewV1;
  replayed: boolean;
  semanticDuplicate: boolean;
}

interface NormalizedReviewCommand {
  workspaceId: string;
  formalMatterId: FormalMatterId;
  matterIntelligenceObservationId: string;
  outcome: MatterIntelligenceReviewOutcome;
  reason?: MatterIntelligenceReviewReason;
  rationale?: string;
  supersedes?: Readonly<{
    reviewId: MatterIntelligenceReviewId;
    reviewVersion: number;
  }>;
  reviewedByPrincipalId: string;
  idempotencyKey: string;
  correlationId: string;
  requestFingerprintSha256: string;
  reviewPayloadFingerprintSha256: string;
  reviewedAt: string;
}

export interface MatterIntelligenceReviewRepository {
  record(command: Readonly<NormalizedReviewCommand>): Promise<MatterIntelligenceReviewDisposition>;
}

type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_ID = /^matter-intelligence-review_[A-Za-z0-9_-]+$/;
const OBSERVATION_ID = /^matter-intelligence-observation_[A-Za-z0-9_-]+$/;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function cleanText(value: string, field: string, maximum = 300): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new MatterIntelligenceReviewError(
      'INVALID_REVIEW',
      `${field} must contain between 1 and ${maximum} characters.`,
      422
    );
  }
  return cleaned;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned)) {
    throw new MatterIntelligenceReviewError(
      'INVALID_REVIEW',
      'workspaceId must be a Workspace UUID.',
      422
    );
  }
  return cleaned;
}

function cleanObservationId(value: string): string {
  const cleaned = cleanText(value, 'matterIntelligenceObservationId', 300);
  if (!OBSERVATION_ID.test(cleaned)) {
    throw new MatterIntelligenceReviewError(
      'INVALID_REVIEW',
      'matterIntelligenceObservationId is invalid.',
      422
    );
  }
  return cleaned;
}

function cleanReviewId(value: string): MatterIntelligenceReviewId {
  const cleaned = cleanText(value, 'supersedes.reviewId', 300);
  if (!REVIEW_ID.test(cleaned)) {
    throw new MatterIntelligenceReviewError(
      'INVALID_REVIEW',
      'supersedes.reviewId is invalid.',
      422
    );
  }
  return cleaned as MatterIntelligenceReviewId;
}

function cleanRationale(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return cleanText(value, 'rationale', 2000);
}

function cleanSupersedes(
  value: RecordMatterIntelligenceReviewCommand['supersedes']
): NormalizedReviewCommand['supersedes'] {
  if (!value) return undefined;
  if (!Number.isSafeInteger(value.reviewVersion) || value.reviewVersion < 1) {
    throw new MatterIntelligenceReviewError(
      'INVALID_REVIEW',
      'supersedes.reviewVersion must be a positive safe integer.',
      422
    );
  }
  return {
    reviewId: cleanReviewId(value.reviewId),
    reviewVersion: value.reviewVersion
  };
}

function validateOutcomeReason(
  outcome: MatterIntelligenceReviewOutcome,
  reason: MatterIntelligenceReviewReason | undefined
): void {
  if (outcome === 'CONFIRMED' && reason === undefined) return;
  if (outcome === 'INCONCLUSIVE' && reason === 'INCONCLUSIVE_EVIDENCE') return;
  if (
    outcome === 'OVERRIDDEN' &&
    (reason === 'METHOD_ERROR' ||
      reason === 'INPUT_DATA_ERROR' ||
      reason === 'APPLICABILITY_ERROR' ||
      reason === 'PRODUCT_USER_PREFERENCE')
  ) {
    return;
  }
  throw new MatterIntelligenceReviewError(
    'INVALID_REVIEW',
    'Review outcome and reason do not match the Phase 6 product-owned review taxonomy.',
    422
  );
}

function timestamp(value: unknown): string {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new MatterIntelligenceReviewError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted MarkReg intelligence timestamp is invalid.',
      503,
      true
    );
  }
  return parsed.toISOString();
}

function observationIdentity(row: Row): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: 1,
    matterIntelligenceObservationId: String(row.matter_intelligence_observation_id),
    workspaceId: String(row.workspace_id),
    formalMatterId: String(row.formal_matter_id),
    formalMatterVersion: Number(row.formal_matter_version),
    formalMatterSnapshotSha256: String(row.formal_matter_snapshot_sha256),
    observationKind: String(row.observation_kind),
    observedCompletedDurationDays: Number(row.observed_completed_duration_days),
    historicalBand: String(row.historical_band),
    datasetRefId: String(row.dataset_ref_id),
    capabilityId: String(row.capability_id),
    capabilityVersion: String(row.capability_version),
    inputSchemaId: String(row.input_schema_id),
    outputSchemaId: String(row.output_schema_id),
    capabilityRequestId: String(row.capability_request_id),
    capabilityInvocationId: String(row.capability_invocation_id),
    capabilityOutcomeId: String(row.capability_outcome_id),
    capabilityReturnId: String(row.capability_return_id),
    sessionReceiptId: String(row.session_receipt_id),
    implementationProfileId: String(row.implementation_profile_id),
    implementationVersion: Number(row.implementation_version),
    implementationKey: String(row.implementation_key),
    correlationId: String(row.correlation_id),
    capabilityCorrelationId: String(row.capability_correlation_id),
    methodPackageRef: String(row.method_package_ref),
    methodRef: String(row.method_ref),
    methodVersionRef: String(row.method_version_ref),
    evaluationRef: String(row.evaluation_ref),
    researchDatasetRef: String(row.research_dataset_ref),
    evidenceRefs: clone(row.evidence_refs as unknown[]),
    evidenceFingerprintSha256: String(row.evidence_fingerprint_sha256),
    inputFingerprintSha256: String(row.input_fingerprint_sha256),
    outputFingerprintSha256: String(row.output_fingerprint_sha256),
    recordedByPrincipalId: String(row.recorded_by_principal_id),
    recordedAt: timestamp(row.recorded_at)
  };
}

function newReviewId(): MatterIntelligenceReviewId {
  return `matter-intelligence-review_${randomUUID().replaceAll('-', '')}`;
}

function mapReview(row: Row): MarkRegMatterIntelligenceReviewV1 {
  const reason = row.reason === null || row.reason === undefined ? undefined : String(row.reason);
  const rationale =
    row.rationale === null || row.rationale === undefined ? undefined : String(row.rationale);
  const supersedesReviewId =
    row.supersedes_review_id === null || row.supersedes_review_id === undefined
      ? undefined
      : (String(row.supersedes_review_id) as MatterIntelligenceReviewId);
  const supersedesReviewVersion =
    row.supersedes_review_version === null || row.supersedes_review_version === undefined
      ? undefined
      : Number(row.supersedes_review_version);

  const review: MarkRegMatterIntelligenceReviewV1 = {
    schemaVersion: MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION,
    matterIntelligenceReviewId: String(
      row.matter_intelligence_review_id
    ) as MatterIntelligenceReviewId,
    workspaceId: String(row.workspace_id),
    formalMatterId: String(row.formal_matter_id) as FormalMatterId,
    matterIntelligenceObservationId: String(row.matter_intelligence_observation_id),
    observationFingerprintSha256: String(row.observation_fingerprint_sha256),
    reviewVersion: Number(row.review_version),
    outcome: String(row.outcome) as MatterIntelligenceReviewOutcome,
    reviewedByPrincipalId: String(row.reviewed_by_principal_id),
    reviewedAt: timestamp(row.reviewed_at),
    reviewPayloadFingerprintSha256: String(row.review_payload_fingerprint_sha256),
    reviewFingerprintSha256: String(row.review_fingerprint_sha256),
    productSourceFingerprintSha256: String(row.product_source_fingerprint_sha256),
    correlationId: String(row.correlation_id)
  };
  if (reason !== undefined) review.reason = reason as MatterIntelligenceReviewReason;
  if (rationale !== undefined) review.rationale = rationale;
  if (supersedesReviewId !== undefined && supersedesReviewVersion !== undefined) {
    review.supersedes = {
      reviewId: supersedesReviewId,
      reviewVersion: supersedesReviewVersion
    };
  }
  return review;
}

export class PostgresMatterIntelligenceReviewRepository implements MatterIntelligenceReviewRepository {
  constructor(private readonly database: TransactionHost) {}

  async record(
    command: Readonly<NormalizedReviewCommand>
  ): Promise<MatterIntelligenceReviewDisposition> {
    try {
      return await this.database.transact(
        async (client) => this.recordInTransaction(client, command),
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof MatterIntelligenceReviewError) throw cause;
      throw new MatterIntelligenceReviewError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Matter Intelligence Review persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private async recordInTransaction(
    client: QueryClient,
    command: Readonly<NormalizedReviewCommand>
  ): Promise<MatterIntelligenceReviewDisposition> {
    const replay = await client.query(
      'SELECT request_fingerprint_sha256,result_snapshot FROM markreg_matter_intelligence_review_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
      [command.workspaceId, command.idempotencyKey]
    );
    if (replay.rowCount) {
      const row = replay.rows[0] as Row;
      if (String(row.request_fingerprint_sha256) !== command.requestFingerprintSha256) {
        throw new MatterIntelligenceReviewError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used for a different intelligence review request.'
        );
      }
      const disposition = clone(row.result_snapshot as MatterIntelligenceReviewDisposition);
      return { ...disposition, replayed: true };
    }

    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${command.workspaceId}:${command.matterIntelligenceObservationId}:matter-intelligence-review`
    ]);

    const observationResult = await client.query(
      'SELECT * FROM markreg_matter_intelligence_observations WHERE workspace_id=$1 AND formal_matter_id=$2 AND matter_intelligence_observation_id=$3 FOR SHARE',
      [command.workspaceId, command.formalMatterId, command.matterIntelligenceObservationId]
    );
    if (!observationResult.rowCount) {
      throw new MatterIntelligenceReviewError(
        'OBSERVATION_NOT_FOUND',
        'The exact MarkReg Matter Intelligence observation was not found in this Workspace/Formal Matter.',
        404
      );
    }
    const observationRow = observationResult.rows[0] as Row;
    const observationFingerprintSha256 = fingerprint(observationIdentity(observationRow));

    const latestResult = await client.query(
      'SELECT * FROM markreg_matter_intelligence_reviews WHERE workspace_id=$1 AND matter_intelligence_observation_id=$2 ORDER BY review_version DESC,matter_intelligence_review_id ASC LIMIT 1 FOR UPDATE',
      [command.workspaceId, command.matterIntelligenceObservationId]
    );
    const latest = latestResult.rowCount ? mapReview(latestResult.rows[0] as Row) : undefined;

    if (
      latest &&
      latest.observationFingerprintSha256 === observationFingerprintSha256 &&
      latest.reviewPayloadFingerprintSha256 === command.reviewPayloadFingerprintSha256 &&
      command.supersedes === undefined
    ) {
      const disposition: MatterIntelligenceReviewDisposition = {
        review: latest,
        replayed: false,
        semanticDuplicate: true
      };
      await this.insertCommand(client, command, disposition);
      return disposition;
    }

    if (!latest && command.supersedes !== undefined) {
      throw new MatterIntelligenceReviewError(
        'REVIEW_SUPERSESSION_CONFLICT',
        'No existing review is available to supersede.'
      );
    }
    if (latest && command.supersedes === undefined) {
      throw new MatterIntelligenceReviewError(
        'REVIEW_SUPERSESSION_REQUIRED',
        'A different latest review already exists; an explicit supersedes reference is required.'
      );
    }
    if (
      latest &&
      (command.supersedes?.reviewId !== latest.matterIntelligenceReviewId ||
        command.supersedes.reviewVersion !== latest.reviewVersion)
    ) {
      throw new MatterIntelligenceReviewError(
        'REVIEW_SUPERSESSION_CONFLICT',
        'supersedes must identify the exact current latest intelligence review.'
      );
    }

    const reviewVersion = (latest?.reviewVersion ?? 0) + 1;
    const reviewId = newReviewId();
    const reviewIdentity = {
      schemaVersion: MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION,
      sourceAuthority: 'MARKREG',
      matterIntelligenceReviewId: reviewId,
      workspaceId: command.workspaceId,
      formalMatterId: command.formalMatterId,
      matterIntelligenceObservationId: command.matterIntelligenceObservationId,
      observationFingerprintSha256,
      reviewVersion,
      outcome: command.outcome,
      reason: command.reason,
      rationale: command.rationale,
      reviewedByPrincipalId: command.reviewedByPrincipalId,
      reviewedAt: command.reviewedAt,
      supersedes: command.supersedes,
      correlationId: command.correlationId
    };
    const reviewFingerprintSha256 = fingerprint(reviewIdentity);
    const productSourceFingerprintSha256 = fingerprint({
      schemaVersion: MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION,
      sourceAuthority: 'MARKREG',
      workspaceId: command.workspaceId,
      formalMatterId: command.formalMatterId,
      matterIntelligenceObservationId: command.matterIntelligenceObservationId,
      observationFingerprintSha256,
      matterIntelligenceReviewId: reviewId,
      reviewVersion,
      reviewFingerprintSha256
    });

    const review: MarkRegMatterIntelligenceReviewV1 = {
      schemaVersion: MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION,
      matterIntelligenceReviewId: reviewId,
      workspaceId: command.workspaceId,
      formalMatterId: command.formalMatterId,
      matterIntelligenceObservationId: command.matterIntelligenceObservationId,
      observationFingerprintSha256,
      reviewVersion,
      outcome: command.outcome,
      reviewedByPrincipalId: command.reviewedByPrincipalId,
      reviewedAt: command.reviewedAt,
      reviewPayloadFingerprintSha256: command.reviewPayloadFingerprintSha256,
      reviewFingerprintSha256,
      productSourceFingerprintSha256,
      correlationId: command.correlationId
    };
    if (command.reason !== undefined) review.reason = command.reason;
    if (command.rationale !== undefined) review.rationale = command.rationale;
    if (command.supersedes !== undefined) review.supersedes = clone(command.supersedes);

    await client.query(
      'INSERT INTO markreg_matter_intelligence_reviews (matter_intelligence_review_id,workspace_id,formal_matter_id,matter_intelligence_observation_id,observation_fingerprint_sha256,review_version,outcome,reason,rationale,reviewed_by_principal_id,reviewed_at,supersedes_review_id,supersedes_review_version,review_payload_fingerprint_sha256,review_fingerprint_sha256,product_source_fingerprint_sha256,correlation_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',
      [
        review.matterIntelligenceReviewId,
        review.workspaceId,
        review.formalMatterId,
        review.matterIntelligenceObservationId,
        review.observationFingerprintSha256,
        review.reviewVersion,
        review.outcome,
        review.reason ?? null,
        review.rationale ?? null,
        review.reviewedByPrincipalId,
        review.reviewedAt,
        review.supersedes?.reviewId ?? null,
        review.supersedes?.reviewVersion ?? null,
        review.reviewPayloadFingerprintSha256,
        review.reviewFingerprintSha256,
        review.productSourceFingerprintSha256,
        review.correlationId
      ]
    );

    const disposition: MatterIntelligenceReviewDisposition = {
      review,
      replayed: false,
      semanticDuplicate: false
    };
    await this.insertCommand(client, command, disposition);
    return disposition;
  }

  private async insertCommand(
    client: QueryClient,
    command: Readonly<NormalizedReviewCommand>,
    disposition: MatterIntelligenceReviewDisposition
  ): Promise<void> {
    await client.query(
      'INSERT INTO markreg_matter_intelligence_review_commands (workspace_id,idempotency_key,request_fingerprint_sha256,matter_intelligence_review_id,result_snapshot,correlation_id,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)',
      [
        command.workspaceId,
        command.idempotencyKey,
        command.requestFingerprintSha256,
        disposition.review.matterIntelligenceReviewId,
        JSON.stringify(disposition),
        command.correlationId,
        command.reviewedAt
      ]
    );
  }
}

export class MatterIntelligenceReviewService {
  constructor(
    private readonly repository: MatterIntelligenceReviewRepository,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async recordReview(
    value: Readonly<RecordMatterIntelligenceReviewCommand>
  ): Promise<MatterIntelligenceReviewDisposition> {
    const workspaceId = cleanWorkspaceId(value.workspaceId);
    const formalMatterId = cleanText(value.formalMatterId, 'formalMatterId', 300) as FormalMatterId;
    const matterIntelligenceObservationId = cleanObservationId(
      value.matterIntelligenceObservationId
    );
    const idempotencyKey = cleanText(value.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(value.correlationId, 'correlationId', 300);
    const rationale = cleanRationale(value.rationale);
    const supersedes = cleanSupersedes(value.supersedes);
    const principal = value.principal;

    if (principal.kind !== 'WORKSPACE') {
      throw new MatterIntelligenceReviewError(
        'AUTHENTICATION_REQUIRED',
        'A trusted Workspace Principal is required.',
        401
      );
    }
    if (principal.workspaceId !== workspaceId) {
      throw new MatterIntelligenceReviewError(
        'WORKSPACE_MISMATCH',
        'Workspace context does not match Principal truth.',
        403
      );
    }

    validateOutcomeReason(value.outcome, value.reason);
    const reviewedAt = new Date(this.now()).toISOString();
    const reviewPayload = {
      schemaVersion: MATTER_INTELLIGENCE_REVIEW_SCHEMA_VERSION,
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId,
      outcome: value.outcome,
      reason: value.reason,
      rationale,
      reviewedByPrincipalId: principal.userId
    };
    const requestFingerprintSha256 = fingerprint({
      ...reviewPayload,
      supersedes
    });

    return this.repository.record({
      workspaceId,
      formalMatterId,
      matterIntelligenceObservationId,
      outcome: value.outcome,
      ...(value.reason === undefined ? {} : { reason: value.reason }),
      ...(rationale === undefined ? {} : { rationale }),
      ...(supersedes === undefined ? {} : { supersedes }),
      reviewedByPrincipalId: principal.userId,
      idempotencyKey,
      correlationId,
      requestFingerprintSha256,
      reviewPayloadFingerprintSha256: fingerprint(reviewPayload),
      reviewedAt
    });
  }
}
