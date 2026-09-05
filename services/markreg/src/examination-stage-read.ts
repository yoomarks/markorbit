import type { FormalMatterId } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventProjection,
  LifecycleProjectionState
} from '@markorbit/contracts/evidence-lifecycle';
import type { FormalMatterRepository } from './formal-matter.js';

export const EXAMINATION_STAGE_SCHEMA_VERSION = 1 as const;
export const EXAMINATION_HISTORY_LIMIT = 50;

export const examinationEventPolicy = Object.freeze({
  EXAMINATION_INTERNAL_PROCESSING: 'INTERNAL_PROCESSING',
  EXAMINATION_REVIEWED_EVIDENCE: 'REVIEWED_PROVIDER_EVIDENCE',
  EXAMINATION_WAITING_NO_ACTION: 'WAITING_NO_ACTION',
  EXAMINATION_CUSTOMER_ACTION_NEEDED: 'CUSTOMER_ACTION_NEEDED',
  EXAMINATION_CORRECTION_OR_REVIEW_ISSUE: 'CORRECTION_OR_REVIEW_ISSUE'
} satisfies Readonly<Record<string, LifecycleProjectionState>>);

export type ExaminationEventCode = keyof typeof examinationEventPolicy;
export type ExaminationStageStatus = 'ESTABLISHED' | 'NOT_ESTABLISHED';
export type ExaminationSourceClass = 'REVIEWED_EXTERNAL_EVIDENCE';
export type ExaminationProjectionClass = 'INTERNAL_PRODUCT_PROJECTION';
export type ExaminationSourceCurrentness = 'CURRENT' | 'HISTORICAL';

export type ExaminationStageReadErrorCode =
  | 'FORMAL_MATTER_NOT_FOUND'
  | 'EXAMINATION_POLICY_DENIED'
  | 'EXAMINATION_SOURCE_STALE'
  | 'EXAMINATION_TRUTH_UNAVAILABLE';

export class ExaminationStageReadError extends Error {
  constructor(
    readonly code: ExaminationStageReadErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ExaminationStageReadError';
  }
}

export interface ExaminationLifecycleReader {
  getCurrentView(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<CurrentLifecycleView | undefined>;
  listEvents(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<readonly LifecycleEventProjection[]>;
}

export interface ExaminationStageSourceProjection {
  reviewedSourceAdmission: {
    id: string;
    version: number | string;
    fingerprintSha256: string;
  };
  evidenceReviewDecision: { id: string; version: number | string };
  evidenceReceipt: { id: string; version: number | string };
  providerReturn: { id: string; version: number | string };
  formalMatter: { id: FormalMatterId; version: number | string };
}

export interface ExaminationStageHistoryEntry {
  lifecycleEvent: {
    id: string;
    version: number;
    fingerprintSha256: string;
  };
  workflowState: LifecycleProjectionState;
  eventCode: ExaminationEventCode;
  customerSafeLabel: string;
  customerSafeSummary: string;
  sourceClass: ExaminationSourceClass;
  projectionClass: ExaminationProjectionClass;
  sourceCurrentness: 'HISTORICAL';
  source: ExaminationStageSourceProjection;
  occurredAt: string;
  projectedAt: string;
  officialStatusVerified: false;
}

export interface ExaminationStageCurrentEntry
  extends Omit<ExaminationStageHistoryEntry, 'sourceCurrentness'> {
  lifecycleView: {
    id: string;
    version: number;
    fingerprintSha256: string;
  };
  sourceCurrentness: 'CURRENT';
}

export interface ExaminationAuthorityConsequences {
  protectedActionAuthorized: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentCreated: false;
  providerContacted: false;
  officeMutationCreated: false;
  officialTruthCreated: false;
}

export const examinationReadAuthorityConsequences: Readonly<ExaminationAuthorityConsequences> =
  Object.freeze({
    protectedActionAuthorized: false,
    filingAuthorized: false,
    filingSubmitted: false,
    paymentCreated: false,
    providerContacted: false,
    officeMutationCreated: false,
    officialTruthCreated: false
  });

export interface ExaminationStageProjectionV1 {
  schemaVersion: typeof EXAMINATION_STAGE_SCHEMA_VERSION;
  workspaceId: string;
  formalMatter: { id: FormalMatterId; version: number | string };
  status: ExaminationStageStatus;
  current: ExaminationStageCurrentEntry | null;
  history: readonly ExaminationStageHistoryEntry[];
  deadline: null;
  deadlineStatus: 'UNAVAILABLE';
  officialStatusVerified: false;
  authorityConsequences: Readonly<ExaminationAuthorityConsequences>;
}

function sameVersion(left: number | string, right: number | string): boolean {
  return String(left) === String(right);
}

function policyState(eventCode: string): LifecycleProjectionState | undefined {
  return (examinationEventPolicy as Readonly<Record<string, LifecycleProjectionState>>)[eventCode];
}

function ensureEventPolicy(
  event: Readonly<LifecycleEventProjection>
): event is LifecycleEventProjection & {
  eventCode: ExaminationEventCode;
} {
  const expected = policyState(event.eventCode);
  if (!expected) return false;
  if (expected !== event.state)
    throw new ExaminationStageReadError(
      'EXAMINATION_POLICY_DENIED',
      `Examination event ${event.eventCode} is not valid for lifecycle state ${event.state}.`,
      409,
      false,
      { eventCode: event.eventCode, lifecycleState: event.state }
    );
  return true;
}

function ensureCurrentIntegrity(
  workspaceId: string,
  formalMatterId: FormalMatterId,
  formalMatterVersion: number | string,
  view: Readonly<CurrentLifecycleView>,
  events: readonly LifecycleEventProjection[]
): LifecycleEventProjection {
  if (
    view.workspaceId !== workspaceId ||
    view.formalMatter.id !== formalMatterId ||
    !sameVersion(view.formalMatter.version, formalMatterVersion)
  )
    throw new ExaminationStageReadError(
      'EXAMINATION_SOURCE_STALE',
      'Current lifecycle view no longer matches the exact Formal Matter owner truth.',
      409
    );
  if (view.officialStatusVerified !== false)
    throw new ExaminationStageReadError(
      'EXAMINATION_TRUTH_UNAVAILABLE',
      'Lifecycle view violates the Examination V1 Official Truth boundary.',
      503,
      true
    );

  const currentEvent = events.find(
    (event) => event.lifecycleEventId === view.currentEvent.id
  );
  if (!currentEvent)
    throw new ExaminationStageReadError(
      'EXAMINATION_TRUTH_UNAVAILABLE',
      'Current lifecycle view references a missing lifecycle event.',
      503,
      true
    );
  if (
    currentEvent.version !== view.currentEvent.version ||
    currentEvent.lifecycleEventFingerprintSha256 !== view.currentEventFingerprintSha256
  )
    throw new ExaminationStageReadError(
      'EXAMINATION_TRUTH_UNAVAILABLE',
      'Current lifecycle event identity does not match the exact lifecycle view.',
      503,
      true
    );
  if (
    currentEvent.workspaceId !== workspaceId ||
    currentEvent.formalMatter.id !== formalMatterId ||
    !sameVersion(currentEvent.formalMatter.version, formalMatterVersion) ||
    currentEvent.source.formalMatter.id !== formalMatterId ||
    !sameVersion(currentEvent.source.formalMatter.version, formalMatterVersion)
  )
    throw new ExaminationStageReadError(
      'EXAMINATION_SOURCE_STALE',
      'Current lifecycle event no longer matches the exact Formal Matter owner truth.',
      409
    );
  if (
    currentEvent.state !== view.state ||
    currentEvent.customerSafeLabel !== view.customerSafeLabel ||
    currentEvent.customerSafeSummary !== view.customerSafeSummary
  )
    throw new ExaminationStageReadError(
      'EXAMINATION_TRUTH_UNAVAILABLE',
      'Current lifecycle view and event disagree on projected workflow truth.',
      503,
      true
    );
  if (currentEvent.officialStatusVerified !== false)
    throw new ExaminationStageReadError(
      'EXAMINATION_TRUTH_UNAVAILABLE',
      'Lifecycle event violates the Examination V1 Official Truth boundary.',
      503,
      true
    );
  return currentEvent;
}

function sourceOf(
  event: Readonly<LifecycleEventProjection>
): ExaminationStageSourceProjection {
  return {
    reviewedSourceAdmission: {
      id: event.source.reviewedSourceAdmission.id,
      version: event.source.reviewedSourceAdmission.version,
      fingerprintSha256: event.source.admissionFingerprintSha256
    },
    evidenceReviewDecision: {
      id: event.source.evidenceReviewDecision.id,
      version: event.source.evidenceReviewDecision.version
    },
    evidenceReceipt: {
      id: event.source.evidenceReceipt.id,
      version: event.source.evidenceReceipt.version
    },
    providerReturn: {
      id: event.source.providerReturn.id,
      version: event.source.providerReturn.version
    },
    formalMatter: {
      id: event.source.formalMatter.id,
      version: event.source.formalMatter.version
    }
  };
}

function historicalEntry(
  event: Readonly<LifecycleEventProjection> & { eventCode: ExaminationEventCode }
): ExaminationStageHistoryEntry {
  return {
    lifecycleEvent: {
      id: event.lifecycleEventId,
      version: event.version,
      fingerprintSha256: event.lifecycleEventFingerprintSha256
    },
    workflowState: event.state,
    eventCode: event.eventCode,
    customerSafeLabel: event.customerSafeLabel,
    customerSafeSummary: event.customerSafeSummary,
    sourceClass: 'REVIEWED_EXTERNAL_EVIDENCE',
    projectionClass: 'INTERNAL_PRODUCT_PROJECTION',
    sourceCurrentness: 'HISTORICAL',
    source: sourceOf(event),
    occurredAt: event.occurredAt,
    projectedAt: event.projectedAt,
    officialStatusVerified: false
  };
}

function currentEntry(
  view: Readonly<CurrentLifecycleView>,
  event: Readonly<LifecycleEventProjection> & { eventCode: ExaminationEventCode }
): ExaminationStageCurrentEntry {
  return {
    ...historicalEntry(event),
    lifecycleView: {
      id: view.lifecycleViewId,
      version: view.version,
      fingerprintSha256: view.lifecycleViewFingerprintSha256
    },
    sourceCurrentness: 'CURRENT'
  };
}

export class ExaminationStageReadService {
  constructor(
    private readonly formalMatters: FormalMatterRepository,
    private readonly lifecycle: ExaminationLifecycleReader
  ) {}

  async get(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<ExaminationStageProjectionV1> {
    let formalMatter;
    try {
      formalMatter = await this.formalMatters.findById(workspaceId, formalMatterId);
    } catch (cause) {
      throw new ExaminationStageReadError(
        'EXAMINATION_TRUTH_UNAVAILABLE',
        'Formal Matter persistence is unavailable for Examination read.',
        503,
        true,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!formalMatter)
      throw new ExaminationStageReadError(
        'FORMAL_MATTER_NOT_FOUND',
        'Formal Matter was not found.',
        404
      );

    let view: CurrentLifecycleView | undefined;
    let events: readonly LifecycleEventProjection[];
    try {
      [view, events] = await Promise.all([
        this.lifecycle.getCurrentView(workspaceId, formalMatterId),
        this.lifecycle.listEvents(workspaceId, formalMatterId)
      ]);
    } catch (cause) {
      throw new ExaminationStageReadError(
        'EXAMINATION_TRUTH_UNAVAILABLE',
        'Lifecycle persistence is unavailable for Examination read.',
        503,
        true,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    const qualifying = events.filter(ensureEventPolicy);
    if (!view && events.length > 0)
      throw new ExaminationStageReadError(
        'EXAMINATION_TRUTH_UNAVAILABLE',
        'Lifecycle history exists without an exact current lifecycle view.',
        503,
        true
      );

    let currentEvent: LifecycleEventProjection | undefined;
    if (view)
      currentEvent = ensureCurrentIntegrity(
        workspaceId,
        formalMatterId,
        formalMatter.version,
        view,
        events
      );

    const currentQualifies = currentEvent ? ensureEventPolicy(currentEvent) : false;
    const history = qualifying
      .filter(
        (event) =>
          !currentQualifies || event.lifecycleEventId !== currentEvent?.lifecycleEventId
      )
      .slice(-EXAMINATION_HISTORY_LIMIT)
      .map(historicalEntry);

    return {
      schemaVersion: EXAMINATION_STAGE_SCHEMA_VERSION,
      workspaceId,
      formalMatter: { id: formalMatterId, version: formalMatter.version },
      status: currentQualifies ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
      current:
        currentQualifies && view && currentEvent
          ? currentEntry(
              view,
              currentEvent as LifecycleEventProjection & {
                eventCode: ExaminationEventCode;
              }
            )
          : null,
      history,
      deadline: null,
      deadlineStatus: 'UNAVAILABLE',
      officialStatusVerified: false,
      authorityConsequences: examinationReadAuthorityConsequences
    };
  }
}
