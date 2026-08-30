import { createHash, randomUUID } from 'node:crypto';
import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import {
  assertMatterIntelligenceReviewTaxonomy,
  matterIntelligenceReviewOutcomes,
  matterIntelligenceReviewReasonCodes,
  parseMarkRegMatterIntelligenceReviewSourceAssertionV1,
  type MarkRegMatterIntelligenceReviewSourceAssertionV1,
  type MatterIntelligenceReviewId,
  type MatterIntelligenceReviewOutcome,
  type MatterIntelligenceReviewReasonCode
} from '@markorbit/contracts/method-outcome-evidence';
import type { QueryClient } from '@markorbit/persistence';
import type { TransactionHost } from './formal-matter.js';
import {
  MATTER_INTELLIGENCE_CAPABILITY_ID,
  MATTER_INTELLIGENCE_CAPABILITY_VERSION,
  MATTER_INTELLIGENCE_INPUT_SCHEMA,
  MATTER_INTELLIGENCE_OBSERVATION_KIND,
  MATTER_INTELLIGENCE_OUTPUT_SCHEMA,
  type MatterIntelligenceObservationId
} from './matter-intelligence.js';

const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MatterIntelligenceReviewErrorCode =
  | 'INVALID_INPUT'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'WORKSPACE_MISMATCH'
  | 'OBSERVATION_NOT_FOUND'
  | 'REVIEW_NOT_FOUND'
  | 'REVIEW_ALREADY_EXISTS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SOURCE_CONTRACT_MISMATCH'
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

export interface ReviewableMatterIntelligenceObservationV1 {
  schemaVersion: 1;
  matterIntelligenceObservationId: MatterIntelligenceObservationId;
  workspaceId: string;
  formalMatter: Readonly<{
    id: FormalMatterId;
    version: number;
    snapshotSha256: string;
  }>;
  observationKind: typeof MATTER_INTELLIGENCE_OBSERVATION_KIND;
  observedCompletedDurationDays: number;
  historicalBand: string;
  datasetRefId: string;
  capability: Readonly<{
    id: typeof MATTER_INTELLIGENCE_CAPABILITY_ID;
    version: typeof MATTER_INTELLIGENCE_CAPABILITY_VERSION;
    inputSchemaId: typeof MATTER_INTELLIGENCE_INPUT_SCHEMA;
    outputSchemaId: typeof MATTER_INTELLIGENCE_OUTPUT_SCHEMA;
  }>;
  capabilityRequestId: string;
  capabilityInvocationId: string;
  capabilityOutcomeId: string;
  capabilityReturnId: string;
  sessionReceiptId: string;
  implementation: Readonly<{
    id: string;
    version: number;
    implementationKey: string;
  }>;
  correlationId: string;
  capabilityCorrelationId: string;
  methodPackageRef: string;
  methodRef: string;
  methodVersionRef: string;
  evaluationRef: string;
  researchDatasetRef: string;
  evidenceRefs: readonly string[];
  evidenceFingerprintSha256: string;
  inputFingerprintSha256: string;
  outputFingerprintSha256: string;
  recordedByPrincipalId: string;
  recordedAt: string;
}

export interface MarkRegMatterIntelligenceReviewV1 {
  schemaVersion: 1;
  matterIntelligenceReviewId: MatterIntelligenceReviewId;
  version: 1;
  workspaceId: string;
  formalMatter: Readonly<{
    id: FormalMatterId;
    version: number;
  }>;
  reviewedObservation: Readonly<{
    id: MatterIntelligenceObservationId;
    fingerprintSha256: string;
    outputFingerprintSha256: string;
  }>;
  outcome: MatterIntelligenceReviewOutcome;
  reasonCode: MatterIntelligenceReviewReasonCode;
  rationale?: string;
  reviewerPrincipalId: string;
  reviewerMembershipId: string;
  reviewedAt: string;
  reviewFingerprintSha256: string;
}

export interface RecordMatterIntelligenceReviewCommand {
  workspaceId: string;
  formalMatterId: FormalMatterId;
  observationId: MatterIntelligenceObservationId;
  outcome: MatterIntelligenceReviewOutcome;
  reasonCode: MatterIntelligenceReviewReasonCode;
  rationale?: string;
  principal: WorkspacePrincipal;
  idempotencyKey: string;
  correlationId: string;
}

export interface MatterIntelligenceReviewDisposition {
  review: MarkRegMatterIntelligenceReviewV1;
  replayed: boolean;
  semanticDuplicate: boolean;
}

interface CommandReplay {
  requestFingerprintSha256: string;
  result: MatterIntelligenceReviewDisposition;
}

interface ReviewWrite {
  review: MarkRegMatterIntelligenceReviewV1;
  idempotencyKey: string;
  requestFingerprintSha256: string;
  correlationId: string;
}

type Row = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function text(value: string, field: string, maximum = 300): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new MatterIntelligenceReviewError(
      'INVALID_INPUT',
      `${field} must contain between 1 and ${maximum} characters.`,
      422
    );
  return cleaned;
}

function workspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new MatterIntelligenceReviewError('INVALID_INPUT', 'workspaceId must be a UUID.', 422);
  return cleaned;
}

function optionalRationale(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return text(value, 'rationale', 2000);
}

function timestamp(value: unknown, field: string): string {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime()))
    throw new MatterIntelligenceReviewError('PERSISTENCE_UNAVAILABLE', `${field} is invalid.`, 503);
  return parsed.toISOString();
}

function sha256(value: unknown, field: string): string {
  const cleaned = String(value).trim().toLowerCase();
  if (!SHA256.test(cleaned))
    throw new MatterIntelligenceReviewError('PERSISTENCE_UNAVAILABLE', `${field} is invalid.`, 503);
  return cleaned;
}

function evidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string'))
    throw new MatterIntelligenceReviewError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted observation evidenceRefs are invalid.',
      503
    );
  return [...value] as string[];
}

function reviewId(): MatterIntelligenceReviewId {
  return `matter-intelligence-review_${randomUUID().replaceAll('-', '')}`;
}

function reviewMatchesCommand(
  review: Readonly<MarkRegMatterIntelligenceReviewV1>,
  command: Readonly<{
    outcome: MatterIntelligenceReviewOutcome;
    reasonCode: MatterIntelligenceReviewReasonCode;
    rationale?: string;
    reviewerPrincipalId: string;
    reviewerMembershipId: string;
  }>
): boolean {
  return (
    review.outcome === command.outcome &&
    review.reasonCode === command.reasonCode &&
    review.rationale === command.rationale &&
    review.reviewerPrincipalId === command.reviewerPrincipalId &&
    review.reviewerMembershipId === command.reviewerMembershipId
  );
}

export class PostgresMatterIntelligenceReviewRepository {
  constructor(
    private readonly database: TransactionHost,
    private readonly query: QueryClient
  ) {}

  async findObservation(
    workspace: string,
    formalMatterId: string,
    observationId: string
  ): Promise<ReviewableMatterIntelligenceObservationV1 | undefined> {
    try {
      const result = await this.query.query(
        `SELECT * FROM markreg_matter_intelligence_observations
         WHERE workspace_id=$1 AND formal_matter_id=$2 AND matter_intelligence_observation_id=$3`,
        [workspace, formalMatterId, observationId]
      );
      return result.rowCount ? this.mapObservation(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.persistenceError(cause);
    }
  }

  async findCommandReplay(workspace: string, key: string): Promise<CommandReplay | undefined> {
    try {
      const result = await this.query.query(
        `SELECT request_fingerprint_sha256,result_snapshot
         FROM markreg_matter_intelligence_review_commands
         WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspace, key]
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0] as Row;
      return {
        requestFingerprintSha256: String(row.request_fingerprint_sha256),
        result: clone(row.result_snapshot as MatterIntelligenceReviewDisposition)
      };
    } catch (cause) {
      throw this.persistenceError(cause);
    }
  }

  async findReview(
    workspace: string,
    id: string,
    version = 1
  ): Promise<MarkRegMatterIntelligenceReviewV1 | undefined> {
    if (version !== 1) return undefined;
    try {
      const result = await this.query.query(
        `SELECT * FROM markreg_matter_intelligence_reviews
         WHERE workspace_id=$1 AND matter_intelligence_review_id=$2 AND review_version=$3`,
        [workspace, id, version]
      );
      return result.rowCount ? this.mapReview(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.persistenceError(cause);
    }
  }

  async findReviewByObservation(
    workspace: string,
    observationId: string
  ): Promise<MarkRegMatterIntelligenceReviewV1 | undefined> {
    try {
      const result = await this.query.query(
        `SELECT * FROM markreg_matter_intelligence_reviews
         WHERE workspace_id=$1 AND matter_intelligence_observation_id=$2`,
        [workspace, observationId]
      );
      return result.rowCount ? this.mapReview(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.persistenceError(cause);
    }
  }

  async record(value: Readonly<ReviewWrite>): Promise<MatterIntelligenceReviewDisposition> {
    try {
      return await this.database.transact(
        async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `matter-intelligence-review-command:${value.review.workspaceId}:${value.idempotencyKey}`
          ]);
          const replay = await client.query(
            `SELECT request_fingerprint_sha256,result_snapshot
             FROM markreg_matter_intelligence_review_commands
             WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE`,
            [value.review.workspaceId, value.idempotencyKey]
          );
          if (replay.rowCount) {
            const row = replay.rows[0] as Row;
            if (String(row.request_fingerprint_sha256) !== value.requestFingerprintSha256)
              throw new MatterIntelligenceReviewError(
                'IDEMPOTENCY_CONFLICT',
                'Idempotency-Key was already used for a different review command.'
              );
            return clone(row.result_snapshot as MatterIntelligenceReviewDisposition);
          }

          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `matter-intelligence-review-observation:${value.review.workspaceId}:${value.review.reviewedObservation.id}`
          ]);
          const existingResult = await client.query(
            `SELECT * FROM markreg_matter_intelligence_reviews
             WHERE workspace_id=$1 AND matter_intelligence_observation_id=$2`,
            [value.review.workspaceId, value.review.reviewedObservation.id]
          );
          let review = value.review;
          let semanticDuplicate = false;
          if (existingResult.rowCount) {
            review = this.mapReview(existingResult.rows[0] as Row);
            if (
              !reviewMatchesCommand(review, {
                outcome: value.review.outcome,
                reasonCode: value.review.reasonCode,
                rationale: value.review.rationale,
                reviewerPrincipalId: value.review.reviewerPrincipalId,
                reviewerMembershipId: value.review.reviewerMembershipId
              }) ||
              review.reviewedObservation.fingerprintSha256 !==
                value.review.reviewedObservation.fingerprintSha256
            )
              throw new MatterIntelligenceReviewError(
                'REVIEW_ALREADY_EXISTS',
                'The exact Matter Intelligence observation already has a different V1 review.'
              );
            semanticDuplicate = true;
          } else {
            await client.query(
              `INSERT INTO markreg_matter_intelligence_reviews (
                 matter_intelligence_review_id,workspace_id,review_version,
                 formal_matter_id,formal_matter_version,matter_intelligence_observation_id,
                 observation_fingerprint_sha256,output_fingerprint_sha256,
                 outcome,reason_code,rationale,reviewer_principal_id,reviewer_membership_id,
                 reviewed_at,review_fingerprint_sha256
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
              [
                review.matterIntelligenceReviewId,
                review.workspaceId,
                review.version,
                review.formalMatter.id,
                review.formalMatter.version,
                review.reviewedObservation.id,
                review.reviewedObservation.fingerprintSha256,
                review.reviewedObservation.outputFingerprintSha256,
                review.outcome,
                review.reasonCode,
                review.rationale ?? null,
                review.reviewerPrincipalId,
                review.reviewerMembershipId,
                review.reviewedAt,
                review.reviewFingerprintSha256
              ]
            );
          }

          const disposition: MatterIntelligenceReviewDisposition = {
            review,
            replayed: false,
            semanticDuplicate
          };
          await client.query(
            `INSERT INTO markreg_matter_intelligence_review_commands (
               workspace_id,idempotency_key,request_fingerprint_sha256,
               matter_intelligence_review_id,result_snapshot,correlation_id,created_at
             ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
            [
              review.workspaceId,
              value.idempotencyKey,
              value.requestFingerprintSha256,
              review.matterIntelligenceReviewId,
              JSON.stringify(disposition),
              value.correlationId,
              review.reviewedAt
            ]
          );
          return disposition;
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof MatterIntelligenceReviewError) throw cause;
      throw this.persistenceError(cause);
    }
  }

  private mapObservation(row: Row): ReviewableMatterIntelligenceObservationV1 {
    return {
      schemaVersion: 1,
      matterIntelligenceObservationId: String(
        row.matter_intelligence_observation_id
      ) as MatterIntelligenceObservationId,
      workspaceId: String(row.workspace_id),
      formalMatter: {
        id: String(row.formal_matter_id) as FormalMatterId,
        version: Number(row.formal_matter_version),
        snapshotSha256: sha256(row.formal_matter_snapshot_sha256, 'formalMatter.snapshotSha256')
      },
      observationKind: MATTER_INTELLIGENCE_OBSERVATION_KIND,
      observedCompletedDurationDays: Number(row.observed_completed_duration_days),
      historicalBand: String(row.historical_band),
      datasetRefId: String(row.dataset_ref_id),
      capability: {
        id: MATTER_INTELLIGENCE_CAPABILITY_ID,
        version: MATTER_INTELLIGENCE_CAPABILITY_VERSION,
        inputSchemaId: MATTER_INTELLIGENCE_INPUT_SCHEMA,
        outputSchemaId: MATTER_INTELLIGENCE_OUTPUT_SCHEMA
      },
      capabilityRequestId: String(row.capability_request_id),
      capabilityInvocationId: String(row.capability_invocation_id),
      capabilityOutcomeId: String(row.capability_outcome_id),
      capabilityReturnId: String(row.capability_return_id),
      sessionReceiptId: String(row.session_receipt_id),
      implementation: {
        id: String(row.implementation_profile_id),
        version: Number(row.implementation_version),
        implementationKey: String(row.implementation_key)
      },
      correlationId: String(row.correlation_id),
      capabilityCorrelationId: String(row.capability_correlation_id),
      methodPackageRef: String(row.method_package_ref),
      methodRef: String(row.method_ref),
      methodVersionRef: String(row.method_version_ref),
      evaluationRef: String(row.evaluation_ref),
      researchDatasetRef: String(row.research_dataset_ref),
      evidenceRefs: evidenceRefs(row.evidence_refs),
      evidenceFingerprintSha256: sha256(
        row.evidence_fingerprint_sha256,
        'evidenceFingerprintSha256'
      ),
      inputFingerprintSha256: sha256(row.input_fingerprint_sha256, 'inputFingerprintSha256'),
      outputFingerprintSha256: sha256(row.output_fingerprint_sha256, 'outputFingerprintSha256'),
      recordedByPrincipalId: String(row.recorded_by_principal_id),
      recordedAt: timestamp(row.recorded_at, 'recordedAt')
    };
  }

  private mapReview(row: Row): MarkRegMatterIntelligenceReviewV1 {
    return {
      schemaVersion: 1,
      matterIntelligenceReviewId: String(row.matter_intelligence_review_id) as MatterIntelligenceReviewId,
      version: 1,
      workspaceId: String(row.workspace_id),
      formalMatter: {
        id: String(row.formal_matter_id) as FormalMatterId,
        version: Number(row.formal_matter_version)
      },
      reviewedObservation: {
        id: String(row.matter_intelligence_observation_id) as MatterIntelligenceObservationId,
        fingerprintSha256: sha256(row.observation_fingerprint_sha256, 'observationFingerprintSha256'),
        outputFingerprintSha256: sha256(row.output_fingerprint_sha256, 'outputFingerprintSha256')
      },
      outcome: String(row.outcome) as MatterIntelligenceReviewOutcome,
      reasonCode: String(row.reason_code) as MatterIntelligenceReviewReasonCode,
      ...(row.rationale === null || row.rationale === undefined
        ? {}
        : { rationale: String(row.rationale) }),
      reviewerPrincipalId: String(row.reviewer_principal_id),
      reviewerMembershipId: String(row.reviewer_membership_id),
      reviewedAt: timestamp(row.reviewed_at, 'reviewedAt'),
      reviewFingerprintSha256: sha256(row.review_fingerprint_sha256, 'reviewFingerprintSha256')
    };
  }

  private persistenceError(cause: unknown): MatterIntelligenceReviewError {
    return new MatterIntelligenceReviewError(
      'PERSISTENCE_UNAVAILABLE',
      'MarkReg Matter Intelligence review persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

export class MatterIntelligenceReviewService {
  constructor(
    private readonly repository: PostgresMatterIntelligenceReviewRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly ids: () => MatterIntelligenceReviewId = reviewId
  ) {}

  async record(
    command: Readonly<RecordMatterIntelligenceReviewCommand>
  ): Promise<MatterIntelligenceReviewDisposition> {
    const workspace = workspaceId(command.workspaceId);
    const formalMatterId = text(command.formalMatterId, 'formalMatterId', 300) as FormalMatterId;
    const observationId = text(
      command.observationId,
      'observationId',
      300
    ) as MatterIntelligenceObservationId;
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = text(command.correlationId, 'correlationId', 300);
    const rationale = optionalRationale(command.rationale);
    const principal = command.principal;

    if (principal.kind !== 'WORKSPACE')
      throw new MatterIntelligenceReviewError(
        'AUTHENTICATION_REQUIRED',
        'A trusted Workspace Principal is required.',
        401
      );
    if (principal.workspaceId !== workspace)
      throw new MatterIntelligenceReviewError(
        'WORKSPACE_MISMATCH',
        'Workspace context does not match Principal truth.',
        403
      );
    if (
      !principal.permissions.includes('workspace:read') ||
      !principal.permissions.includes('matter:read') ||
      !principal.permissions.includes('matter:manage')
    )
      throw new MatterIntelligenceReviewError(
        'PERMISSION_DENIED',
        'workspace:read, matter:read and matter:manage permissions are required.',
        403
      );
    if (!(matterIntelligenceReviewOutcomes as readonly string[]).includes(command.outcome))
      throw new MatterIntelligenceReviewError('INVALID_INPUT', 'outcome is invalid.', 422);
    if (!(matterIntelligenceReviewReasonCodes as readonly string[]).includes(command.reasonCode))
      throw new MatterIntelligenceReviewError('INVALID_INPUT', 'reasonCode is invalid.', 422);
    try {
      assertMatterIntelligenceReviewTaxonomy(command.outcome, command.reasonCode);
    } catch (cause) {
      throw new MatterIntelligenceReviewError(
        'INVALID_INPUT',
        cause instanceof Error ? cause.message : 'Review taxonomy is invalid.',
        422
      );
    }

    const requestFingerprintSha256 = fingerprint({
      workspaceId: workspace,
      formalMatterId,
      observationId,
      outcome: command.outcome,
      reasonCode: command.reasonCode,
      rationale,
      reviewerPrincipalId: principal.userId,
      reviewerMembershipId: principal.membershipId
    });
    const replay = await this.repository.findCommandReplay(workspace, idempotencyKey);
    if (replay) {
      if (replay.requestFingerprintSha256 !== requestFingerprintSha256)
        throw new MatterIntelligenceReviewError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used for a different review command.'
        );
      return { ...clone(replay.result), replayed: true };
    }

    const observation = await this.repository.findObservation(
      workspace,
      formalMatterId,
      observationId
    );
    if (!observation)
      throw new MatterIntelligenceReviewError(
        'OBSERVATION_NOT_FOUND',
        'The exact Matter Intelligence observation was not found in this Workspace/Formal Matter.',
        404
      );

    const observationFingerprintSha256 = fingerprint(observation);
    const reviewedAt = new Date(this.now()).toISOString();
    const base = {
      workspaceId: workspace,
      formalMatter: {
        id: observation.formalMatter.id,
        version: observation.formalMatter.version
      },
      reviewedObservation: {
        id: observation.matterIntelligenceObservationId,
        fingerprintSha256: observationFingerprintSha256,
        outputFingerprintSha256: observation.outputFingerprintSha256
      },
      outcome: command.outcome,
      reasonCode: command.reasonCode,
      ...(rationale ? { rationale } : {}),
      reviewerPrincipalId: principal.userId,
      reviewerMembershipId: principal.membershipId,
      reviewedAt
    } as const;
    const review: MarkRegMatterIntelligenceReviewV1 = {
      schemaVersion: 1,
      matterIntelligenceReviewId: this.ids(),
      version: 1,
      ...base,
      reviewFingerprintSha256: fingerprint({ schemaVersion: 1, version: 1, ...base })
    };
    return this.repository.record({
      review,
      idempotencyKey,
      requestFingerprintSha256,
      correlationId
    });
  }

  async resolveSource(
    workspaceValue: string,
    reviewIdValue: string,
    version: number
  ): Promise<MarkRegMatterIntelligenceReviewSourceAssertionV1> {
    const workspace = workspaceId(workspaceValue);
    if (version !== 1)
      throw new MatterIntelligenceReviewError(
        'REVIEW_NOT_FOUND',
        'The exact Matter Intelligence review version was not found.',
        404
      );
    const review = await this.repository.findReview(workspace, reviewIdValue, version);
    if (!review)
      throw new MatterIntelligenceReviewError(
        'REVIEW_NOT_FOUND',
        'The exact Matter Intelligence review was not found.',
        404
      );
    const observation = await this.repository.findObservation(
      workspace,
      review.formalMatter.id,
      review.reviewedObservation.id
    );
    if (!observation)
      throw new MatterIntelligenceReviewError(
        'SOURCE_CONTRACT_MISMATCH',
        'Review source observation is unavailable.',
        409
      );
    const currentObservationFingerprint = fingerprint(observation);
    if (
      currentObservationFingerprint !== review.reviewedObservation.fingerprintSha256 ||
      observation.outputFingerprintSha256 !== review.reviewedObservation.outputFingerprintSha256
    )
      throw new MatterIntelligenceReviewError(
        'SOURCE_CONTRACT_MISMATCH',
        'Review source observation fingerprint no longer matches the reviewed snapshot.',
        409
      );

    try {
      return parseMarkRegMatterIntelligenceReviewSourceAssertionV1({
        schemaVersion: 1,
        source: {
          owner: 'MARKREG',
          kind: 'MATTER_INTELLIGENCE_REVIEW',
          sourceId: review.matterIntelligenceReviewId,
          sourceVersion: review.version,
          sourceFingerprintSha256: review.reviewFingerprintSha256,
          observedAt: review.reviewedAt
        },
        workspaceId: review.workspaceId,
        formalMatter: review.formalMatter,
        reviewedObservation: review.reviewedObservation,
        review: {
          outcome: review.outcome,
          reasonCode: review.reasonCode,
          ...(review.rationale ? { rationale: review.rationale } : {}),
          reviewerPrincipalId: review.reviewerPrincipalId,
          reviewerMembershipId: review.reviewerMembershipId,
          reviewedAt: review.reviewedAt
        },
        production: {
          capability: {
            id: observation.capability.id,
            version: observation.capability.version,
            returnId: observation.capabilityReturnId,
            sessionReceiptId: observation.sessionReceiptId
          },
          methodPackageRef: observation.methodPackageRef,
          methodRef: observation.methodRef,
          methodVersionRef: observation.methodVersionRef,
          evaluationRef: observation.evaluationRef,
          researchDatasetRef: observation.researchDatasetRef,
          inputFingerprintSha256: observation.inputFingerprintSha256,
          outputFingerprintSha256: observation.outputFingerprintSha256,
          evidenceFingerprintSha256: observation.evidenceFingerprintSha256
        }
      });
    } catch (cause) {
      throw new MatterIntelligenceReviewError(
        'SOURCE_CONTRACT_MISMATCH',
        cause instanceof Error ? cause.message : 'Review source assertion is invalid.',
        409,
        false,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
}
