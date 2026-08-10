import { createHash, randomUUID } from 'node:crypto';
import type { FormalMatterId } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventId,
  LifecycleEventProjection,
  LifecycleProjectionSource,
  LifecycleProjectionState,
  LifecycleViewId,
  ProjectLifecycleEventCommand,
  ReviewedSourceAdmissionEnvelope,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import type { QueryClient } from '@markorbit/persistence';
import type { FormalMatterRepository, TransactionHost } from './formal-matter.js';

export type LifecycleProjectionErrorCode =
  | 'INVALID_INPUT'
  | 'LIFECYCLE_SOURCE_NOT_ADMITTED'
  | 'SOURCE_VERSION_MISMATCH'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE'
  | 'DEPENDENCY_UNAVAILABLE';

export class LifecycleProjectionError extends Error {
  constructor(
    readonly code: LifecycleProjectionErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'LifecycleProjectionError';
  }
}

export interface ReviewedSourceAdmissionReader {
  findReviewedSourceAdmission(
    reviewedSourceAdmissionId: ReviewedSourceAdmissionId
  ): Promise<ReviewedSourceAdmissionEnvelope | undefined>;
}

export interface LifecycleProjectionRecordResult {
  event: LifecycleEventProjection;
  currentView: CurrentLifecycleView;
}

interface LifecycleProjectionWrite {
  eventId: LifecycleEventId;
  viewId: LifecycleViewId;
  workspaceId: string;
  formalMatterId: FormalMatterId;
  formalMatterVersion: number | string;
  source: LifecycleProjectionSource;
  state: LifecycleProjectionState;
  eventCode: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  occurredAt: string;
  projectedAt: string;
  correlationId: string;
}

export interface LifecycleProjectionRepository {
  append(
    value: Readonly<LifecycleProjectionWrite>,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<LifecycleProjectionRecordResult>;
  getCurrentView(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<CurrentLifecycleView | undefined>;
  listEvents(
    workspaceId: string,
    formalMatterId: FormalMatterId
  ): Promise<readonly LifecycleEventProjection[]>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const clone = <T>(value: T): T => structuredClone(value);

type Row = Record<string, unknown>;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function cleanText(value: string, field: string, maximum = 2000): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new LifecycleProjectionError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new LifecycleProjectionError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422
    );
  return cleaned;
}

function cleanWorkspaceId(value: string, field = 'workspaceId'): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new LifecycleProjectionError(
      'INVALID_INPUT',
      `${field} must be a Core Workspace UUID.`,
      422
    );
  return cleaned;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new LifecycleProjectionError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function exactPositiveVersion(value: number | string, field: string): number | string {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1)
      throw new LifecycleProjectionError(
        'INVALID_INPUT',
        `${field} must be a positive integer or non-empty version string.`,
        422
      );
    return value;
  }
  return cleanText(value, field, 100);
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new LifecycleProjectionError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return parsed.toISOString();
}

function sameVersion(left: number | string, right: number | string): boolean {
  return String(left) === String(right);
}

function lifecycleSource(admission: Readonly<ReviewedSourceAdmissionEnvelope>): LifecycleProjectionSource {
  return {
    reviewedSourceAdmission: {
      id: admission.reviewedSourceAdmissionId,
      version: admission.version
    },
    admissionFingerprintSha256: admission.admissionFingerprintSha256,
    evidenceReviewDecision: clone(admission.reviewDecision),
    evidenceReceipt: clone(admission.evidenceSource.evidenceReceipt),
    providerReturn: clone(admission.evidenceSource.providerReturn),
    formalMatter: clone(admission.formalMatter)
  };
}

const statePrecedence: Readonly<Record<LifecycleProjectionState, number>> = Object.freeze({
  INTERNAL_PROCESSING: 10,
  REVIEWED_PROVIDER_EVIDENCE: 20,
  WAITING_NO_ACTION: 30,
  CUSTOMER_ACTION_NEEDED: 40,
  CORRECTION_OR_REVIEW_ISSUE: 50
});

function candidateBecomesCurrent(
  candidate: Readonly<LifecycleEventProjection>,
  current: Readonly<LifecycleEventProjection>
): boolean {
  const candidateOccurredAt = Date.parse(candidate.occurredAt);
  const currentOccurredAt = Date.parse(current.occurredAt);
  if (candidateOccurredAt !== currentOccurredAt) return candidateOccurredAt > currentOccurredAt;
  const stateDifference = statePrecedence[candidate.state] - statePrecedence[current.state];
  if (stateDifference !== 0) return stateDifference > 0;
  return (
    String(candidate.source.reviewedSourceAdmission.id).localeCompare(
      String(current.source.reviewedSourceAdmission.id)
    ) > 0
  );
}

export class PostgresLifecycleProjectionRepository implements LifecycleProjectionRepository {
  constructor(
    private readonly database: TransactionHost,
    private readonly query: QueryClient
  ) {}

  async append(
    value: Readonly<LifecycleProjectionWrite>,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<LifecycleProjectionRecordResult> {
    try {
      return await this.database.transact(async (client) => {
        const replay = await client.query(
          'SELECT request_fingerprint,result_snapshot FROM markreg_lifecycle_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
          [value.workspaceId, idempotencyKey]
        );
        if (replay.rowCount) {
          const row = replay.rows[0] as Row;
          if (String(row.request_fingerprint) !== requestFingerprint)
            throw new LifecycleProjectionError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different lifecycle projection payload.'
            );
          return clone(row.result_snapshot as LifecycleProjectionRecordResult);
        }

        const lockedMatter = await client.query(
          'SELECT version FROM formal_matters WHERE workspace_id=$1 AND formal_matter_id=$2 FOR UPDATE',
          [value.workspaceId, value.formalMatterId]
        );
        if (!lockedMatter.rowCount)
          throw new LifecycleProjectionError(
            'LIFECYCLE_SOURCE_NOT_ADMITTED',
            'Formal Matter is unavailable in the requested Workspace.'
          );
        if (!sameVersion(Number((lockedMatter.rows[0] as Row).version), value.formalMatterVersion))
          throw new LifecycleProjectionError(
            'SOURCE_VERSION_MISMATCH',
            'Formal Matter version changed before lifecycle projection could be recorded.'
          );

        const duplicate = await client.query(
          'SELECT * FROM markreg_lifecycle_events WHERE workspace_id=$1 AND reviewed_source_admission_id=$2 AND reviewed_source_admission_version=$3 AND admission_fingerprint_sha256=$4',
          [
            value.workspaceId,
            value.source.reviewedSourceAdmission.id,
            Number(value.source.reviewedSourceAdmission.version),
            value.source.admissionFingerprintSha256
          ]
        );
        if (duplicate.rowCount) {
          const duplicateRow = duplicate.rows[0] as Row;
          if (String(duplicateRow.projection_request_fingerprint) !== requestFingerprint)
            throw new LifecycleProjectionError(
              'VERSION_CONFLICT',
              'The exact Reviewed Source Admission already produced a different lifecycle event.'
            );
          const event = this.mapEvent(duplicateRow);
          const currentView = await this.findCurrentView(client, value.workspaceId, value.formalMatterId);
          if (!currentView)
            throw new LifecycleProjectionError(
              'PERSISTENCE_UNAVAILABLE',
              'Lifecycle event exists without its current lifecycle view.'
            );
          const result = { event, currentView };
          await this.insertCommand(
            client,
            value.workspaceId,
            idempotencyKey,
            requestFingerprint,
            event.lifecycleEventId,
            result,
            value.projectedAt
          );
          return result;
        }

        const eventVersionResult = await client.query(
          'SELECT COALESCE(MAX(version),0)::int AS version FROM markreg_lifecycle_events WHERE workspace_id=$1 AND formal_matter_id=$2',
          [value.workspaceId, value.formalMatterId]
        );
        const eventVersion = Number((eventVersionResult.rows[0] as Row).version) + 1;
        const eventWithoutFingerprint: Omit<
          LifecycleEventProjection,
          'lifecycleEventFingerprintSha256'
        > = {
          schemaVersion: 1,
          lifecycleEventId: value.eventId,
          workspaceId: value.workspaceId,
          formalMatter: { id: value.formalMatterId, version: value.formalMatterVersion },
          version: eventVersion,
          source: clone(value.source),
          state: value.state,
          eventCode: value.eventCode,
          customerSafeLabel: value.customerSafeLabel,
          customerSafeSummary: value.customerSafeSummary,
          occurredAt: value.occurredAt,
          projectedAt: value.projectedAt,
          officialStatusVerified: false,
          correlationId: value.correlationId as never
        };
        const event: LifecycleEventProjection = {
          ...eventWithoutFingerprint,
          lifecycleEventFingerprintSha256: fingerprint(eventWithoutFingerprint)
        };
        await client.query(
          'INSERT INTO markreg_lifecycle_events (lifecycle_event_id,workspace_id,formal_matter_id,formal_matter_version,version,reviewed_source_admission_id,reviewed_source_admission_version,admission_fingerprint_sha256,source_provenance,state,event_code,customer_safe_label,customer_safe_summary,occurred_at,projected_at,lifecycle_event_fingerprint_sha256,official_status_verified,correlation_id,projection_request_fingerprint) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,false,$17,$18)',
          [
            event.lifecycleEventId,
            event.workspaceId,
            event.formalMatter.id,
            String(event.formalMatter.version),
            event.version,
            event.source.reviewedSourceAdmission.id,
            Number(event.source.reviewedSourceAdmission.version),
            event.source.admissionFingerprintSha256,
            JSON.stringify(event.source),
            event.state,
            event.eventCode,
            event.customerSafeLabel,
            event.customerSafeSummary,
            event.occurredAt,
            event.projectedAt,
            event.lifecycleEventFingerprintSha256,
            event.correlationId,
            requestFingerprint
          ]
        );

        const previousView = await this.findCurrentView(
          client,
          value.workspaceId,
          value.formalMatterId,
          true
        );
        let currentEvent = event;
        if (previousView) {
          const priorEvent = await this.findEvent(
            client,
            value.workspaceId,
            previousView.currentEvent.id
          );
          if (!priorEvent)
            throw new LifecycleProjectionError(
              'PERSISTENCE_UNAVAILABLE',
              'Current lifecycle view references a missing lifecycle event.'
            );
          if (!candidateBecomesCurrent(event, priorEvent)) currentEvent = priorEvent;
        }

        const viewWithoutFingerprint: Omit<
          CurrentLifecycleView,
          'lifecycleViewFingerprintSha256'
        > = {
          schemaVersion: 1,
          lifecycleViewId: previousView?.lifecycleViewId ?? value.viewId,
          workspaceId: value.workspaceId,
          formalMatter: clone(currentEvent.formalMatter),
          version: (previousView?.version ?? 0) + 1,
          currentEvent: { id: currentEvent.lifecycleEventId, version: currentEvent.version },
          currentEventFingerprintSha256: currentEvent.lifecycleEventFingerprintSha256,
          state: currentEvent.state,
          customerSafeLabel: currentEvent.customerSafeLabel,
          customerSafeSummary: currentEvent.customerSafeSummary,
          officialStatusVerified: false,
          updatedAt: value.projectedAt
        };
        const currentView: CurrentLifecycleView = {
          ...viewWithoutFingerprint,
          lifecycleViewFingerprintSha256: fingerprint(viewWithoutFingerprint)
        };
        await client.query(
          'INSERT INTO markreg_lifecycle_views (lifecycle_view_id,workspace_id,formal_matter_id,formal_matter_version,version,current_event_id,current_event_version,current_event_fingerprint_sha256,state,customer_safe_label,customer_safe_summary,lifecycle_view_fingerprint_sha256,official_status_verified,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13) ON CONFLICT (workspace_id,formal_matter_id) DO UPDATE SET formal_matter_version=EXCLUDED.formal_matter_version,version=EXCLUDED.version,current_event_id=EXCLUDED.current_event_id,current_event_version=EXCLUDED.current_event_version,current_event_fingerprint_sha256=EXCLUDED.current_event_fingerprint_sha256,state=EXCLUDED.state,customer_safe_label=EXCLUDED.customer_safe_label,customer_safe_summary=EXCLUDED.customer_safe_summary,lifecycle_view_fingerprint_sha256=EXCLUDED.lifecycle_view_fingerprint_sha256,official_status_verified=false,updated_at=EXCLUDED.updated_at',
          [
            currentView.lifecycleViewId,
            currentView.workspaceId,
            currentView.formalMatter.id,
            String(currentView.formalMatter.version),
            currentView.version,
            currentView.currentEvent.id,
            Number(currentView.currentEvent.version),
            currentView.currentEventFingerprintSha256,
            currentView.state,
            currentView.customerSafeLabel,
            currentView.customerSafeSummary,
            currentView.lifecycleViewFingerprintSha256,
            currentView.updatedAt
          ]
        );

        const result = { event, currentView };
        await this.insertCommand(
          client,
          value.workspaceId,
          idempotencyKey,
          requestFingerprint,
          event.lifecycleEventId,
          result,
          value.projectedAt
        );
        return result;
      });
    } catch (cause) {
      if (cause instanceof LifecycleProjectionError) throw cause;
      throw new LifecycleProjectionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg lifecycle projection persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async getCurrentView(workspaceId: string, formalMatterId: FormalMatterId) {
    try {
      return await this.findCurrentView(this.query, workspaceId, formalMatterId);
    } catch (cause) {
      if (cause instanceof LifecycleProjectionError) throw cause;
      throw new LifecycleProjectionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg lifecycle projection persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async listEvents(workspaceId: string, formalMatterId: FormalMatterId) {
    try {
      const rows = await this.query.query(
        'SELECT * FROM markreg_lifecycle_events WHERE workspace_id=$1 AND formal_matter_id=$2 ORDER BY occurred_at ASC,lifecycle_event_id ASC',
        [workspaceId, formalMatterId]
      );
      return rows.rows.map((row) => this.mapEvent(row as Row));
    } catch (cause) {
      throw new LifecycleProjectionError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg lifecycle projection persistence is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private async insertCommand(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string,
    lifecycleEventId: LifecycleEventId,
    result: Readonly<LifecycleProjectionRecordResult>,
    createdAt: string
  ) {
    await client.query(
      'INSERT INTO markreg_lifecycle_commands (workspace_id,idempotency_key,request_fingerprint,lifecycle_event_id,result_snapshot,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
      [
        workspaceId,
        idempotencyKey,
        requestFingerprint,
        lifecycleEventId,
        JSON.stringify(result),
        createdAt
      ]
    );
  }

  private async findEvent(client: QueryClient, workspaceId: string, lifecycleEventId: string) {
    const result = await client.query(
      'SELECT * FROM markreg_lifecycle_events WHERE workspace_id=$1 AND lifecycle_event_id=$2',
      [workspaceId, lifecycleEventId]
    );
    return result.rowCount ? this.mapEvent(result.rows[0] as Row) : undefined;
  }

  private async findCurrentView(
    client: QueryClient,
    workspaceId: string,
    formalMatterId: FormalMatterId,
    lock = false
  ) {
    const result = await client.query(
      `SELECT v.*,e.source_provenance FROM markreg_lifecycle_views v JOIN markreg_lifecycle_events e ON e.lifecycle_event_id=v.current_event_id WHERE v.workspace_id=$1 AND v.formal_matter_id=$2${lock ? ' FOR UPDATE OF v' : ''}`,
      [workspaceId, formalMatterId]
    );
    return result.rowCount ? this.mapView(result.rows[0] as Row) : undefined;
  }

  private mapEvent(row: Row): LifecycleEventProjection {
    const source = clone(row.source_provenance as LifecycleProjectionSource);
    return {
      schemaVersion: 1,
      lifecycleEventId: String(row.lifecycle_event_id) as LifecycleEventId,
      workspaceId: String(row.workspace_id),
      formalMatter: clone(source.formalMatter),
      version: Number(row.version),
      source,
      state: String(row.state) as LifecycleProjectionState,
      eventCode: String(row.event_code),
      customerSafeLabel: String(row.customer_safe_label),
      customerSafeSummary: String(row.customer_safe_summary),
      occurredAt: new Date(row.occurred_at as string).toISOString(),
      projectedAt: new Date(row.projected_at as string).toISOString(),
      lifecycleEventFingerprintSha256: String(row.lifecycle_event_fingerprint_sha256),
      officialStatusVerified: false,
      correlationId: String(row.correlation_id) as never
    };
  }

  private mapView(row: Row): CurrentLifecycleView {
    const source = row.source_provenance as LifecycleProjectionSource;
    return {
      schemaVersion: 1,
      lifecycleViewId: String(row.lifecycle_view_id) as LifecycleViewId,
      workspaceId: String(row.workspace_id),
      formalMatter: clone(source.formalMatter),
      version: Number(row.version),
      currentEvent: {
        id: String(row.current_event_id) as LifecycleEventId,
        version: Number(row.current_event_version)
      },
      currentEventFingerprintSha256: String(row.current_event_fingerprint_sha256),
      state: String(row.state) as LifecycleProjectionState,
      customerSafeLabel: String(row.customer_safe_label),
      customerSafeSummary: String(row.customer_safe_summary),
      lifecycleViewFingerprintSha256: String(row.lifecycle_view_fingerprint_sha256),
      officialStatusVerified: false,
      updatedAt: new Date(row.updated_at as string).toISOString()
    };
  }
}

export class LifecycleProjectionService {
  constructor(
    private readonly repository: LifecycleProjectionRepository,
    private readonly formalMatters: FormalMatterRepository,
    private readonly admissions: ReviewedSourceAdmissionReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly eventIdFactory: () => LifecycleEventId = () =>
      `lifecycle-event_${randomUUID()}`,
    private readonly viewIdFactory: () => LifecycleViewId = () => `lifecycle-view_${randomUUID()}`
  ) {}

  async project(
    command: Readonly<ProjectLifecycleEventCommand>
  ): Promise<LifecycleProjectionRecordResult> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const admissionVersion = exactPositiveVersion(
      command.expectedReviewedSourceAdmissionVersion,
      'expectedReviewedSourceAdmissionVersion'
    );
    if (typeof admissionVersion !== 'number')
      throw new LifecycleProjectionError(
        'INVALID_INPUT',
        'expectedReviewedSourceAdmissionVersion must be a positive integer.',
        422
      );
    const admissionFingerprint = exactSha256(
      command.expectedAdmissionFingerprintSha256,
      'expectedAdmissionFingerprintSha256'
    );
    const formalMatterVersion = exactPositiveVersion(
      command.expectedFormalMatterVersion,
      'expectedFormalMatterVersion'
    );
    const eventCode = cleanText(command.eventCode, 'eventCode', 200);
    const customerSafeLabel = cleanText(command.customerSafeLabel, 'customerSafeLabel', 300);
    const customerSafeSummary = cleanText(
      command.customerSafeSummary,
      'customerSafeSummary',
      2000
    );
    const occurredAt = exactTimestamp(command.occurredAt, 'occurredAt');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200);

    let admission: ReviewedSourceAdmissionEnvelope | undefined;
    try {
      admission = await this.admissions.findReviewedSourceAdmission(
        command.reviewedSourceAdmissionId
      );
    } catch (cause) {
      throw new LifecycleProjectionError(
        'DEPENDENCY_UNAVAILABLE',
        'Reviewed Source Admission dependency is unavailable.',
        503,
        undefined,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!admission)
      throw new LifecycleProjectionError(
        'LIFECYCLE_SOURCE_NOT_ADMITTED',
        'Reviewed Source Admission was not found.'
      );
    if (cleanWorkspaceId(admission.workspaceId, 'admission.workspaceId') !== workspaceId)
      throw new LifecycleProjectionError(
        'LIFECYCLE_SOURCE_NOT_ADMITTED',
        'Reviewed Source Admission belongs to another Workspace.',
        403
      );
    if (admission.version !== admissionVersion)
      throw new LifecycleProjectionError(
        'SOURCE_VERSION_MISMATCH',
        'Exact Reviewed Source Admission version is required.'
      );
    if (exactSha256(admission.admissionFingerprintSha256, 'admission.admissionFingerprintSha256') !== admissionFingerprint)
      throw new LifecycleProjectionError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Reviewed Source Admission fingerprint does not match the exact admitted source.'
      );
    if (
      admission.formalMatter.id !== command.formalMatterId ||
      !sameVersion(admission.formalMatter.version, formalMatterVersion)
    )
      throw new LifecycleProjectionError(
        'SOURCE_VERSION_MISMATCH',
        'Reviewed Source Admission does not bind the requested exact Formal Matter.'
      );
    if (admission.evidenceSource.workspaceId !== workspaceId)
      throw new LifecycleProjectionError(
        'LIFECYCLE_SOURCE_NOT_ADMITTED',
        'Evidence Review Source Workspace does not match the admitted source.',
        403
      );
    if (
      admission.correlationId !== correlationId ||
      admission.evidenceSource.correlationId !== correlationId
    )
      throw new LifecycleProjectionError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the exact Reviewed Source Admission.'
      );
    exactSha256(
      admission.reviewDecisionFingerprintSha256,
      'admission.reviewDecisionFingerprintSha256'
    );
    exactSha256(
      admission.evidenceSource.evidenceReceiptFingerprintSha256,
      'admission.evidenceSource.evidenceReceiptFingerprintSha256'
    );
    exactSha256(
      admission.evidenceSource.providerReturnFingerprintSha256,
      'admission.evidenceSource.providerReturnFingerprintSha256'
    );

    const formalMatter = await this.formalMatters.findById(workspaceId, command.formalMatterId);
    if (!formalMatter)
      throw new LifecycleProjectionError(
        'LIFECYCLE_SOURCE_NOT_ADMITTED',
        'Formal Matter was not found in the requested Workspace.'
      );
    if (!sameVersion(formalMatter.version, formalMatterVersion))
      throw new LifecycleProjectionError(
        'SOURCE_VERSION_MISMATCH',
        'Formal Matter version no longer matches the admitted source.'
      );

    const normalizedCommand = {
      command: 'PROJECT_LIFECYCLE_EVENT',
      workspaceId,
      reviewedSourceAdmissionId: command.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: admissionVersion,
      expectedAdmissionFingerprintSha256: admissionFingerprint,
      formalMatterId: command.formalMatterId,
      expectedFormalMatterVersion: formalMatterVersion,
      state: command.state,
      eventCode,
      customerSafeLabel,
      customerSafeSummary,
      occurredAt,
      correlationId
    } as const;
    const requestFingerprint = fingerprint(normalizedCommand);
    const projectedAt = exactTimestamp(this.now(), 'projectedAt');

    return this.repository.append(
      {
        eventId: this.eventIdFactory(),
        viewId: this.viewIdFactory(),
        workspaceId,
        formalMatterId: command.formalMatterId,
        formalMatterVersion,
        source: lifecycleSource(admission),
        state: command.state,
        eventCode,
        customerSafeLabel,
        customerSafeSummary,
        occurredAt,
        projectedAt,
        correlationId
      },
      idempotencyKey,
      requestFingerprint
    );
  }

  getCurrentView(workspaceId: string, formalMatterId: FormalMatterId) {
    return this.repository.getCurrentView(cleanWorkspaceId(workspaceId), formalMatterId);
  }

  listEvents(workspaceId: string, formalMatterId: FormalMatterId) {
    return this.repository.listEvents(cleanWorkspaceId(workspaceId), formalMatterId);
  }
}

export function lifecycleProjectionFingerprint(value: unknown): string {
  return fingerprint(value);
}
