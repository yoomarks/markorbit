import type { FormalMatterId } from '@markorbit/contracts';
import type { LifecycleProjectionState, RecommendedActionStatus } from '@markorbit/contracts/evidence-lifecycle';
import type { QueryClient } from '@markorbit/persistence';
import { examinationEventPolicy, type ExaminationEventCode } from './examination-stage-read.js';

export const WORKSPACE_ACTION_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_ACTION_LIMIT = 100;

export type WorkspaceActionTruthStatus = 'CURRENT' | 'NO_LIFECYCLE' | 'STALE';
export type WorkspaceActionAttentionStatus = 'OPEN' | 'NONE' | 'STALE';

export type WorkspaceActionReadErrorCode =
  | 'INVALID_INPUT'
  | 'WORKSPACE_ACTION_TRUTH_UNAVAILABLE';

export class WorkspaceActionReadError extends Error {
  constructor(
    readonly code: WorkspaceActionReadErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceActionReadError';
  }
}

interface MatterSource {
  id: FormalMatterId;
  version: number | string;
  trademark?: string;
  applicant?: string;
  jurisdiction?: string;
  updatedAt: string;
}

interface LifecycleSource {
  id: string;
  version: number;
  fingerprintSha256: string;
  formalMatterVersion: number | string;
  currentEvent: { id: string; version: number; fingerprintSha256: string };
  state: LifecycleProjectionState;
  customerSafeLabel: string;
  customerSafeSummary: string;
  officialStatusVerified: boolean;
  updatedAt: string;
}

interface LifecycleEventSource {
  id: string;
  version: number;
  fingerprintSha256: string;
  formalMatterVersion: number | string;
  state: LifecycleProjectionState;
  eventCode: string;
  officialStatusVerified: boolean;
}

interface RecommendedActionSource {
  id: string;
  version: number;
  formalMatterVersion: number | string;
  sourceLifecycleView: { id: string; version: number; fingerprintSha256: string };
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
  status: RecommendedActionStatus;
  executionAuthorized: boolean;
  updatedAt: string;
}

export interface WorkspaceActionSourceRecord {
  formalMatter: MatterSource;
  lifecycle?: LifecycleSource;
  currentEvent?: LifecycleEventSource;
  recommendedAction?: RecommendedActionSource;
}

export interface WorkspaceActionSourceReader {
  list(workspaceId: string, limit: number): Promise<readonly WorkspaceActionSourceRecord[]>;
}

export interface WorkspaceActionLifecycleProjection {
  id: string;
  version: number;
  fingerprintSha256: string;
  state: LifecycleProjectionState;
  customerSafeLabel: string;
  customerSafeSummary: string;
  updatedAt: string;
  officialStatusVerified: false;
}

export interface WorkspaceActionRecommendedActionProjection {
  id: string;
  version: number;
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
  status: RecommendedActionStatus;
  executionAuthorized: false;
  updatedAt: string;
}

export interface WorkspaceActionExaminationProjection {
  status: 'ESTABLISHED';
  workflowState: LifecycleProjectionState;
  eventCode: ExaminationEventCode;
  customerSafeLabel: string;
  customerSafeSummary: string;
  deadline: null;
  deadlineStatus: 'UNAVAILABLE';
  officialStatusVerified: false;
}

export interface WorkspaceActionItemV1 {
  formalMatter: {
    id: FormalMatterId;
    version: number | string;
    trademark?: string;
    applicant?: string;
    jurisdiction?: string;
  };
  currentness: WorkspaceActionTruthStatus;
  lifecycle: WorkspaceActionLifecycleProjection | null;
  attentionStatus: WorkspaceActionAttentionStatus;
  recommendedAction: WorkspaceActionRecommendedActionProjection | null;
  examination: WorkspaceActionExaminationProjection | null;
  lastChangedAt: string;
  officialStatusVerified: false;
  authorityConsequences: typeof workspaceActionAuthorityConsequences;
}

export const workspaceActionAuthorityConsequences = Object.freeze({
  protectedActionAuthorized: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentCreated: false,
  providerContacted: false,
  officeMutationCreated: false,
  officialTruthCreated: false
} as const);

export interface WorkspaceActionProjectionV1 {
  schemaVersion: typeof WORKSPACE_ACTION_SCHEMA_VERSION;
  workspaceId: string;
  generatedAt: string;
  limit: number;
  truncated: boolean;
  needsAttention: readonly WorkspaceActionItemV1[];
  waitingOrInProgress: readonly WorkspaceActionItemV1[];
  recentlyChanged: readonly WorkspaceActionItemV1[];
  officialStatusVerified: false;
  authorityConsequences: typeof workspaceActionAuthorityConsequences;
}

const sameVersion = (left: number | string, right: number | string) =>
  String(left) === String(right);

function exactTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new WorkspaceActionReadError(
      'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      'Workspace Action source contains an invalid timestamp.',
      503,
      true
    );
  return date.toISOString();
}

function later(...values: string[]): string {
  return values.map(exactTimestamp).sort((left, right) => right.localeCompare(left))[0]!;
}

function examinationOf(
  lifecycle: LifecycleSource,
  currentEvent: LifecycleEventSource
): WorkspaceActionExaminationProjection | null {
  const expected = (examinationEventPolicy as Readonly<Record<string, LifecycleProjectionState>>)[
    currentEvent.eventCode
  ];
  if (!expected) return null;
  if (expected !== currentEvent.state || lifecycle.state !== currentEvent.state)
    throw new WorkspaceActionReadError(
      'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      'Current lifecycle event violates the governed Examination V1 policy.',
      503,
      true
    );
  return {
    status: 'ESTABLISHED',
    workflowState: currentEvent.state,
    eventCode: currentEvent.eventCode as ExaminationEventCode,
    customerSafeLabel: lifecycle.customerSafeLabel,
    customerSafeSummary: lifecycle.customerSafeSummary,
    deadline: null,
    deadlineStatus: 'UNAVAILABLE',
    officialStatusVerified: false
  };
}

function project(record: Readonly<WorkspaceActionSourceRecord>): WorkspaceActionItemV1 {
  const matter = record.formalMatter;
  const identity = {
    id: matter.id,
    version: matter.version,
    ...(matter.trademark ? { trademark: matter.trademark } : {}),
    ...(matter.applicant ? { applicant: matter.applicant } : {}),
    ...(matter.jurisdiction ? { jurisdiction: matter.jurisdiction } : {})
  };

  if (!record.lifecycle) {
    return {
      formalMatter: identity,
      currentness: 'NO_LIFECYCLE',
      lifecycle: null,
      attentionStatus: record.recommendedAction ? 'STALE' : 'NONE',
      recommendedAction: null,
      examination: null,
      lastChangedAt: later(
        matter.updatedAt,
        ...(record.recommendedAction ? [record.recommendedAction.updatedAt] : [])
      ),
      officialStatusVerified: false,
      authorityConsequences: workspaceActionAuthorityConsequences
    };
  }

  const lifecycle = record.lifecycle;
  if (!sameVersion(lifecycle.formalMatterVersion, matter.version)) {
    return {
      formalMatter: identity,
      currentness: 'STALE',
      lifecycle: null,
      attentionStatus: record.recommendedAction ? 'STALE' : 'NONE',
      recommendedAction: null,
      examination: null,
      lastChangedAt: later(
        matter.updatedAt,
        lifecycle.updatedAt,
        ...(record.recommendedAction ? [record.recommendedAction.updatedAt] : [])
      ),
      officialStatusVerified: false,
      authorityConsequences: workspaceActionAuthorityConsequences
    };
  }

  const currentEvent = record.currentEvent;
  if (!currentEvent)
    throw new WorkspaceActionReadError(
      'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      'Current lifecycle view references a missing lifecycle event.',
      503,
      true
    );
  if (
    lifecycle.officialStatusVerified ||
    currentEvent.officialStatusVerified ||
    currentEvent.id !== lifecycle.currentEvent.id ||
    currentEvent.version !== lifecycle.currentEvent.version ||
    currentEvent.fingerprintSha256 !== lifecycle.currentEvent.fingerprintSha256 ||
    !sameVersion(currentEvent.formalMatterVersion, matter.version) ||
    currentEvent.state !== lifecycle.state
  )
    throw new WorkspaceActionReadError(
      'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      'Current lifecycle identity is inconsistent with exact owner truth.',
      503,
      true
    );

  const lifecycleProjection: WorkspaceActionLifecycleProjection = {
    id: lifecycle.id,
    version: lifecycle.version,
    fingerprintSha256: lifecycle.fingerprintSha256,
    state: lifecycle.state,
    customerSafeLabel: lifecycle.customerSafeLabel,
    customerSafeSummary: lifecycle.customerSafeSummary,
    updatedAt: exactTimestamp(lifecycle.updatedAt),
    officialStatusVerified: false
  };

  let attentionStatus: WorkspaceActionAttentionStatus = 'NONE';
  let recommendedAction: WorkspaceActionRecommendedActionProjection | null = null;
  const action = record.recommendedAction;
  if (action) {
    const exactCurrentAction =
      sameVersion(action.formalMatterVersion, matter.version) &&
      action.sourceLifecycleView.id === lifecycle.id &&
      action.sourceLifecycleView.version === lifecycle.version &&
      action.sourceLifecycleView.fingerprintSha256 === lifecycle.fingerprintSha256;
    if (!exactCurrentAction) attentionStatus = 'STALE';
    else {
      if (action.executionAuthorized)
        throw new WorkspaceActionReadError(
          'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
          'Recommended Action violates the no-execution-authority boundary.',
          503,
          true
        );
      recommendedAction = {
        id: action.id,
        version: action.version,
        title: action.title,
        explanation: action.explanation,
        ...(action.dueAt ? { dueAt: exactTimestamp(action.dueAt) } : {}),
        ...(action.timingBasis ? { timingBasis: action.timingBasis } : {}),
        status: action.status,
        executionAuthorized: false,
        updatedAt: exactTimestamp(action.updatedAt)
      };
      attentionStatus = action.status === 'OPEN' ? 'OPEN' : 'NONE';
    }
  }

  return {
    formalMatter: identity,
    currentness: 'CURRENT',
    lifecycle: lifecycleProjection,
    attentionStatus,
    recommendedAction,
    examination: examinationOf(lifecycle, currentEvent),
    lastChangedAt: later(
      matter.updatedAt,
      lifecycle.updatedAt,
      ...(action ? [action.updatedAt] : [])
    ),
    officialStatusVerified: false,
    authorityConsequences: workspaceActionAuthorityConsequences
  };
}

function stableOrder(left: WorkspaceActionItemV1, right: WorkspaceActionItemV1): number {
  return (
    right.lastChangedAt.localeCompare(left.lastChangedAt) ||
    String(left.formalMatter.id).localeCompare(String(right.formalMatter.id))
  );
}

export class WorkspaceActionReadService {
  constructor(
    private readonly source: WorkspaceActionSourceReader,
    private readonly now = () => new Date().toISOString()
  ) {}

  async get(workspaceId: string): Promise<WorkspaceActionProjectionV1> {
    const cleanedWorkspaceId = workspaceId.trim().toLowerCase();
    if (!cleanedWorkspaceId)
      throw new WorkspaceActionReadError('INVALID_INPUT', 'workspaceId is required.', 422);

    let records: readonly WorkspaceActionSourceRecord[];
    try {
      records = await this.source.list(cleanedWorkspaceId, WORKSPACE_ACTION_LIMIT + 1);
    } catch (cause) {
      if (cause instanceof WorkspaceActionReadError) throw cause;
      throw new WorkspaceActionReadError(
        'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
        'Workspace Action owner truth is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    const truncated = records.length > WORKSPACE_ACTION_LIMIT;
    const items = records.slice(0, WORKSPACE_ACTION_LIMIT).map(project).sort(stableOrder);
    return {
      schemaVersion: WORKSPACE_ACTION_SCHEMA_VERSION,
      workspaceId: cleanedWorkspaceId,
      generatedAt: exactTimestamp(this.now()),
      limit: WORKSPACE_ACTION_LIMIT,
      truncated,
      needsAttention: items.filter((item) => item.attentionStatus === 'OPEN'),
      waitingOrInProgress: items.filter((item) => item.attentionStatus !== 'OPEN'),
      recentlyChanged: items,
      officialStatusVerified: false,
      authorityConsequences: workspaceActionAuthorityConsequences
    };
  }
}

type Row = Record<string, unknown>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asTimestamp(value: unknown): string {
  if (!(typeof value === 'string' || value instanceof Date))
    throw new WorkspaceActionReadError(
      'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      'Workspace Action source timestamp is unavailable.',
      503,
      true
    );
  return exactTimestamp(value instanceof Date ? value.toISOString() : value);
}

function mapRow(row: Row): WorkspaceActionSourceRecord {
  const snapshot = object(row.source_snapshot);
  const preparation = object(snapshot.preparation);
  const matter: MatterSource = {
    id: String(row.formal_matter_id) as FormalMatterId,
    version: Number(row.formal_matter_version),
    ...(optionalText(preparation.trademark) ? { trademark: optionalText(preparation.trademark) } : {}),
    ...(optionalText(preparation.applicantName)
      ? { applicant: optionalText(preparation.applicantName) }
      : {}),
    ...(optionalText(preparation.targetJurisdiction)
      ? { jurisdiction: optionalText(preparation.targetJurisdiction) }
      : {}),
    updatedAt: asTimestamp(row.matter_updated_at)
  };

  const lifecycle = row.lifecycle_view_id
    ? {
        id: String(row.lifecycle_view_id),
        version: Number(row.lifecycle_view_version),
        fingerprintSha256: String(row.lifecycle_view_fingerprint_sha256),
        formalMatterVersion: String(row.lifecycle_formal_matter_version),
        currentEvent: {
          id: String(row.current_event_id),
          version: Number(row.current_event_version),
          fingerprintSha256: String(row.current_event_fingerprint_sha256)
        },
        state: String(row.lifecycle_state) as LifecycleProjectionState,
        customerSafeLabel: String(row.lifecycle_customer_safe_label),
        customerSafeSummary: String(row.lifecycle_customer_safe_summary),
        officialStatusVerified: row.lifecycle_official_status_verified === true,
        updatedAt: asTimestamp(row.lifecycle_updated_at)
      }
    : undefined;

  const currentEvent = row.current_event_row_id
    ? {
        id: String(row.current_event_row_id),
        version: Number(row.current_event_row_version),
        fingerprintSha256: String(row.current_event_row_fingerprint_sha256),
        formalMatterVersion: String(row.current_event_formal_matter_version),
        state: String(row.current_event_state) as LifecycleProjectionState,
        eventCode: String(row.current_event_code),
        officialStatusVerified: row.current_event_official_status_verified === true
      }
    : undefined;

  const recommendedAction = row.recommended_action_id
    ? {
        id: String(row.recommended_action_id),
        version: Number(row.recommended_action_version),
        formalMatterVersion: String(row.action_formal_matter_version),
        sourceLifecycleView: {
          id: String(row.action_source_lifecycle_view_id),
          version: Number(row.action_source_lifecycle_view_version),
          fingerprintSha256: String(row.action_source_lifecycle_view_fingerprint_sha256)
        },
        title: String(row.action_title),
        explanation: String(row.action_explanation),
        ...(row.action_due_at ? { dueAt: asTimestamp(row.action_due_at) } : {}),
        ...(optionalText(row.action_timing_basis)
          ? { timingBasis: optionalText(row.action_timing_basis) }
          : {}),
        status: String(row.action_status) as RecommendedActionStatus,
        executionAuthorized: row.action_execution_authorized === true,
        updatedAt: asTimestamp(row.action_updated_at)
      }
    : undefined;

  return {
    formalMatter: matter,
    ...(lifecycle ? { lifecycle } : {}),
    ...(currentEvent ? { currentEvent } : {}),
    ...(recommendedAction ? { recommendedAction } : {})
  };
}

export class PostgresWorkspaceActionSourceReader implements WorkspaceActionSourceReader {
  constructor(private readonly query: QueryClient) {}

  async list(workspaceId: string, limit: number): Promise<readonly WorkspaceActionSourceRecord[]> {
    try {
      const result = await this.query.query(
        `SELECT
          m.formal_matter_id,
          m.version AS formal_matter_version,
          m.source_snapshot,
          m.updated_at AS matter_updated_at,
          v.lifecycle_view_id,
          v.version AS lifecycle_view_version,
          v.formal_matter_version AS lifecycle_formal_matter_version,
          v.current_event_id,
          v.current_event_version,
          v.current_event_fingerprint_sha256,
          v.state AS lifecycle_state,
          v.customer_safe_label AS lifecycle_customer_safe_label,
          v.customer_safe_summary AS lifecycle_customer_safe_summary,
          v.lifecycle_view_fingerprint_sha256,
          v.official_status_verified AS lifecycle_official_status_verified,
          v.updated_at AS lifecycle_updated_at,
          e.lifecycle_event_id AS current_event_row_id,
          e.version AS current_event_row_version,
          e.formal_matter_version AS current_event_formal_matter_version,
          e.lifecycle_event_fingerprint_sha256 AS current_event_row_fingerprint_sha256,
          e.state AS current_event_state,
          e.event_code AS current_event_code,
          e.official_status_verified AS current_event_official_status_verified,
          a.recommended_action_id,
          a.version AS recommended_action_version,
          a.formal_matter_version AS action_formal_matter_version,
          a.source_lifecycle_view_id AS action_source_lifecycle_view_id,
          a.source_lifecycle_view_version AS action_source_lifecycle_view_version,
          a.source_lifecycle_view_fingerprint_sha256 AS action_source_lifecycle_view_fingerprint_sha256,
          a.title AS action_title,
          a.explanation AS action_explanation,
          a.due_at AS action_due_at,
          a.timing_basis AS action_timing_basis,
          a.status AS action_status,
          a.execution_authorized AS action_execution_authorized,
          a.updated_at AS action_updated_at
        FROM formal_matters m
        LEFT JOIN markreg_lifecycle_views v
          ON v.workspace_id=m.workspace_id AND v.formal_matter_id=m.formal_matter_id
        LEFT JOIN markreg_lifecycle_events e
          ON e.workspace_id=v.workspace_id AND e.lifecycle_event_id=v.current_event_id
        LEFT JOIN markreg_recommended_actions a
          ON a.workspace_id=m.workspace_id AND a.formal_matter_id=m.formal_matter_id
        WHERE m.workspace_id=$1
        ORDER BY GREATEST(
          m.updated_at,
          COALESCE(v.updated_at,m.updated_at),
          COALESCE(a.updated_at,m.updated_at)
        ) DESC, m.formal_matter_id ASC
        LIMIT $2`,
        [workspaceId, limit]
      );
      return result.rows.map((row) => mapRow(row as Row));
    } catch (cause) {
      if (cause instanceof WorkspaceActionReadError) throw cause;
      throw new WorkspaceActionReadError(
        'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
        'Workspace Action persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
}
