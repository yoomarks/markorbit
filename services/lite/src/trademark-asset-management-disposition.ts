import { createHash, randomUUID } from 'node:crypto';
import {
  trademarkAssetManagementDispositionKinds,
  type TrademarkAssetManagementDisposition,
  type TrademarkAssetManagementDispositionId,
  type TrademarkAssetManagementDispositionKind,
  type TrademarkAssetManagementRecommendation,
  type TrademarkAssetManagementRecommendationId,
  type TrademarkAssetManagementSignal,
  type TrademarkAssetManagementSignalId
} from '@markorbit/contracts/trademark-asset-management';
import {
  trademarkAssetRelationKinds,
  trademarkAssetSourceOwners,
  type TrademarkAssetId,
  type TrademarkAssetRelation
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import {
  PostgresTrademarkAssetManagementCurrentOwnerResolver,
  type TrademarkAssetManagementCurrentOwnerResolver
} from './trademark-asset-management-current-owner.js';
import { TrademarkAssetPersistenceError } from './trademark-asset.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

export type TrademarkAssetManagementRecoveryJobId = `trademark-asset-management-recovery_${string}`;
export type TrademarkAssetManagementRecoveryKind =
  'REFRESH_PORTFOLIO_PROJECTION' | 'REBUILD_MANAGEMENT_SIGNAL';
export type TrademarkAssetManagementRecoveryStatus =
  'PENDING' | 'LEASED' | 'SUCCEEDED' | 'DEAD_LETTER';

export interface RecordTrademarkAssetManagementDispositionCommand {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedTrademarkAssetVersion: number;
  managementSignal: Readonly<{
    id: TrademarkAssetManagementSignalId;
    version: number;
  }>;
  recommendation?: Readonly<{
    id: TrademarkAssetManagementRecommendationId;
    version: number;
  }>;
  kind: TrademarkAssetManagementDispositionKind;
  subjectUserId: string;
  note?: string;
  workflowReference?: Readonly<TrademarkAssetRelation>;
  idempotencyKey: string;
}

export interface CurrentTrademarkAssetManagementDispositionProjection {
  schemaVersion: 1;
  workspaceId: string;
  asset: Readonly<{ id: TrademarkAssetId; version: number }>;
  items: ReadonlyArray<
    Readonly<{
      signal: Readonly<{ id: TrademarkAssetManagementSignalId; version: number }>;
      disposition: Readonly<TrademarkAssetManagementDisposition> | null;
    }>
  >;
}

export interface TrademarkAssetManagementRecoveryJob {
  schemaVersion: 1;
  recoveryJobId: TrademarkAssetManagementRecoveryJobId;
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  dispositionId: TrademarkAssetManagementDispositionId;
  recoveryKind: TrademarkAssetManagementRecoveryKind;
  status: TrademarkAssetManagementRecoveryStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  leaseUntil?: string;
  lastFailure?: string;
  protectedActionAuthorized: false;
  filingAuthorized: false;
  externalContactAuthorized: false;
  paymentAuthorized: false;
  publicationAuthorized: false;
}

export interface TrademarkAssetManagementRecoveryAttemptDecision {
  status: 'PENDING' | 'DEAD_LETTER';
  attemptCount: number;
  availableAt: string;
}

export type TrademarkAssetManagementDispositionErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'LEASE_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkAssetManagementDispositionError extends Error {
  constructor(
    readonly code: TrademarkAssetManagementDispositionErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkAssetManagementDispositionError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function cleanText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      `${field} must be a non-empty string of at most ${max} characters.`,
      400
    );
  }
  return value.trim();
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned)) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      400
    );
  }
  return cleaned;
}

function cleanAssetId(value: TrademarkAssetId): TrademarkAssetId {
  const cleaned = cleanText(value, 'trademarkAssetId', 300);
  if (!cleaned.startsWith('trademark-asset_')) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'trademarkAssetId must use the trademark-asset_ prefix.',
      400
    );
  }
  return cleaned as TrademarkAssetId;
}

function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      400
    );
  }
  return parsed.toISOString();
}

function exactVersion(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      `${field} must be a positive integer.`,
      400
    );
  }
  return Number(value);
}

function exactSignal(
  signals: readonly Readonly<TrademarkAssetManagementSignal>[],
  id: TrademarkAssetManagementSignalId,
  version: number
): TrademarkAssetManagementSignal {
  const signal = signals.find((candidate) => candidate.managementSignalId === id);
  if (!signal) {
    throw new TrademarkAssetManagementDispositionError(
      'NOT_FOUND',
      'Management Signal was not found in the current owner projection.',
      404
    );
  }
  if (signal.version !== version) {
    throw new TrademarkAssetManagementDispositionError(
      'VERSION_CONFLICT',
      'Management Signal changed since the requested version.'
    );
  }
  return signal;
}

function exactRecommendation(
  recommendations: readonly Readonly<TrademarkAssetManagementRecommendation>[],
  id: TrademarkAssetManagementRecommendationId,
  version: number
): TrademarkAssetManagementRecommendation {
  const recommendation = recommendations.find((candidate) => candidate.recommendationId === id);
  if (!recommendation) {
    throw new TrademarkAssetManagementDispositionError(
      'NOT_FOUND',
      'Management Recommendation was not found in the current owner projection.',
      404
    );
  }
  if (recommendation.version !== version) {
    throw new TrademarkAssetManagementDispositionError(
      'VERSION_CONFLICT',
      'Management Recommendation changed since the requested version.'
    );
  }
  return recommendation;
}

function corruptDisposition(message: string): never {
  throw new TrademarkAssetManagementDispositionError(
    'PERSISTENCE_UNAVAILABLE',
    `Stored Trademark Asset management disposition is invalid: ${message}`,
    503,
    true
  );
}

function persistedRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return corruptDisposition(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function persistedText(value: unknown, field: string, maximum = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    return corruptDisposition(`${field} must be a bounded non-empty string.`);
  }
  return value.trim();
}

function persistedVersion(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    return corruptDisposition(`${field} must be a positive safe integer.`);
  }
  return Number(value);
}

function persistedInstant(value: unknown, field: string): string {
  const parsed = typeof value === 'string' || value instanceof Date ? new Date(value) : undefined;
  if (!parsed || Number.isNaN(parsed.valueOf())) {
    return corruptDisposition(`${field} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function persistedReference(
  value: unknown,
  field: string
): Readonly<{ id: string; version: number }> {
  const reference = persistedRecord(value, field);
  if (
    Object.keys(reference).length !== 2 ||
    !Object.hasOwn(reference, 'id') ||
    !Object.hasOwn(reference, 'version')
  ) {
    return corruptDisposition(`${field} must contain exactly id and version.`);
  }
  return {
    id: persistedText(reference.id, `${field}.id`, 300),
    version: persistedVersion(reference.version, `${field}.version`)
  };
}

function persistedWorkflowReference(value: unknown): Readonly<TrademarkAssetRelation> {
  const reference = persistedRecord(value, 'document_json.workflowReference');
  const allowed = new Set(['kind', 'owner', 'referenceId', 'referenceVersion']);
  if (Object.keys(reference).some((key) => !allowed.has(key))) {
    return corruptDisposition('workflowReference contains unsupported fields.');
  }
  const kind = persistedText(reference.kind, 'document_json.workflowReference.kind', 100);
  const owner = persistedText(reference.owner, 'document_json.workflowReference.owner', 100);
  const referenceId = persistedText(
    reference.referenceId,
    'document_json.workflowReference.referenceId',
    500
  );
  if (!trademarkAssetRelationKinds.includes(kind as TrademarkAssetRelation['kind'])) {
    return corruptDisposition('workflowReference.kind is unsupported.');
  }
  if (
    owner === 'WORKSPACE_USER' ||
    !trademarkAssetSourceOwners.includes(owner as (typeof trademarkAssetSourceOwners)[number])
  ) {
    return corruptDisposition('workflowReference.owner is unsupported.');
  }
  const referenceVersion =
    reference.referenceVersion === undefined
      ? undefined
      : persistedText(
          reference.referenceVersion,
          'document_json.workflowReference.referenceVersion',
          300
        );
  return {
    kind: kind as TrademarkAssetRelation['kind'],
    owner: owner as TrademarkAssetRelation['owner'],
    referenceId,
    ...(referenceVersion ? { referenceVersion } : {})
  };
}

function persistedDisposition(
  row: Row,
  workspaceId: string,
  trademarkAssetId: TrademarkAssetId
): TrademarkAssetManagementDisposition {
  const document = persistedRecord(row.document_json, 'document_json');
  const allowed = new Set([
    'schemaVersion',
    'dispositionId',
    'workspaceId',
    'version',
    'asset',
    'signal',
    'recommendation',
    'kind',
    'subjectUserId',
    'note',
    'workflowReference',
    'recordedAt',
    'officialTruthCreated',
    'legalConclusionVerified',
    'capabilityVerified'
  ]);
  if (Object.keys(document).some((key) => !allowed.has(key))) {
    return corruptDisposition('document_json contains unsupported fields.');
  }
  if (document.schemaVersion !== 1) {
    return corruptDisposition('schemaVersion must be 1.');
  }

  const dispositionId = persistedText(document.dispositionId, 'document_json.dispositionId', 300);
  const rowDispositionId = persistedText(row.disposition_id, 'disposition_id', 300);
  if (dispositionId !== rowDispositionId) {
    return corruptDisposition('disposition identity does not match normalized persistence.');
  }
  const documentWorkspaceId = persistedText(document.workspaceId, 'document_json.workspaceId', 100);
  if (documentWorkspaceId.toLowerCase() !== workspaceId) {
    return corruptDisposition('workspace lineage does not match the requested Workspace.');
  }
  const rowWorkspaceId = persistedText(row.workspace_id, 'workspace_id', 100).toLowerCase();
  if (rowWorkspaceId !== workspaceId) {
    return corruptDisposition(
      'normalized workspace lineage does not match the requested Workspace.'
    );
  }
  const version = persistedVersion(document.version, 'document_json.version');
  if (version !== persistedVersion(row.version, 'version')) {
    return corruptDisposition('version does not match normalized persistence.');
  }

  const asset = persistedReference(document.asset, 'document_json.asset');
  if (
    asset.id !== trademarkAssetId ||
    persistedText(row.trademark_asset_id, 'trademark_asset_id', 300) !== trademarkAssetId
  ) {
    return corruptDisposition('Asset lineage does not match the requested Asset.');
  }
  const signal = persistedReference(document.signal, 'document_json.signal');
  if (signal.id !== persistedText(row.management_signal_id, 'management_signal_id', 300)) {
    return corruptDisposition('Signal lineage does not match normalized persistence.');
  }

  const recommendationId =
    row.recommendation_id === null || row.recommendation_id === undefined
      ? undefined
      : persistedText(row.recommendation_id, 'recommendation_id', 300);
  const recommendation =
    document.recommendation === undefined
      ? undefined
      : persistedReference(document.recommendation, 'document_json.recommendation');
  if (
    (recommendationId === undefined) !== (recommendation === undefined) ||
    (recommendationId !== undefined && recommendation?.id !== recommendationId)
  ) {
    return corruptDisposition('Recommendation lineage does not match normalized persistence.');
  }

  const kind = persistedText(document.kind, 'document_json.kind', 100);
  if (
    !trademarkAssetManagementDispositionKinds.includes(
      kind as TrademarkAssetManagementDispositionKind
    ) ||
    kind !== persistedText(row.disposition_kind, 'disposition_kind', 100)
  ) {
    return corruptDisposition('Disposition kind does not match normalized persistence.');
  }
  const subjectUserId = persistedText(document.subjectUserId, 'document_json.subjectUserId', 300);
  if (subjectUserId !== persistedText(row.subject_user_id, 'subject_user_id', 300)) {
    return corruptDisposition('subject user does not match normalized persistence.');
  }
  const note =
    document.note === undefined ? undefined : persistedText(document.note, 'document_json.note');
  const workflowReference =
    document.workflowReference === undefined
      ? undefined
      : persistedWorkflowReference(document.workflowReference);
  const recordedAt = persistedInstant(document.recordedAt, 'document_json.recordedAt');
  if (recordedAt !== persistedInstant(row.recorded_at, 'recorded_at')) {
    return corruptDisposition('recordedAt does not match normalized persistence.');
  }
  if (
    document.officialTruthCreated !== false ||
    document.legalConclusionVerified !== false ||
    document.capabilityVerified !== false
  ) {
    return corruptDisposition('authority consequences must remain false.');
  }

  return {
    schemaVersion: 1,
    dispositionId: dispositionId as TrademarkAssetManagementDispositionId,
    workspaceId,
    version,
    asset: { id: asset.id as TrademarkAssetId, version: asset.version },
    signal: {
      id: signal.id as TrademarkAssetManagementSignalId,
      version: signal.version
    },
    ...(recommendation
      ? {
          recommendation: {
            id: recommendation.id as TrademarkAssetManagementRecommendationId,
            version: recommendation.version
          }
        }
      : {}),
    kind: kind as TrademarkAssetManagementDispositionKind,
    subjectUserId,
    ...(note ? { note } : {}),
    ...(workflowReference ? { workflowReference } : {}),
    recordedAt,
    officialTruthCreated: false,
    legalConclusionVerified: false,
    capabilityVerified: false
  };
}

function nextDispositionId(): TrademarkAssetManagementDispositionId {
  return `trademark-asset-management-disposition_${randomUUID().replaceAll('-', '')}`;
}

function nextRecoveryJobId(): TrademarkAssetManagementRecoveryJobId {
  return `trademark-asset-management-recovery_${randomUUID().replaceAll('-', '')}`;
}

export function nextTrademarkAssetManagementRecoveryAttempt(
  nowValue: string,
  priorAttemptCount: number,
  maxAttempts: number
): TrademarkAssetManagementRecoveryAttemptDecision {
  const now = new Date(timestamp(nowValue, 'now'));
  if (!Number.isInteger(priorAttemptCount) || priorAttemptCount < 0) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'priorAttemptCount must be a non-negative integer.',
      400
    );
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new TrademarkAssetManagementDispositionError(
      'INVALID_INPUT',
      'maxAttempts must be between 1 and 20.',
      400
    );
  }
  const attemptCount = priorAttemptCount + 1;
  if (attemptCount >= maxAttempts) {
    return { status: 'DEAD_LETTER', attemptCount, availableAt: now.toISOString() };
  }
  const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, attemptCount - 1));
  return {
    status: 'PENDING',
    attemptCount,
    availableAt: new Date(now.valueOf() + delaySeconds * 1000).toISOString()
  };
}

export const trademarkAssetManagementDispositionRecoveryAuthority = {
  mayPersistPrivateDisposition: true,
  mayMaintainWatchState: true,
  mayRetryInternalProjectionWork: true,
  mayDeadLetterInternalProjectionWork: true,
  mayReplayDeadLetterAfterExplicitInternalRecovery: true,
  mayCreateOfficialTruth: false,
  mayCertifyLegalDeadline: false,
  mayCreateLegalConclusion: false,
  mayAuthorizeFiling: false,
  mayAuthorizeExternalContact: false,
  mayAuthorizePayment: false,
  mayAuthorizeExternalPublication: false,
  mayCreateVerifiedCapability: false,
  mayUseCrossServiceSql: false
} as const;

export class PostgresTrademarkAssetManagementDispositionStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly dispositionId: () => TrademarkAssetManagementDispositionId = nextDispositionId,
    private readonly recoveryJobId: () => TrademarkAssetManagementRecoveryJobId = nextRecoveryJobId,
    private readonly currentOwner: TrademarkAssetManagementCurrentOwnerResolver = new PostgresTrademarkAssetManagementCurrentOwnerResolver(
      database
    )
  ) {}

  async record(
    command: Readonly<RecordTrademarkAssetManagementDispositionCommand>
  ): Promise<TrademarkAssetManagementDisposition> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const trademarkAssetId = cleanAssetId(command.trademarkAssetId);
    const expectedTrademarkAssetVersion = exactVersion(
      command.expectedTrademarkAssetVersion,
      'expectedTrademarkAssetVersion'
    );
    const managementSignalId = cleanText(
      command.managementSignal.id,
      'managementSignal.id',
      300
    ) as TrademarkAssetManagementSignalId;
    const managementSignalVersion = exactVersion(
      command.managementSignal.version,
      'managementSignal.version'
    );
    const recommendationId = command.recommendation
      ? (cleanText(
          command.recommendation.id,
          'recommendation.id',
          300
        ) as TrademarkAssetManagementRecommendationId)
      : undefined;
    const recommendationVersion = command.recommendation
      ? exactVersion(command.recommendation.version, 'recommendation.version')
      : undefined;
    if (!trademarkAssetManagementDispositionKinds.includes(command.kind)) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'Unknown management disposition kind.',
        400
      );
    }
    const subjectUserId = cleanText(command.subjectUserId, 'subjectUserId', 300);
    const note = command.note ? cleanText(command.note, 'note', 4000) : undefined;
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      trademarkAssetId,
      expectedTrademarkAssetVersion,
      managementSignal: { id: managementSignalId, version: managementSignalVersion },
      recommendation: recommendationId
        ? { id: recommendationId, version: recommendationVersion }
        : null,
      kind: command.kind,
      subjectUserId,
      note: note ?? null,
      workflowReference: command.workflowReference ?? null
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-management-disposition:${managementSignalId}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_asset_management_disposition_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256) {
            throw new TrademarkAssetManagementDispositionError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different management disposition.',
              409
            );
          }
          return clone(prior.result_json as TrademarkAssetManagementDisposition);
        }

        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-id:${trademarkAssetId}`
        ]);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-asset-refresh:${trademarkAssetId}`
        ]);
        const recordedAt = timestamp(this.now(), 'now');
        let current;
        try {
          current = await this.currentOwner.resolve(
            workspaceId,
            trademarkAssetId,
            recordedAt,
            client
          );
        } catch (error) {
          if (error instanceof TrademarkAssetPersistenceError && error.code === 'NOT_FOUND') {
            throw new TrademarkAssetManagementDispositionError(
              'NOT_FOUND',
              'Trademark Asset was not found.',
              404
            );
          }
          throw error;
        }
        if (current.asset.version !== expectedTrademarkAssetVersion) {
          throw new TrademarkAssetManagementDispositionError(
            'VERSION_CONFLICT',
            'Trademark Asset changed since the requested version.'
          );
        }
        const signal = exactSignal(current.signals, managementSignalId, managementSignalVersion);
        if (
          signal.workspaceId !== workspaceId ||
          signal.asset.id !== trademarkAssetId ||
          signal.asset.version !== current.asset.version
        ) {
          throw new TrademarkAssetManagementDispositionError(
            'VERSION_CONFLICT',
            'Management Signal does not belong to the exact current Workspace Asset.'
          );
        }
        const recommendation = recommendationId
          ? exactRecommendation(current.recommendations, recommendationId, recommendationVersion!)
          : undefined;
        if (
          recommendation &&
          (recommendation.workspaceId !== workspaceId ||
            recommendation.asset.id !== trademarkAssetId ||
            recommendation.asset.version !== current.asset.version ||
            !recommendation.signalReferences.some(
              (reference) =>
                reference.id === signal.managementSignalId && reference.version === signal.version
            ))
        ) {
          throw new TrademarkAssetManagementDispositionError(
            'VERSION_CONFLICT',
            'Management Recommendation is not exactly linked to the selected current Signal.'
          );
        }

        const disposition: TrademarkAssetManagementDisposition = {
          schemaVersion: 1,
          dispositionId: this.dispositionId(),
          workspaceId,
          version: 1,
          asset: { id: trademarkAssetId, version: current.asset.version },
          signal: { id: signal.managementSignalId, version: signal.version },
          ...(recommendation
            ? {
                recommendation: {
                  id: recommendation.recommendationId,
                  version: recommendation.version
                }
              }
            : {}),
          kind: command.kind,
          subjectUserId,
          ...(note ? { note } : {}),
          ...(command.workflowReference
            ? { workflowReference: clone(command.workflowReference) }
            : {}),
          recordedAt,
          officialTruthCreated: false,
          legalConclusionVerified: false,
          capabilityVerified: false
        };

        await client.query(
          `INSERT INTO lite_trademark_asset_management_dispositions(
             workspace_id,disposition_id,version,trademark_asset_id,management_signal_id,
             recommendation_id,disposition_kind,subject_user_id,document_json,recorded_at
           ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            workspaceId,
            disposition.dispositionId,
            trademarkAssetId,
            managementSignalId,
            recommendationId ?? null,
            disposition.kind,
            subjectUserId,
            JSON.stringify(disposition),
            recordedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_trademark_asset_management_disposition_commands(
             workspace_id,idempotency_key,request_fingerprint_sha256,result_json,created_at
           ) VALUES($1,$2,$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(disposition),
            recordedAt
          ]
        );

        const recoveryKinds: TrademarkAssetManagementRecoveryKind[] = [
          'REFRESH_PORTFOLIO_PROJECTION',
          'REBUILD_MANAGEMENT_SIGNAL'
        ];
        for (const recoveryKind of recoveryKinds) {
          const recoveryJobId = this.recoveryJobId();
          const payload = {
            schemaVersion: 1,
            workspaceId,
            trademarkAssetId,
            dispositionId: disposition.dispositionId,
            managementSignalId,
            recoveryKind,
            protectedActionAuthorized: false
          };
          await client.query(
            `INSERT INTO lite_trademark_asset_management_recovery_jobs(
               workspace_id,recovery_job_id,trademark_asset_id,disposition_id,recovery_kind,
               status,attempt_count,max_attempts,available_at,payload_json,created_at,updated_at
             ) VALUES($1,$2,$3,$4,$5,'PENDING',0,5,$6,$7::jsonb,$6,$6)`,
            [
              workspaceId,
              recoveryJobId,
              trademarkAssetId,
              disposition.dispositionId,
              recoveryKind,
              recordedAt,
              JSON.stringify(payload)
            ]
          );
        }
        return clone(disposition);
      });
    } catch (error) {
      if (error instanceof TrademarkAssetManagementDispositionError) throw error;
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management disposition persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listCurrentForAsset(
    workspaceIdValue: string,
    trademarkAssetIdValue: TrademarkAssetId
  ): Promise<CurrentTrademarkAssetManagementDispositionProjection> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const trademarkAssetId = cleanAssetId(trademarkAssetIdValue);
    try {
      return await this.database.transact(
        async (client) => {
          const composedAt = timestamp(this.now(), 'now');
          let current;
          try {
            current = await this.currentOwner.resolve(
              workspaceId,
              trademarkAssetId,
              composedAt,
              client
            );
          } catch (error) {
            if (error instanceof TrademarkAssetPersistenceError && error.code === 'NOT_FOUND') {
              throw new TrademarkAssetManagementDispositionError(
                'NOT_FOUND',
                'Trademark Asset was not found.',
                404
              );
            }
            throw error;
          }
          if (
            current.asset.workspaceId.toLowerCase() !== workspaceId ||
            current.asset.trademarkAssetId !== trademarkAssetId ||
            !Number.isSafeInteger(current.asset.version) ||
            current.asset.version < 1
          ) {
            return corruptDisposition('current owner Asset lineage is inconsistent.');
          }
          for (const signal of current.signals) {
            if (
              signal.workspaceId.toLowerCase() !== workspaceId ||
              signal.asset.id !== trademarkAssetId ||
              signal.asset.version !== current.asset.version ||
              !Number.isSafeInteger(signal.version) ||
              signal.version < 1
            ) {
              return corruptDisposition('current owner Signal lineage is inconsistent.');
            }
          }

          const result = await client.query(
            `SELECT workspace_id,disposition_id,version,trademark_asset_id,management_signal_id,
                    recommendation_id,disposition_kind,subject_user_id,document_json,recorded_at
               FROM lite_trademark_asset_management_dispositions
              WHERE workspace_id=$1 AND trademark_asset_id=$2
              ORDER BY recorded_at DESC,disposition_id DESC`,
            [workspaceId, trademarkAssetId]
          );
          const documents = (result.rows as Row[]).map((row) =>
            persistedDisposition(row, workspaceId, trademarkAssetId)
          );
          const latestByExactSignal = new Map<string, TrademarkAssetManagementDisposition>();
          for (const document of documents) {
            const key = `${document.signal.id}\u0000${document.signal.version}`;
            if (!latestByExactSignal.has(key)) latestByExactSignal.set(key, document);
          }

          const items = current.signals.map((signal) => {
            const key = `${signal.managementSignalId}\u0000${signal.version}`;
            const disposition = latestByExactSignal.get(key);
            if (disposition) {
              if (
                disposition.asset.id !== trademarkAssetId ||
                disposition.asset.version !== current.asset.version
              ) {
                return corruptDisposition(
                  'exact-current Signal disposition does not bind the exact current Asset version.'
                );
              }
              if (disposition.recommendation) {
                const recommendation = current.recommendations.find(
                  (candidate) =>
                    candidate.recommendationId === disposition.recommendation?.id &&
                    candidate.version === disposition.recommendation?.version
                );
                if (
                  !recommendation ||
                  recommendation.workspaceId.toLowerCase() !== workspaceId ||
                  recommendation.asset.id !== trademarkAssetId ||
                  recommendation.asset.version !== current.asset.version ||
                  !recommendation.signalReferences.some(
                    (reference) =>
                      reference.id === signal.managementSignalId &&
                      reference.version === signal.version
                  )
                ) {
                  return corruptDisposition(
                    'exact-current disposition Recommendation lineage is inconsistent.'
                  );
                }
              }
            }
            return {
              signal: { id: signal.managementSignalId, version: signal.version },
              disposition: disposition ? clone(disposition) : null
            };
          });

          return {
            schemaVersion: 1 as const,
            workspaceId,
            asset: { id: trademarkAssetId, version: current.asset.version },
            items
          };
        },
        { isolation: 'REPEATABLE READ', readOnly: true }
      );
    } catch (error) {
      if (error instanceof TrademarkAssetManagementDispositionError) throw error;
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management disposition read projection is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listWatchState(
    workspaceIdValue: string,
    limit = 100
  ): Promise<TrademarkAssetManagementDisposition[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'limit must be between 1 and 200.',
        400
      );
    }
    try {
      const result = await this.query.query(
        `SELECT document_json
           FROM (
             SELECT DISTINCT ON (management_signal_id)
                    management_signal_id,document_json,disposition_kind,recorded_at,disposition_id
               FROM lite_trademark_asset_management_dispositions
              WHERE workspace_id=$1
              ORDER BY management_signal_id,recorded_at DESC,disposition_id DESC
           ) latest
          WHERE disposition_kind IN ('WATCHED','DEFERRED')
          ORDER BY recorded_at DESC,disposition_id DESC
          LIMIT $2`,
        [workspaceId, limit]
      );
      return result.rows.map((row) =>
        clone((row as Row).document_json as TrademarkAssetManagementDisposition)
      );
    } catch (error) {
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management watch state is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async leaseRecoveryJobs(
    limit = 20,
    leaseSeconds = 60
  ): Promise<TrademarkAssetManagementRecoveryJob[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'limit must be between 1 and 100.',
        400
      );
    }
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 900) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'leaseSeconds must be between 10 and 900.',
        400
      );
    }
    const now = timestamp(this.now(), 'now');
    const leaseUntil = new Date(new Date(now).valueOf() + leaseSeconds * 1000).toISOString();
    try {
      return await this.database.transact(async (client) => {
        const selected = await client.query(
          `SELECT workspace_id,recovery_job_id
             FROM lite_trademark_asset_management_recovery_jobs
            WHERE status='PENDING' AND available_at <= $1
            ORDER BY available_at ASC,recovery_job_id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $2`,
          [now, limit]
        );
        const jobs: TrademarkAssetManagementRecoveryJob[] = [];
        for (const selectedRow of selected.rows as Row[]) {
          const updated = await client.query(
            `UPDATE lite_trademark_asset_management_recovery_jobs
                SET status='LEASED',lease_until=$3,updated_at=$1
              WHERE workspace_id=$2 AND recovery_job_id=$4
              RETURNING *`,
            [now, selectedRow.workspace_id, leaseUntil, selectedRow.recovery_job_id]
          );
          const row = updated.rows[0] as Row | undefined;
          if (row) jobs.push(this.recoveryDocument(row));
        }
        return jobs;
      });
    } catch (error) {
      throw new TrademarkAssetManagementDispositionError(
        'PERSISTENCE_UNAVAILABLE',
        'Trademark Asset management recovery queue is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async completeRecoveryJob(
    workspaceIdValue: string,
    recoveryJobIdValue: TrademarkAssetManagementRecoveryJobId
  ): Promise<void> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const recoveryJobId = cleanText(recoveryJobIdValue, 'recoveryJobId', 300);
    const now = timestamp(this.now(), 'now');
    const result = await this.query.query(
      `UPDATE lite_trademark_asset_management_recovery_jobs
          SET status='SUCCEEDED',lease_until=NULL,last_failure=NULL,updated_at=$3
        WHERE workspace_id=$1 AND recovery_job_id=$2 AND status='LEASED'`,
      [workspaceId, recoveryJobId, now]
    );
    if (!result.rowCount) {
      throw new TrademarkAssetManagementDispositionError(
        'LEASE_CONFLICT',
        'Recovery job is not currently leased in this workspace.',
        409
      );
    }
  }

  async failRecoveryJob(
    workspaceIdValue: string,
    recoveryJobIdValue: TrademarkAssetManagementRecoveryJobId,
    failureValue: string
  ): Promise<TrademarkAssetManagementRecoveryJob> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const recoveryJobId = cleanText(recoveryJobIdValue, 'recoveryJobId', 300);
    const failure = cleanText(failureValue, 'failure', 4000);
    const now = timestamp(this.now(), 'now');
    return this.database.transact(async (client) => {
      const current = await client.query(
        `SELECT * FROM lite_trademark_asset_management_recovery_jobs
          WHERE workspace_id=$1 AND recovery_job_id=$2
          FOR UPDATE`,
        [workspaceId, recoveryJobId]
      );
      const row = current.rows[0] as Row | undefined;
      if (!row || row.status !== 'LEASED') {
        throw new TrademarkAssetManagementDispositionError(
          'LEASE_CONFLICT',
          'Recovery job is not currently leased in this workspace.',
          409
        );
      }
      const decision = nextTrademarkAssetManagementRecoveryAttempt(
        now,
        Number(row.attempt_count),
        Number(row.max_attempts)
      );
      const updated = await client.query(
        `UPDATE lite_trademark_asset_management_recovery_jobs
            SET status=$3,attempt_count=$4,available_at=$5,lease_until=NULL,
                last_failure=$6,updated_at=$7
          WHERE workspace_id=$1 AND recovery_job_id=$2
          RETURNING *`,
        [
          workspaceId,
          recoveryJobId,
          decision.status,
          decision.attemptCount,
          decision.availableAt,
          failure,
          now
        ]
      );
      return this.recoveryDocument(updated.rows[0] as Row);
    });
  }

  async replayDeadLetter(
    workspaceIdValue: string,
    recoveryJobIdValue: TrademarkAssetManagementRecoveryJobId
  ): Promise<TrademarkAssetManagementRecoveryJob> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const recoveryJobId = cleanText(recoveryJobIdValue, 'recoveryJobId', 300);
    const now = timestamp(this.now(), 'now');
    const updated = await this.query.query(
      `UPDATE lite_trademark_asset_management_recovery_jobs
          SET status='PENDING',attempt_count=0,available_at=$3,lease_until=NULL,
              last_failure=NULL,updated_at=$3
        WHERE workspace_id=$1 AND recovery_job_id=$2 AND status='DEAD_LETTER'
        RETURNING *`,
      [workspaceId, recoveryJobId, now]
    );
    const row = updated.rows[0] as Row | undefined;
    if (!row) {
      throw new TrademarkAssetManagementDispositionError(
        'NOT_FOUND',
        'Dead-letter recovery job was not found in this workspace.',
        404
      );
    }
    return this.recoveryDocument(row);
  }

  async listDeadLetters(
    workspaceIdValue: string,
    limit = 50
  ): Promise<TrademarkAssetManagementRecoveryJob[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new TrademarkAssetManagementDispositionError(
        'INVALID_INPUT',
        'limit must be between 1 and 200.',
        400
      );
    }
    const result = await this.query.query(
      `SELECT * FROM lite_trademark_asset_management_recovery_jobs
        WHERE workspace_id=$1 AND status='DEAD_LETTER'
        ORDER BY updated_at DESC,recovery_job_id DESC
        LIMIT $2`,
      [workspaceId, limit]
    );
    return result.rows.map((row) => this.recoveryDocument(row as Row));
  }

  private recoveryDocument(row: Row): TrademarkAssetManagementRecoveryJob {
    const leaseUntil =
      typeof row.lease_until === 'string'
        ? row.lease_until
        : row.lease_until instanceof Date
          ? row.lease_until.toISOString()
          : undefined;
    const lastFailure = typeof row.last_failure === 'string' ? row.last_failure : undefined;
    return {
      schemaVersion: 1,
      recoveryJobId: String(row.recovery_job_id) as TrademarkAssetManagementRecoveryJobId,
      workspaceId: String(row.workspace_id),
      trademarkAssetId: String(row.trademark_asset_id) as TrademarkAssetId,
      dispositionId: String(row.disposition_id) as TrademarkAssetManagementDispositionId,
      recoveryKind: String(row.recovery_kind) as TrademarkAssetManagementRecoveryKind,
      status: String(row.status) as TrademarkAssetManagementRecoveryStatus,
      attemptCount: Number(row.attempt_count),
      maxAttempts: Number(row.max_attempts),
      availableAt:
        row.available_at instanceof Date
          ? row.available_at.toISOString()
          : String(row.available_at),
      ...(leaseUntil ? { leaseUntil } : {}),
      ...(lastFailure ? { lastFailure } : {}),
      protectedActionAuthorized: false,
      filingAuthorized: false,
      externalContactAuthorized: false,
      paymentAuthorized: false,
      publicationAuthorized: false
    };
  }
}
