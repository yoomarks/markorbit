import { createHash, randomUUID } from 'node:crypto';
import type { FormalMatterId } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleViewId,
  RecommendedAction,
  RecommendedActionId,
  RecommendedActionStatus
} from '@markorbit/contracts/evidence-lifecycle';
import type { QueryClient } from '@markorbit/persistence';
import type { TransactionHost } from './formal-matter.js';
import type { LifecycleProjectionRepository } from './lifecycle-projection.js';

export type RecommendedActionErrorCode =
  | 'INVALID_INPUT'
  | 'RECOMMENDATION_NOT_FOUND'
  | 'RECOMMENDATION_SOURCE_STALE'
  | 'SOURCE_VERSION_MISMATCH'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'POLICY_DENIED'
  | 'PERSISTENCE_UNAVAILABLE';

export class RecommendedActionError extends Error {
  constructor(
    readonly code: RecommendedActionErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'RecommendedActionError';
  }
}

export const RECOMMENDED_ACTION_POLICY_VERSION = 'recommended-action-policy-v1';

type ActionableStatus = Exclude<RecommendedActionStatus, 'OPEN'>;

export interface RecommendedActionCandidate {
  actionCode: string;
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
}

export interface RecommendedActionPolicy {
  readonly version: string;
  evaluate(view: Readonly<CurrentLifecycleView>): Readonly<RecommendedActionCandidate> | null;
}

export const recommendedActionPolicyV1: RecommendedActionPolicy = Object.freeze({
  version: RECOMMENDED_ACTION_POLICY_VERSION,
  evaluate(view: Readonly<CurrentLifecycleView>): Readonly<RecommendedActionCandidate> | null {
    if (view.state === 'CUSTOMER_ACTION_NEEDED') {
      return Object.freeze({
        actionCode: 'CUSTOMER_ACTION_REQUIRED',
        title: 'Review required action',
        explanation: `The current governed lifecycle view requires customer attention. ${view.customerSafeSummary}`,
        timingBasis:
          'No governed due date is present in the current lifecycle view; no deadline is inferred.'
      });
    }
    if (view.state === 'CORRECTION_OR_REVIEW_ISSUE') {
      return Object.freeze({
        actionCode: 'REVIEW_CORRECTION_ISSUE',
        title: 'Review correction or evidence issue',
        explanation: `The current governed lifecycle view contains a correction or review issue. ${view.customerSafeSummary}`,
        timingBasis:
          'No governed due date is present in the current lifecycle view; no deadline is inferred.'
      });
    }
    return null;
  }
});

export interface RegenerateRecommendedActionCommand {
  workspaceId: string;
  formalMatterId: FormalMatterId;
  expectedLifecycleViewId: LifecycleViewId;
  expectedLifecycleViewVersion: number;
  expectedLifecycleViewFingerprintSha256: string;
  policyVersion: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface TransitionRecommendedActionCommand {
  workspaceId: string;
  recommendedActionId: RecommendedActionId;
  expectedVersion: number;
  targetStatus: ActionableStatus;
  idempotencyKey: string;
  correlationId: string;
}

export interface RecommendedActionEvaluationResult {
  sourceLifecycleView: Readonly<{ id: LifecycleViewId; version: number }>;
  sourceLifecycleViewFingerprintSha256: string;
  policyVersion: string;
  action: RecommendedAction | null;
}

export interface RecommendedActionCustomerProjection {
  recommendedActionId: RecommendedActionId;
  formalMatter: RecommendedAction['formalMatter'];
  version: number;
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
  status: RecommendedActionStatus;
  executionAuthorized: false;
  updatedAt: string;
}

interface RegenerationWrite {
  view: CurrentLifecycleView;
  candidate: Readonly<RecommendedActionCandidate> | null;
  policyVersion: string;
  idempotencyKey: string;
  requestFingerprint: string;
  correlationId: string;
  recordedAt: string;
  actionId: RecommendedActionId;
}

interface TransitionWrite {
  workspaceId: string;
  recommendedActionId: RecommendedActionId;
  expectedVersion: number;
  targetStatus: ActionableStatus;
  idempotencyKey: string;
  requestFingerprint: string;
  correlationId: string;
  recordedAt: string;
}

export interface RecommendedActionRepository {
  regenerate(value: Readonly<RegenerationWrite>): Promise<RecommendedActionEvaluationResult>;
  transition(value: Readonly<TransitionWrite>): Promise<RecommendedActionEvaluationResult>;
  findByMatter(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<RecommendedAction | undefined>;
  findById(
    workspaceId: string,
    recommendedActionId: RecommendedActionId
  ): Promise<RecommendedAction | undefined>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
type Row = Record<string, unknown>;

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanText(value: string, field: string, maximum = 2000): string {
  const cleaned = value.trim();
  if (!cleaned) throw new RecommendedActionError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new RecommendedActionError('INVALID_INPUT', `${field} exceeds the allowed length.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new RecommendedActionError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new RecommendedActionError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1)
    throw new RecommendedActionError('INVALID_INPUT', `${field} must be a positive integer.`, 422);
  return value;
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new RecommendedActionError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return parsed.toISOString();
}

function exactSource(view: Readonly<CurrentLifecycleView>) {
  return {
    id: view.lifecycleViewId,
    version: view.version,
    fingerprint: view.lifecycleViewFingerprintSha256
  };
}

function sameActionSource(
  action: Readonly<RecommendedAction>,
  view: Readonly<CurrentLifecycleView>
) {
  return (
    action.sourceLifecycleView.id === view.lifecycleViewId &&
    Number(action.sourceLifecycleView.version) === view.version &&
    action.sourceLifecycleViewFingerprintSha256 === view.lifecycleViewFingerprintSha256
  );
}

function withFingerprint(
  value: Omit<RecommendedAction, 'recommendedActionFingerprintSha256'>
): RecommendedAction {
  return {
    ...value,
    recommendedActionFingerprintSha256: fingerprint(value)
  };
}

function refingerprint(
  action: Readonly<RecommendedAction>,
  updates: Partial<Omit<RecommendedAction, 'recommendedActionFingerprintSha256'>>
): RecommendedAction {
  const { recommendedActionFingerprintSha256, ...withoutFingerprint } = action;
  void recommendedActionFingerprintSha256;
  return withFingerprint({ ...withoutFingerprint, ...updates });
}

export class PostgresRecommendedActionRepository implements RecommendedActionRepository {
  constructor(
    private readonly database: TransactionHost,
    private readonly query: QueryClient
  ) {}

  async regenerate(value: Readonly<RegenerationWrite>): Promise<RecommendedActionEvaluationResult> {
    try {
      return await this.database.transact(async (client) => {
        const lockedView = await this.lockCurrentView(
          client,
          value.view.workspaceId,
          value.view.formalMatter.id
        );
        this.verifyExactView(lockedView, value.view);

        const replay = await this.findReplay(client, value.view.workspaceId, value.idempotencyKey);
        if (replay) {
          if (String(replay.request_fingerprint) !== value.requestFingerprint)
            throw new RecommendedActionError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different Recommended Action payload.'
            );
          return structuredClone(replay.result_snapshot as RecommendedActionEvaluationResult);
        }

        const currentAction = await this.findByMatterForUpdate(
          client,
          value.view.workspaceId,
          value.view.formalMatter.id
        );
        const priorEvaluation = await client.query(
          'SELECT result_snapshot FROM markreg_recommended_action_commands WHERE workspace_id=$1 AND command_type=$2 AND formal_matter_id=$3 AND source_lifecycle_view_id=$4 AND source_lifecycle_view_version=$5 AND source_lifecycle_view_fingerprint_sha256=$6 AND policy_version=$7 AND request_fingerprint=$8 ORDER BY created_at DESC LIMIT 1',
          [
            value.view.workspaceId,
            'REGENERATE',
            value.view.formalMatter.id,
            value.view.lifecycleViewId,
            value.view.version,
            value.view.lifecycleViewFingerprintSha256,
            value.policyVersion,
            value.requestFingerprint
          ]
        );
        if (priorEvaluation.rowCount) {
          const prior = structuredClone(
            (priorEvaluation.rows[0] as Row).result_snapshot as RecommendedActionEvaluationResult
          );
          const result: RecommendedActionEvaluationResult = {
            ...prior,
            action:
              currentAction &&
              sameActionSource(currentAction, value.view) &&
              currentAction.policyVersion === value.policyVersion
                ? currentAction
                : prior.action
          };
          await this.insertCommand(
            client,
            'REGENERATE',
            value.view.workspaceId,
            value.view.formalMatter.id,
            result.action?.recommendedActionId ?? null,
            value.view,
            value.policyVersion,
            value.idempotencyKey,
            value.requestFingerprint,
            result,
            value.correlationId,
            value.recordedAt
          );
          return result;
        }

        let action: RecommendedAction | null = currentAction ?? null;
        if (value.candidate) {
          const nextWithoutFingerprint: Omit<
            RecommendedAction,
            'recommendedActionFingerprintSha256'
          > = {
            schemaVersion: 1,
            recommendedActionId: currentAction?.recommendedActionId ?? value.actionId,
            workspaceId: value.view.workspaceId,
            formalMatter: {
              id: value.view.formalMatter.id,
              version: String(value.view.formalMatter.version)
            },
            version: (currentAction?.version ?? 0) + 1,
            sourceLifecycleView: {
              id: value.view.lifecycleViewId,
              version: value.view.version
            },
            sourceLifecycleViewFingerprintSha256: value.view.lifecycleViewFingerprintSha256,
            policyVersion: value.policyVersion,
            actionCode: value.candidate.actionCode,
            title: value.candidate.title,
            explanation: value.candidate.explanation,
            ...(value.candidate.dueAt ? { dueAt: value.candidate.dueAt } : {}),
            ...(value.candidate.timingBasis ? { timingBasis: value.candidate.timingBasis } : {}),
            status: 'OPEN',
            executionAuthorized: false,
            createdAt: currentAction?.createdAt ?? value.recordedAt,
            updatedAt: value.recordedAt
          };
          action = withFingerprint(nextWithoutFingerprint);
          await this.upsertAction(client, action);
          await this.insertAudit(
            client,
            currentAction ? 'REGENERATED' : 'GENERATED',
            action,
            {
              sourceLifecycleView: exactSource(value.view),
              policyVersion: value.policyVersion,
              deterministicCandidate: true
            },
            value.correlationId,
            value.recordedAt
          );
        } else if (currentAction && currentAction.status !== 'SUPPRESSED') {
          action = refingerprint(currentAction, {
            version: currentAction.version + 1,
            status: 'SUPPRESSED',
            updatedAt: value.recordedAt
          });
          await client.query(
            'UPDATE markreg_recommended_actions SET version=$3,status=$4,recommended_action_fingerprint_sha256=$5,updated_at=$6 WHERE workspace_id=$1 AND recommended_action_id=$2',
            [
              action.workspaceId,
              action.recommendedActionId,
              action.version,
              action.status,
              action.recommendedActionFingerprintSha256,
              action.updatedAt
            ]
          );
          await this.insertAudit(
            client,
            'SUPPRESSED',
            action,
            {
              suppressingLifecycleView: exactSource(value.view),
              policyVersion: value.policyVersion,
              reason: 'CURRENT_POLICY_HAS_NO_ACTION_CANDIDATE'
            },
            value.correlationId,
            value.recordedAt
          );
        }

        const result: RecommendedActionEvaluationResult = {
          sourceLifecycleView: { id: value.view.lifecycleViewId, version: value.view.version },
          sourceLifecycleViewFingerprintSha256: value.view.lifecycleViewFingerprintSha256,
          policyVersion: value.policyVersion,
          action
        };
        await this.insertCommand(
          client,
          'REGENERATE',
          value.view.workspaceId,
          value.view.formalMatter.id,
          action?.recommendedActionId ?? null,
          value.view,
          value.policyVersion,
          value.idempotencyKey,
          value.requestFingerprint,
          result,
          value.correlationId,
          value.recordedAt
        );
        return result;
      });
    } catch (cause) {
      if (cause instanceof RecommendedActionError) throw cause;
      throw new RecommendedActionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Recommended Action persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async transition(value: Readonly<TransitionWrite>): Promise<RecommendedActionEvaluationResult> {
    try {
      return await this.database.transact(async (client) => {
        const located = await client.query(
          'SELECT formal_matter_id FROM markreg_recommended_actions WHERE workspace_id=$1 AND recommended_action_id=$2',
          [value.workspaceId, value.recommendedActionId]
        );
        if (!located.rowCount)
          throw new RecommendedActionError(
            'RECOMMENDATION_NOT_FOUND',
            'Recommended Action was not found in the requested Workspace.',
            404
          );
        const formalMatterId = String((located.rows[0] as Row).formal_matter_id) as FormalMatterId;
        const currentView = await this.lockCurrentView(client, value.workspaceId, formalMatterId);
        const action = await this.findByIdForUpdate(
          client,
          value.workspaceId,
          value.recommendedActionId
        );
        if (!action)
          throw new RecommendedActionError(
            'RECOMMENDATION_NOT_FOUND',
            'Recommended Action was not found in the requested Workspace.',
            404
          );
        const replay = await this.findReplay(client, value.workspaceId, value.idempotencyKey);
        if (replay) {
          if (String(replay.request_fingerprint) !== value.requestFingerprint)
            throw new RecommendedActionError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different Recommended Action transition payload.'
            );
          return structuredClone(replay.result_snapshot as RecommendedActionEvaluationResult);
        }

        if (action.version !== value.expectedVersion)
          throw new RecommendedActionError(
            'VERSION_CONFLICT',
            'Recommended Action version changed before the transition could be recorded.'
          );
        if (
          action.sourceLifecycleView.id !== currentView.lifecycleViewId ||
          Number(action.sourceLifecycleView.version) !== currentView.version ||
          action.sourceLifecycleViewFingerprintSha256 !== currentView.lifecycleViewFingerprintSha256
        )
          throw new RecommendedActionError(
            'RECOMMENDATION_SOURCE_STALE',
            'Recommended Action is bound to a stale Lifecycle View.'
          );

        if (!this.transitionAllowed(action.status, value.targetStatus))
          throw new RecommendedActionError(
            'INVALID_TRANSITION',
            `Recommended Action cannot transition from ${action.status} to ${value.targetStatus}.`
          );

        const updated =
          action.status === value.targetStatus
            ? action
            : refingerprint(action, {
                version: action.version + 1,
                status: value.targetStatus,
                updatedAt: value.recordedAt
              });
        if (updated !== action) {
          await client.query(
            'UPDATE markreg_recommended_actions SET version=$3,status=$4,recommended_action_fingerprint_sha256=$5,updated_at=$6 WHERE workspace_id=$1 AND recommended_action_id=$2',
            [
              updated.workspaceId,
              updated.recommendedActionId,
              updated.version,
              updated.status,
              updated.recommendedActionFingerprintSha256,
              updated.updatedAt
            ]
          );
          await this.insertAudit(
            client,
            value.targetStatus,
            updated,
            { sourceLifecycleView: exactSource(currentView), explicitTransition: true },
            value.correlationId,
            value.recordedAt
          );
        }

        const result: RecommendedActionEvaluationResult = {
          sourceLifecycleView: {
            id: currentView.lifecycleViewId,
            version: currentView.version
          },
          sourceLifecycleViewFingerprintSha256: currentView.lifecycleViewFingerprintSha256,
          policyVersion: updated.policyVersion,
          action: updated
        };
        await this.insertCommand(
          client,
          'TRANSITION',
          value.workspaceId,
          formalMatterId,
          updated.recommendedActionId,
          currentView,
          updated.policyVersion,
          value.idempotencyKey,
          value.requestFingerprint,
          result,
          value.correlationId,
          value.recordedAt
        );
        return result;
      });
    } catch (cause) {
      if (cause instanceof RecommendedActionError) throw cause;
      throw new RecommendedActionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Recommended Action persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async findByMatter(workspaceId: string, formalMatterId: FormalMatterId) {
    try {
      const result = await this.query.query(
        'SELECT * FROM markreg_recommended_actions WHERE workspace_id=$1 AND formal_matter_id=$2',
        [workspaceId, formalMatterId]
      );
      return result.rowCount ? this.mapAction(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw new RecommendedActionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Recommended Action persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async findById(workspaceId: string, recommendedActionId: RecommendedActionId) {
    try {
      const result = await this.query.query(
        'SELECT * FROM markreg_recommended_actions WHERE workspace_id=$1 AND recommended_action_id=$2',
        [workspaceId, recommendedActionId]
      );
      return result.rowCount ? this.mapAction(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw new RecommendedActionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg Recommended Action persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private async lockCurrentView(
    client: QueryClient,
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<CurrentLifecycleView> {
    const result = await client.query(
      'SELECT lifecycle_view_id,workspace_id,formal_matter_id,formal_matter_version,version,current_event_id,current_event_version,current_event_fingerprint_sha256,state,customer_safe_label,customer_safe_summary,lifecycle_view_fingerprint_sha256,official_status_verified,updated_at FROM markreg_lifecycle_views WHERE workspace_id=$1 AND formal_matter_id=$2 FOR UPDATE',
      [workspaceId, formalMatterId]
    );
    if (!result.rowCount)
      throw new RecommendedActionError(
        'RECOMMENDATION_SOURCE_STALE',
        'Current Lifecycle View is unavailable for this Matter.'
      );
    const row = result.rows[0] as Row;
    return {
      schemaVersion: 1,
      lifecycleViewId: String(row.lifecycle_view_id) as LifecycleViewId,
      workspaceId: String(row.workspace_id),
      formalMatter: {
        id: String(row.formal_matter_id) as FormalMatterId,
        version: String(row.formal_matter_version)
      },
      version: Number(row.version),
      currentEvent: {
        id: String(row.current_event_id) as never,
        version: Number(row.current_event_version)
      },
      currentEventFingerprintSha256: String(row.current_event_fingerprint_sha256),
      state: String(row.state) as CurrentLifecycleView['state'],
      customerSafeLabel: String(row.customer_safe_label),
      customerSafeSummary: String(row.customer_safe_summary),
      lifecycleViewFingerprintSha256: String(row.lifecycle_view_fingerprint_sha256),
      officialStatusVerified: false,
      updatedAt: new Date(row.updated_at as string).toISOString()
    };
  }

  private verifyExactView(actual: CurrentLifecycleView, expected: CurrentLifecycleView) {
    if (actual.lifecycleViewId !== expected.lifecycleViewId)
      throw new RecommendedActionError(
        'RECOMMENDATION_SOURCE_STALE',
        'Lifecycle View identity changed before recommendation evaluation.'
      );
    if (actual.version !== expected.version)
      throw new RecommendedActionError(
        'SOURCE_VERSION_MISMATCH',
        'Exact current Lifecycle View version is required.'
      );
    if (actual.lifecycleViewFingerprintSha256 !== expected.lifecycleViewFingerprintSha256)
      throw new RecommendedActionError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Lifecycle View fingerprint changed before recommendation evaluation.'
      );
  }

  private async findReplay(client: QueryClient, workspaceId: string, idempotencyKey: string) {
    const result = await client.query(
      'SELECT request_fingerprint,result_snapshot FROM markreg_recommended_action_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
      [workspaceId, idempotencyKey]
    );
    return result.rowCount ? (result.rows[0] as Row) : undefined;
  }

  private async findByMatterForUpdate(
    client: QueryClient,
    workspaceId: string,
    formalMatterId: FormalMatterId
  ) {
    const result = await client.query(
      'SELECT * FROM markreg_recommended_actions WHERE workspace_id=$1 AND formal_matter_id=$2 FOR UPDATE',
      [workspaceId, formalMatterId]
    );
    return result.rowCount ? this.mapAction(result.rows[0] as Row) : undefined;
  }

  private async findByIdForUpdate(
    client: QueryClient,
    workspaceId: string,
    recommendedActionId: RecommendedActionId
  ) {
    const result = await client.query(
      'SELECT * FROM markreg_recommended_actions WHERE workspace_id=$1 AND recommended_action_id=$2 FOR UPDATE',
      [workspaceId, recommendedActionId]
    );
    return result.rowCount ? this.mapAction(result.rows[0] as Row) : undefined;
  }

  private async upsertAction(client: QueryClient, action: RecommendedAction) {
    await client.query(
      'INSERT INTO markreg_recommended_actions (recommended_action_id,workspace_id,formal_matter_id,formal_matter_version,version,source_lifecycle_view_id,source_lifecycle_view_version,source_lifecycle_view_fingerprint_sha256,policy_version,action_code,title,explanation,due_at,timing_basis,status,recommended_action_fingerprint_sha256,execution_authorized,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,$17,$18) ON CONFLICT (workspace_id,formal_matter_id) DO UPDATE SET formal_matter_version=EXCLUDED.formal_matter_version,version=EXCLUDED.version,source_lifecycle_view_id=EXCLUDED.source_lifecycle_view_id,source_lifecycle_view_version=EXCLUDED.source_lifecycle_view_version,source_lifecycle_view_fingerprint_sha256=EXCLUDED.source_lifecycle_view_fingerprint_sha256,policy_version=EXCLUDED.policy_version,action_code=EXCLUDED.action_code,title=EXCLUDED.title,explanation=EXCLUDED.explanation,due_at=EXCLUDED.due_at,timing_basis=EXCLUDED.timing_basis,status=EXCLUDED.status,recommended_action_fingerprint_sha256=EXCLUDED.recommended_action_fingerprint_sha256,execution_authorized=false,updated_at=EXCLUDED.updated_at',
      [
        action.recommendedActionId,
        action.workspaceId,
        action.formalMatter.id,
        String(action.formalMatter.version),
        action.version,
        action.sourceLifecycleView.id,
        Number(action.sourceLifecycleView.version),
        action.sourceLifecycleViewFingerprintSha256,
        action.policyVersion,
        action.actionCode,
        action.title,
        action.explanation,
        action.dueAt ?? null,
        action.timingBasis ?? null,
        action.status,
        action.recommendedActionFingerprintSha256,
        action.createdAt,
        action.updatedAt
      ]
    );
  }

  private async insertCommand(
    client: QueryClient,
    commandType: 'REGENERATE' | 'TRANSITION',
    workspaceId: string,
    formalMatterId: FormalMatterId,
    recommendedActionId: RecommendedActionId | null,
    sourceLifecycleView: CurrentLifecycleView,
    policyVersion: string,
    idempotencyKey: string,
    requestFingerprint: string,
    result: Readonly<RecommendedActionEvaluationResult>,
    correlationId: string,
    createdAt: string
  ) {
    await client.query(
      'INSERT INTO markreg_recommended_action_commands (workspace_id,idempotency_key,command_type,formal_matter_id,recommended_action_id,source_lifecycle_view_id,source_lifecycle_view_version,source_lifecycle_view_fingerprint_sha256,policy_version,request_fingerprint,result_snapshot,correlation_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)',
      [
        workspaceId,
        idempotencyKey,
        commandType,
        formalMatterId,
        recommendedActionId,
        sourceLifecycleView.lifecycleViewId,
        sourceLifecycleView.version,
        sourceLifecycleView.lifecycleViewFingerprintSha256,
        policyVersion,
        requestFingerprint,
        JSON.stringify(result),
        correlationId,
        createdAt
      ]
    );
  }

  private async insertAudit(
    client: QueryClient,
    eventType: 'GENERATED' | 'REGENERATED' | 'ACKNOWLEDGED' | 'DISMISSED' | 'SUPPRESSED',
    action: RecommendedAction,
    context: Readonly<Record<string, unknown>>,
    correlationId: string,
    createdAt: string
  ) {
    await client.query(
      'INSERT INTO markreg_recommended_action_audit (workspace_id,recommended_action_id,formal_matter_id,event_type,action_version,action_snapshot,context,correlation_id,created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)',
      [
        action.workspaceId,
        action.recommendedActionId,
        action.formalMatter.id,
        eventType,
        action.version,
        JSON.stringify(action),
        JSON.stringify(context),
        correlationId,
        createdAt
      ]
    );
  }

  private transitionAllowed(current: RecommendedActionStatus, target: ActionableStatus): boolean {
    if (current === target) return true;
    if (current === 'OPEN') return true;
    if (current === 'ACKNOWLEDGED') return target === 'DISMISSED' || target === 'SUPPRESSED';
    if (current === 'DISMISSED') return target === 'SUPPRESSED';
    return false;
  }

  private mapAction(row: Row): RecommendedAction {
    return {
      schemaVersion: 1,
      recommendedActionId: String(row.recommended_action_id) as RecommendedActionId,
      workspaceId: String(row.workspace_id),
      formalMatter: {
        id: String(row.formal_matter_id) as FormalMatterId,
        version: String(row.formal_matter_version)
      },
      version: Number(row.version),
      sourceLifecycleView: {
        id: String(row.source_lifecycle_view_id) as LifecycleViewId,
        version: Number(row.source_lifecycle_view_version)
      },
      sourceLifecycleViewFingerprintSha256: String(row.source_lifecycle_view_fingerprint_sha256),
      policyVersion: String(row.policy_version),
      actionCode: String(row.action_code),
      title: String(row.title),
      explanation: String(row.explanation),
      ...(row.due_at ? { dueAt: new Date(row.due_at as string).toISOString() } : {}),
      ...(row.timing_basis ? { timingBasis: String(row.timing_basis) } : {}),
      status: String(row.status) as RecommendedActionStatus,
      recommendedActionFingerprintSha256: String(row.recommended_action_fingerprint_sha256),
      executionAuthorized: false,
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString()
    };
  }
}

export class RecommendedActionService {
  constructor(
    private readonly repository: RecommendedActionRepository,
    private readonly lifecycle: Pick<LifecycleProjectionRepository, 'getCurrentView'>,
    private readonly policy: RecommendedActionPolicy = recommendedActionPolicyV1,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly actionIdFactory: () => RecommendedActionId = () =>
      `recommended-action_${randomUUID()}`
  ) {}

  async regenerate(
    command: Readonly<RegenerateRecommendedActionCommand>
  ): Promise<RecommendedActionEvaluationResult> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const formalMatterId = cleanText(
      command.formalMatterId,
      'formalMatterId',
      200
    ) as FormalMatterId;
    const expectedVersion = exactVersion(
      command.expectedLifecycleViewVersion,
      'expectedLifecycleViewVersion'
    );
    const expectedFingerprint = exactSha256(
      command.expectedLifecycleViewFingerprintSha256,
      'expectedLifecycleViewFingerprintSha256'
    );
    const policyVersion = cleanText(command.policyVersion, 'policyVersion', 100);
    if (policyVersion !== this.policy.version)
      throw new RecommendedActionError(
        'POLICY_DENIED',
        `Unsupported Recommended Action policy version: ${policyVersion}.`,
        422
      );
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200);

    const currentView = await this.lifecycle.getCurrentView(workspaceId, formalMatterId);
    if (!currentView)
      throw new RecommendedActionError(
        'RECOMMENDATION_SOURCE_STALE',
        'Current Lifecycle View is unavailable for this Matter.'
      );
    if (currentView.lifecycleViewId !== command.expectedLifecycleViewId)
      throw new RecommendedActionError(
        'RECOMMENDATION_SOURCE_STALE',
        'Exact current Lifecycle View identity is required.'
      );
    if (currentView.version !== expectedVersion)
      throw new RecommendedActionError(
        'SOURCE_VERSION_MISMATCH',
        'Exact current Lifecycle View version is required.'
      );
    if (currentView.lifecycleViewFingerprintSha256 !== expectedFingerprint)
      throw new RecommendedActionError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Exact current Lifecycle View fingerprint is required.'
      );

    const recordedAt = exactTimestamp(this.now(), 'recordedAt');
    const candidate = this.policy.evaluate(currentView);
    const requestFingerprint = fingerprint({
      commandType: 'REGENERATE',
      workspaceId,
      formalMatterId,
      sourceLifecycleView: exactSource(currentView),
      policyVersion,
      correlationId
    });
    return this.repository.regenerate({
      view: currentView,
      candidate,
      policyVersion,
      idempotencyKey,
      requestFingerprint,
      correlationId,
      recordedAt,
      actionId: this.actionIdFactory()
    });
  }

  async transition(
    command: Readonly<TransitionRecommendedActionCommand>
  ): Promise<RecommendedActionEvaluationResult> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const expectedVersion = exactVersion(command.expectedVersion, 'expectedVersion');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200);
    if (!['ACKNOWLEDGED', 'DISMISSED', 'SUPPRESSED'].includes(command.targetStatus))
      throw new RecommendedActionError(
        'INVALID_INPUT',
        'targetStatus must be ACKNOWLEDGED, DISMISSED or SUPPRESSED.',
        422
      );
    const recordedAt = exactTimestamp(this.now(), 'recordedAt');
    const requestFingerprint = fingerprint({
      commandType: 'TRANSITION',
      workspaceId,
      recommendedActionId: command.recommendedActionId,
      expectedVersion,
      targetStatus: command.targetStatus,
      correlationId
    });
    return this.repository.transition({
      workspaceId,
      recommendedActionId: command.recommendedActionId,
      expectedVersion,
      targetStatus: command.targetStatus,
      idempotencyKey,
      requestFingerprint,
      correlationId,
      recordedAt
    });
  }

  async getForOperations(workspaceId: string, formalMatterId: FormalMatterId) {
    return this.repository.findByMatter(cleanWorkspaceId(workspaceId), formalMatterId);
  }

  async getCustomerProjection(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<RecommendedActionCustomerProjection | null> {
    const action = await this.repository.findByMatter(
      cleanWorkspaceId(workspaceId),
      formalMatterId
    );
    if (!action || action.status === 'SUPPRESSED') return null;
    return {
      recommendedActionId: action.recommendedActionId,
      formalMatter: structuredClone(action.formalMatter),
      version: action.version,
      title: action.title,
      explanation: action.explanation,
      ...(action.dueAt ? { dueAt: action.dueAt } : {}),
      ...(action.timingBasis ? { timingBasis: action.timingBasis } : {}),
      status: action.status,
      executionAuthorized: false,
      updatedAt: action.updatedAt
    };
  }
}
