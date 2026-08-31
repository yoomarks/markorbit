import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import type { TransactionHost } from './formal-matter.js';
import {
  MATTER_INTELLIGENCE_CAPABILITY_ID,
  MATTER_INTELLIGENCE_CAPABILITY_VERSION,
  MATTER_INTELLIGENCE_INPUT_SCHEMA,
  MATTER_INTELLIGENCE_OBSERVATION_KIND,
  MATTER_INTELLIGENCE_OUTPUT_SCHEMA,
  type MarkRegMatterIntelligenceObservationV1
} from './matter-intelligence.js';
import type {
  MarkRegMatterIntelligenceReviewV1,
  MatterIntelligenceReviewOutcome,
  MatterIntelligenceReviewReason
} from './matter-intelligence-review.js';

export type MatterIntelligenceReadErrorCode =
  | 'INVALID_READ_QUERY'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'FORMAL_MATTER_NOT_FOUND'
  | 'PERSISTENCE_UNAVAILABLE';

export class MatterIntelligenceReadError extends Error {
  constructor(
    readonly code: MatterIntelligenceReadErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MatterIntelligenceReadError';
  }
}

export interface MatterIntelligenceReadQuery {
  page?: number;
  pageSize?: number;
  reviewHistoryLimit?: number;
}

export interface MatterIntelligenceReviewHistory {
  items: readonly MarkRegMatterIntelligenceReviewV1[];
  total: number;
}

export interface MatterIntelligenceReadItem {
  observation: MarkRegMatterIntelligenceObservationV1;
  matterSourceCurrent: boolean;
  currentReview: MarkRegMatterIntelligenceReviewV1 | null;
  reviewHistory: readonly MarkRegMatterIntelligenceReviewV1[];
  reviewHistoryTotal: number;
  reviewHistoryComplete: boolean;
  reviewState: 'UNREVIEWED' | 'REVIEWED';
}

export interface MatterIntelligenceReadProjection {
  formalMatter: Readonly<{
    id: FormalMatterId;
    version: number;
    snapshotSha256: string;
  }>;
  items: readonly MatterIntelligenceReadItem[];
  page: number;
  pageSize: number;
  total: number;
  reviewHistoryLimit: number;
  semantics: Readonly<{
    descriptiveHistoricalEvidence: true;
    prediction: false;
    deadline: false;
    serviceLevelAgreement: false;
    officialStatus: false;
  }>;
  authorityConsequences: Readonly<{
    officialTruthCreated: false;
    lifecycleStateMutated: false;
    formalMatterMutated: false;
    filingAuthorized: false;
    paymentAuthorized: false;
    externalActionExecuted: false;
  }>;
}

interface ReadRepositoryResult {
  formalMatter: MatterIntelligenceReadProjection['formalMatter'];
  observations: readonly MarkRegMatterIntelligenceObservationV1[];
  reviewsByObservationId: Readonly<Record<string, MatterIntelligenceReviewHistory>>;
  total: number;
}

export interface MatterIntelligenceReadRepository {
  readMatter(
    workspaceId: string,
    formalMatterId: FormalMatterId,
    page: number,
    pageSize: number,
    reviewHistoryLimit: number
  ): Promise<ReadRepositoryResult | null>;
}

type Row = Record<string, unknown> & {
  reason?: string | null;
  rationale?: string | null;
  supersedes_review_id?: string | null;
  supersedes_review_version?: number | string | null;
  history_total?: number | string;
};

const SHA256 = /^[0-9a-f]{64}$/;
const reviewOutcomes = new Set<MatterIntelligenceReviewOutcome>([
  'CONFIRMED',
  'OVERRIDDEN',
  'INCONCLUSIVE'
]);
const reviewReasons = new Set<MatterIntelligenceReviewReason>([
  'METHOD_ERROR',
  'INPUT_DATA_ERROR',
  'APPLICABILITY_ERROR',
  'PRODUCT_USER_PREFERENCE',
  'INCONCLUSIVE_EVIDENCE'
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function persistedError(message: string, options?: ErrorOptions): MatterIntelligenceReadError {
  return new MatterIntelligenceReadError('PERSISTENCE_UNAVAILABLE', message, 503, true, options);
}

function positiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1)
    throw persistedError(`Persisted ${field} is invalid.`);
  return number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw persistedError(`Persisted ${field} is invalid.`);
  return number;
}

function sha256(value: unknown, field: string): string {
  const text = String(value).toLowerCase();
  if (!SHA256.test(text)) throw persistedError(`Persisted ${field} is invalid.`);
  return text;
}

function timestamp(value: unknown, field: string): string {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw persistedError(`Persisted ${field} is invalid.`);
  return parsed.toISOString();
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw persistedError(`Persisted ${field} is invalid.`);
  return clone(value as string[]);
}

function exact(value: unknown, expected: string, field: string): string {
  const text = String(value);
  if (text !== expected) throw persistedError(`Persisted ${field} is incompatible.`);
  return text;
}

function mapObservation(row: Row): MarkRegMatterIntelligenceObservationV1 {
  exact(row.observation_kind, MATTER_INTELLIGENCE_OBSERVATION_KIND, 'observationKind');
  exact(row.dataset_ref_id, CN_DURATION_BAND_ACCEPTED_DATASET_REF, 'datasetRefId');
  exact(row.capability_id, MATTER_INTELLIGENCE_CAPABILITY_ID, 'capabilityId');
  exact(row.capability_version, MATTER_INTELLIGENCE_CAPABILITY_VERSION, 'capabilityVersion');
  exact(row.input_schema_id, MATTER_INTELLIGENCE_INPUT_SCHEMA, 'inputSchemaId');
  exact(row.output_schema_id, MATTER_INTELLIGENCE_OUTPUT_SCHEMA, 'outputSchemaId');

  return {
    schemaVersion: 1,
    matterIntelligenceObservationId: String(
      row.matter_intelligence_observation_id
    ) as MarkRegMatterIntelligenceObservationV1['matterIntelligenceObservationId'],
    workspaceId: String(row.workspace_id),
    formalMatter: {
      id: String(row.formal_matter_id) as FormalMatterId,
      version: positiveInteger(row.formal_matter_version, 'formalMatterVersion'),
      snapshotSha256: sha256(row.formal_matter_snapshot_sha256, 'formalMatterSnapshotSha256')
    },
    observationKind: MATTER_INTELLIGENCE_OBSERVATION_KIND,
    observedCompletedDurationDays: nonNegativeInteger(
      row.observed_completed_duration_days,
      'observedCompletedDurationDays'
    ),
    historicalBand: String(
      row.historical_band
    ) as MarkRegMatterIntelligenceObservationV1['historicalBand'],
    datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
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
      version: positiveInteger(row.implementation_version, 'implementationVersion'),
      implementationKey: String(row.implementation_key)
    },
    correlationId: String(row.correlation_id),
    capabilityCorrelationId: String(row.capability_correlation_id),
    methodPackageRef: String(row.method_package_ref),
    methodRef: String(row.method_ref),
    methodVersionRef: String(row.method_version_ref),
    evaluationRef: String(row.evaluation_ref),
    researchDatasetRef: String(row.research_dataset_ref),
    evidenceRefs: stringArray(row.evidence_refs, 'evidenceRefs'),
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

function mapReview(row: Row): MarkRegMatterIntelligenceReviewV1 {
  const outcome = String(row.outcome) as MatterIntelligenceReviewOutcome;
  if (!reviewOutcomes.has(outcome))
    throw persistedError('Persisted intelligence review outcome is invalid.');
  const reason =
    row.reason === null || row.reason === undefined
      ? undefined
      : (String(row.reason) as MatterIntelligenceReviewReason);
  if (reason !== undefined && !reviewReasons.has(reason))
    throw persistedError('Persisted intelligence review reason is invalid.');
  const supersedesReviewId =
    row.supersedes_review_id === null || row.supersedes_review_id === undefined
      ? undefined
      : String(row.supersedes_review_id);
  const supersedesReviewVersion =
    row.supersedes_review_version === null || row.supersedes_review_version === undefined
      ? undefined
      : positiveInteger(row.supersedes_review_version, 'supersedesReviewVersion');
  if ((supersedesReviewId === undefined) !== (supersedesReviewVersion === undefined))
    throw persistedError('Persisted intelligence review supersession is incomplete.');

  const review: MarkRegMatterIntelligenceReviewV1 = {
    schemaVersion: 1,
    matterIntelligenceReviewId: String(
      row.matter_intelligence_review_id
    ) as MarkRegMatterIntelligenceReviewV1['matterIntelligenceReviewId'],
    workspaceId: String(row.workspace_id),
    formalMatterId: String(row.formal_matter_id) as FormalMatterId,
    matterIntelligenceObservationId: String(row.matter_intelligence_observation_id),
    observationFingerprintSha256: sha256(
      row.observation_fingerprint_sha256,
      'observationFingerprintSha256'
    ),
    reviewVersion: positiveInteger(row.review_version, 'reviewVersion'),
    outcome,
    reviewedByPrincipalId: String(row.reviewed_by_principal_id),
    reviewedAt: timestamp(row.reviewed_at, 'reviewedAt'),
    reviewPayloadFingerprintSha256: sha256(
      row.review_payload_fingerprint_sha256,
      'reviewPayloadFingerprintSha256'
    ),
    reviewFingerprintSha256: sha256(row.review_fingerprint_sha256, 'reviewFingerprintSha256'),
    productSourceFingerprintSha256: sha256(
      row.product_source_fingerprint_sha256,
      'productSourceFingerprintSha256'
    ),
    correlationId: String(row.correlation_id)
  };
  if (reason !== undefined) review.reason = reason;
  if (row.rationale !== null && row.rationale !== undefined)
    review.rationale = String(row.rationale);
  if (supersedesReviewId !== undefined && supersedesReviewVersion !== undefined)
    review.supersedes = {
      reviewId:
        supersedesReviewId as MarkRegMatterIntelligenceReviewV1['matterIntelligenceReviewId'],
      reviewVersion: supersedesReviewVersion
    };
  return review;
}

function assertReviewLineage(
  items: readonly MarkRegMatterIntelligenceReviewV1[],
  total: number
): void {
  if (items.length === 0) {
    if (total !== 0) throw persistedError('Persisted intelligence review history is inconsistent.');
    return;
  }
  if (items[0]!.reviewVersion !== total)
    throw persistedError('Persisted intelligence review version/count lineage is inconsistent.');
  for (let index = 0; index < items.length; index += 1) {
    const current = items[index]!;
    if (current.reviewVersion === 1) {
      if (current.supersedes !== undefined)
        throw persistedError('Initial intelligence review cannot supersede another review.');
      continue;
    }
    const expectedVersion = current.reviewVersion - 1;
    if (!current.supersedes || current.supersedes.reviewVersion !== expectedVersion)
      throw persistedError('Persisted intelligence review supersession chain is inconsistent.');
    const older = items[index + 1];
    if (
      older &&
      (current.supersedes.reviewId !== older.matterIntelligenceReviewId ||
        current.supersedes.reviewVersion !== older.reviewVersion)
    )
      throw persistedError('Persisted intelligence review supersession identity is inconsistent.');
  }
}

export class PostgresMatterIntelligenceReadRepository implements MatterIntelligenceReadRepository {
  constructor(private readonly database: TransactionHost) {}

  async readMatter(
    workspaceId: string,
    formalMatterId: FormalMatterId,
    page: number,
    pageSize: number,
    reviewHistoryLimit: number
  ): Promise<ReadRepositoryResult | null> {
    try {
      return await this.database.transact(
        async (client) => {
          const matterResult = await client.query(
            'SELECT formal_matter_id,version,snapshot_sha256 FROM formal_matters WHERE workspace_id=$1 AND formal_matter_id=$2',
            [workspaceId, formalMatterId]
          );
          if (!matterResult.rowCount) return null;
          const matterRow = matterResult.rows[0] as Row;
          const formalMatter = {
            id: String(matterRow.formal_matter_id) as FormalMatterId,
            version: positiveInteger(matterRow.version, 'formalMatter.version'),
            snapshotSha256: sha256(matterRow.snapshot_sha256, 'formalMatter.snapshotSha256')
          };

          const countResult = await client.query(
            'SELECT count(*)::int AS total FROM markreg_matter_intelligence_observations WHERE workspace_id=$1 AND formal_matter_id=$2',
            [workspaceId, formalMatterId]
          );
          const total = nonNegativeInteger(
            (countResult.rows[0] as Row | undefined)?.total ?? 0,
            'observationTotal'
          );
          const offset = (page - 1) * pageSize;
          const observationResult = await client.query(
            'SELECT * FROM markreg_matter_intelligence_observations WHERE workspace_id=$1 AND formal_matter_id=$2 ORDER BY recorded_at DESC,matter_intelligence_observation_id ASC LIMIT $3 OFFSET $4',
            [workspaceId, formalMatterId, pageSize, offset]
          );
          const observations = observationResult.rows.map((row) => mapObservation(row as Row));
          const observationIds = observations.map((item) => item.matterIntelligenceObservationId);
          const reviewsByObservationId: Record<string, MatterIntelligenceReviewHistory> = {};

          if (observationIds.length > 0) {
            const reviewResult = await client.query(
              `WITH ranked AS (
                SELECT r.*,
                  row_number() OVER (
                    PARTITION BY r.matter_intelligence_observation_id
                    ORDER BY r.review_version DESC,r.matter_intelligence_review_id ASC
                  ) AS history_rank,
                  count(*) OVER (PARTITION BY r.matter_intelligence_observation_id)::int AS history_total
                FROM markreg_matter_intelligence_reviews r
                WHERE r.workspace_id=$1
                  AND r.formal_matter_id=$2
                  AND r.matter_intelligence_observation_id = ANY($3::text[])
              )
              SELECT * FROM ranked
              WHERE history_rank <= $4
              ORDER BY matter_intelligence_observation_id ASC,review_version DESC,matter_intelligence_review_id ASC`,
              [workspaceId, formalMatterId, observationIds, reviewHistoryLimit]
            );
            for (const rowValue of reviewResult.rows) {
              const row = rowValue as Row;
              const observationId = String(row.matter_intelligence_observation_id);
              const totalForObservation = nonNegativeInteger(
                row.history_total ?? 0,
                'reviewHistoryTotal'
              );
              const existing = reviewsByObservationId[observationId] ?? {
                items: [],
                total: totalForObservation
              };
              if (existing.total !== totalForObservation)
                throw persistedError(
                  'Persisted intelligence review history count changed mid-read.'
                );
              reviewsByObservationId[observationId] = {
                items: [...existing.items, mapReview(row)],
                total: totalForObservation
              };
            }
          }

          for (const observationId of observationIds) {
            const history = reviewsByObservationId[observationId] ?? { items: [], total: 0 };
            assertReviewLineage(history.items, history.total);
            reviewsByObservationId[observationId] = history;
          }

          return { formalMatter, observations, reviewsByObservationId, total };
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof MatterIntelligenceReadError) throw cause;
      throw persistedError('MarkReg Matter Intelligence read persistence is unavailable.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
  }
}

function readInteger(
  value: number | undefined,
  fallback: number,
  field: string,
  maximum: number
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum)
    throw new MatterIntelligenceReadError(
      'INVALID_READ_QUERY',
      `${field} must be an integer between 1 and ${maximum}.`,
      422
    );
  return resolved;
}

export class MatterIntelligenceReadService {
  constructor(private readonly repository: MatterIntelligenceReadRepository) {}

  async getForMatter(
    principal: WorkspacePrincipal,
    formalMatterId: FormalMatterId,
    query: Readonly<MatterIntelligenceReadQuery> = {}
  ): Promise<MatterIntelligenceReadProjection> {
    if (principal.kind !== 'WORKSPACE')
      throw new MatterIntelligenceReadError(
        'AUTHENTICATION_REQUIRED',
        'A trusted Workspace Principal is required.',
        401
      );
    if (!principal.permissions.includes('workspace:read'))
      throw new MatterIntelligenceReadError(
        'PERMISSION_DENIED',
        'workspace:read permission is required.',
        403
      );
    const cleanMatterId = String(formalMatterId).trim();
    if (!cleanMatterId || cleanMatterId.length > 300)
      throw new MatterIntelligenceReadError(
        'INVALID_READ_QUERY',
        'formalMatterId is invalid.',
        422
      );
    const page = readInteger(query.page, 1, 'page', 1_000_000);
    const pageSize = readInteger(query.pageSize, 20, 'pageSize', 50);
    const reviewHistoryLimit = readInteger(
      query.reviewHistoryLimit,
      20,
      'reviewHistoryLimit',
      50
    );
    const result = await this.repository.readMatter(
      principal.workspaceId,
      cleanMatterId as FormalMatterId,
      page,
      pageSize,
      reviewHistoryLimit
    );
    if (!result)
      throw new MatterIntelligenceReadError(
        'FORMAL_MATTER_NOT_FOUND',
        'Formal Matter was not found in this Workspace.',
        404
      );

    return {
      formalMatter: clone(result.formalMatter),
      items: result.observations.map((observation) => {
        const history =
          result.reviewsByObservationId[observation.matterIntelligenceObservationId] ?? {
            items: [],
            total: 0
          };
        return {
          observation: clone(observation),
          matterSourceCurrent:
            observation.formalMatter.version === result.formalMatter.version &&
            observation.formalMatter.snapshotSha256 === result.formalMatter.snapshotSha256,
          currentReview: history.items[0] ? clone(history.items[0]) : null,
          reviewHistory: clone(history.items),
          reviewHistoryTotal: history.total,
          reviewHistoryComplete: history.items.length === history.total,
          reviewState: history.total === 0 ? 'UNREVIEWED' : 'REVIEWED'
        };
      }),
      page,
      pageSize,
      total: result.total,
      reviewHistoryLimit,
      semantics: {
        descriptiveHistoricalEvidence: true,
        prediction: false,
        deadline: false,
        serviceLevelAgreement: false,
        officialStatus: false
      },
      authorityConsequences: {
        officialTruthCreated: false,
        lifecycleStateMutated: false,
        formalMatterMutated: false,
        filingAuthorized: false,
        paymentAuthorized: false,
        externalActionExecuted: false
      }
    };
  }
}
