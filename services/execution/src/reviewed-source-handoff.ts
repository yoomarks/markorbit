import { createHash, randomUUID } from 'node:crypto';
import type { FormalMatterId, MarkOrbitId } from '@markorbit/contracts';
import {
  reviewedSourceAdmissionAuthorityConsequences,
  type AdmitReviewedSourceCommand,
  type CurrentLifecycleView,
  type EvidenceLifecycleAuthorityConsequences,
  type LifecycleEventProjection,
  type LifecycleProjectionState,
  type ProjectLifecycleEventCommand,
  type ReviewedSourceAdmissionEnvelope,
  type ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import type { QueryClient } from '@markorbit/persistence';
import type {
  AuthenticatedEvidenceReviewerPrincipal,
  ExecutionEvidenceReviewRepository
} from './evidence-review.js';

export type ReviewedSourceHandoffStatus = 'PENDING' | 'DELIVERED';

export interface ReviewedSourceProjectionResult {
  event: LifecycleEventProjection;
  currentView: CurrentLifecycleView;
}

export interface ReviewedSourceHandoffRecord {
  workspaceId: string;
  reviewedSourceAdmissionId: ReviewedSourceAdmissionId;
  deliveryIdempotencyKey: string;
  deliveryRequestFingerprint: string;
  markRegIdempotencyKey: string;
  status: ReviewedSourceHandoffStatus;
  attemptCount: number;
  lastAttemptAt: string;
  lastErrorCode?: string;
  deliveredAt?: string;
  response?: ReviewedSourceProjectionResult;
}

export interface DeliverReviewedSourceCommand {
  workspaceId: string;
  reviewedSourceAdmissionId: ReviewedSourceAdmissionId;
  expectedReviewedSourceAdmissionVersion: number;
  expectedAdmissionFingerprintSha256: string;
  formalMatterId: FormalMatterId;
  expectedFormalMatterVersion: number | string;
  state: LifecycleProjectionState;
  eventCode: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  occurredAt: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ReviewedSourceAdmissionReplay {
  requestFingerprint: string;
  admission: ReviewedSourceAdmissionEnvelope;
}

export interface ReviewedSourceDeliveryPreparation {
  record: ReviewedSourceHandoffRecord;
  replay?: ReviewedSourceProjectionResult;
}

export interface ReviewedSourceAdmissionRepository {
  findAdmission(
    workspaceId: string,
    reviewedSourceAdmissionId: ReviewedSourceAdmissionId
  ): Promise<ReviewedSourceAdmissionEnvelope | undefined>;
  findAdmissionReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<ReviewedSourceAdmissionReplay | undefined>;
  recordAdmission(
    admission: ReviewedSourceAdmissionEnvelope,
    admittedBy: MarkOrbitId,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ReviewedSourceAdmissionEnvelope>;
  prepareDelivery(
    admission: ReviewedSourceAdmissionEnvelope,
    idempotencyKey: string,
    requestFingerprint: string,
    markRegIdempotencyKey: string,
    attemptedAt: string
  ): Promise<ReviewedSourceDeliveryPreparation>;
  markDeliveryFailed(
    admission: ReviewedSourceAdmissionEnvelope,
    requestFingerprint: string,
    errorCode: string,
    failedAt: string
  ): Promise<void>;
  markDelivered(
    admission: ReviewedSourceAdmissionEnvelope,
    requestFingerprint: string,
    result: ReviewedSourceProjectionResult,
    deliveredAt: string
  ): Promise<ReviewedSourceHandoffRecord>;
  getDelivery(
    workspaceId: string,
    reviewedSourceAdmissionId: ReviewedSourceAdmissionId
  ): Promise<ReviewedSourceHandoffRecord | undefined>;
}

export interface MarkRegLifecycleProjectionClient {
  project(command: Readonly<ProjectLifecycleEventCommand>): Promise<ReviewedSourceProjectionResult>;
}

export class ReviewedSourceHandoffError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'PERMISSION_DENIED'
      | 'REVIEW_DECISION_NOT_ADMISSIBLE'
      | 'STALE_SOURCE'
      | 'SOURCE_VERSION_MISMATCH'
      | 'SOURCE_FINGERPRINT_MISMATCH'
      | 'IDEMPOTENCY_CONFLICT'
      | 'VERSION_CONFLICT'
      | 'PERSISTENCE_UNAVAILABLE'
      | 'DEPENDENCY_UNAVAILABLE',
    message: string,
    public readonly status = 409,
    public readonly retryable = status >= 500,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ReviewedSourceHandoffError';
  }
}

export interface ReviewedSourceTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

type Row = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const clone = <T>(value: T): T => structuredClone(value);

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

export function reviewedSourceHandoffFingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function cleanText(value: string, field: string, maximum = 2000): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new ReviewedSourceHandoffError('INVALID_INPUT', `${field} is required.`, 422, false);
  if (cleaned.length > maximum)
    throw new ReviewedSourceHandoffError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422,
      false
    );
  return cleaned;
}

function cleanWorkspaceId(value: string, field = 'workspaceId'): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new ReviewedSourceHandoffError(
      'INVALID_INPUT',
      `${field} must be a Core Workspace UUID.`,
      422,
      false
    );
  return cleaned;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new ReviewedSourceHandoffError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422,
      false
    );
  return cleaned;
}

function exactVersion(value: number | string, field: string): number | string {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1)
      throw new ReviewedSourceHandoffError(
        'INVALID_INPUT',
        `${field} must be a positive integer or non-empty version string.`,
        422,
        false
      );
    return value;
  }
  return cleanText(value, field, 100);
}

function exactTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new ReviewedSourceHandoffError(
      'INVALID_INPUT',
      `${field} must be an ISO timestamp.`,
      422,
      false
    );
  return parsed.toISOString();
}

function sameVersion(left: number | string, right: number | string): boolean {
  return String(left) === String(right);
}

function normalizeReferences(values: readonly string[]): string[] {
  return [...new Set(values.map((value, index) => cleanText(value, `admittedEvidenceReferences[${index}]`, 1000)))].sort();
}

export class PostgresReviewedSourceAdmissionRepository
  implements ReviewedSourceAdmissionRepository
{
  constructor(
    private readonly database: ReviewedSourceTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findAdmission(workspaceId: string, reviewedSourceAdmissionId: ReviewedSourceAdmissionId) {
    try {
      const result = await this.query.query(
        `SELECT admission_record
           FROM execution_reviewed_source_admissions
          WHERE workspace_id=$1 AND reviewed_source_admission_id=$2`,
        [workspaceId, reviewedSourceAdmissionId]
      );
      return result.rowCount
        ? clone((result.rows[0] as Row).admission_record as ReviewedSourceAdmissionEnvelope)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findAdmissionReplay(workspaceId: string, idempotencyKey: string) {
    try {
      const result = await this.query.query(
        `SELECT request_fingerprint,response_record
           FROM execution_reviewed_source_admission_commands
          WHERE workspace_id=$1 AND idempotency_key=$2`,
        [workspaceId, idempotencyKey]
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0] as Row;
      return {
        requestFingerprint: String(row.request_fingerprint),
        admission: clone(row.response_record as ReviewedSourceAdmissionEnvelope)
      };
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async recordAdmission(
    admission: ReviewedSourceAdmissionEnvelope,
    admittedBy: MarkOrbitId,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const decisionResult = await client.query(
          `SELECT decision_record,decision_fingerprint_sha256,outcome,evidence_receipt_id
             FROM execution_evidence_review_decisions
            WHERE workspace_id=$1 AND evidence_review_decision_id=$2
            FOR UPDATE`,
          [admission.workspaceId, admission.reviewDecision.id]
        );
        if (!decisionResult.rowCount)
          throw new ReviewedSourceHandoffError(
            'REVIEW_DECISION_NOT_ADMISSIBLE',
            'Evidence Review Decision was not found in the requested Workspace.'
          );
        const decisionRow = decisionResult.rows[0] as Row;
        if (String(decisionRow.outcome) !== 'ADMITTED_FOR_INTERNAL_USE')
          throw new ReviewedSourceHandoffError(
            'REVIEW_DECISION_NOT_ADMISSIBLE',
            'Only ADMITTED_FOR_INTERNAL_USE review decisions may create a Reviewed Source Admission.'
          );
        if (
          String(decisionRow.decision_fingerprint_sha256) !==
          admission.reviewDecisionFingerprintSha256
        )
          throw new ReviewedSourceHandoffError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Evidence Review Decision fingerprint changed before admission was recorded.'
          );

        const newer = await client.query(
          `SELECT 1
             FROM execution_evidence_review_sources s
             JOIN execution_provider_return_evidence_receipts r
               ON r.provider_return_id=s.provider_return_id
            WHERE s.evidence_receipt_id=$1
              AND r.provider_return_version>s.provider_return_version
            LIMIT 1`,
          [String(decisionRow.evidence_receipt_id)]
        );
        if (newer.rowCount)
          throw new ReviewedSourceHandoffError(
            'STALE_SOURCE',
            'A newer Provider Return evidence receipt supersedes this reviewed source.'
          );

        const replay = await client.query(
          `SELECT request_fingerprint,response_record
             FROM execution_reviewed_source_admission_commands
            WHERE workspace_id=$1 AND idempotency_key=$2
            FOR UPDATE`,
          [admission.workspaceId, idempotencyKey]
        );
        if (replay.rowCount) {
          const row = replay.rows[0] as Row;
          if (String(row.request_fingerprint) !== requestFingerprint)
            throw new ReviewedSourceHandoffError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different Reviewed Source Admission payload.'
            );
          return clone(row.response_record as ReviewedSourceAdmissionEnvelope);
        }

        const existing = await client.query(
          `SELECT admission_record,admission_fingerprint_sha256
             FROM execution_reviewed_source_admissions
            WHERE evidence_review_decision_id=$1
            FOR UPDATE`,
          [admission.reviewDecision.id]
        );
        if (existing.rowCount) {
          const row = existing.rows[0] as Row;
          if (String(row.admission_fingerprint_sha256) !== admission.admissionFingerprintSha256)
            throw new ReviewedSourceHandoffError(
              'VERSION_CONFLICT',
              'The exact Evidence Review Decision is already bound to a different admission.'
            );
          const value = clone(row.admission_record as ReviewedSourceAdmissionEnvelope);
          await this.insertAdmissionCommand(
            client,
            admission.workspaceId,
            idempotencyKey,
            requestFingerprint,
            value,
            admission.admittedAt
          );
          return value;
        }

        await client.query(
          `INSERT INTO execution_reviewed_source_admissions(
             reviewed_source_admission_id,workspace_id,version,evidence_review_decision_id,
             evidence_review_decision_version,evidence_review_decision_fingerprint_sha256,
             formal_matter_id,formal_matter_version,admitted_evidence_references,
             admission_fingerprint_sha256,admission_record,admitted_by,admitted_at,correlation_id
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12,$13,$14)`,
          [
            admission.reviewedSourceAdmissionId,
            admission.workspaceId,
            admission.version,
            admission.reviewDecision.id,
            Number(admission.reviewDecision.version),
            admission.reviewDecisionFingerprintSha256,
            admission.formalMatter.id,
            String(admission.formalMatter.version),
            JSON.stringify(admission.admittedEvidenceReferences),
            admission.admissionFingerprintSha256,
            JSON.stringify(admission),
            admittedBy,
            admission.admittedAt,
            admission.correlationId
          ]
        );
        await client.query(
          `INSERT INTO execution_reviewed_source_handoff_audit(
             workspace_id,reviewed_source_admission_id,action,actor_id,source_fingerprint,details,created_at
           ) VALUES($1,$2,'REVIEWED_SOURCE_ADMITTED',$3,$4,$5::jsonb,$6)`,
          [
            admission.workspaceId,
            admission.reviewedSourceAdmissionId,
            admittedBy,
            admission.admissionFingerprintSha256,
            JSON.stringify({
              reviewDecision: admission.reviewDecision,
              formalMatter: admission.formalMatter
            }),
            admission.admittedAt
          ]
        );
        await this.insertAdmissionCommand(
          client,
          admission.workspaceId,
          idempotencyKey,
          requestFingerprint,
          admission,
          admission.admittedAt
        );
        return clone(admission);
      });
    } catch (cause) {
      if (cause instanceof ReviewedSourceHandoffError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ReviewedSourceHandoffError(
          'VERSION_CONFLICT',
          'Reviewed Source Admission changed concurrently.'
        );
      throw this.unavailable(cause);
    }
  }

  async prepareDelivery(
    admission: ReviewedSourceAdmissionEnvelope,
    idempotencyKey: string,
    requestFingerprint: string,
    markRegIdempotencyKey: string,
    attemptedAt: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const locked = await client.query(
          `SELECT admission_fingerprint_sha256
             FROM execution_reviewed_source_admissions
            WHERE workspace_id=$1 AND reviewed_source_admission_id=$2
            FOR UPDATE`,
          [admission.workspaceId, admission.reviewedSourceAdmissionId]
        );
        if (!locked.rowCount)
          throw new ReviewedSourceHandoffError(
            'STALE_SOURCE',
            'Reviewed Source Admission was not found.'
          );
        if (
          String((locked.rows[0] as Row).admission_fingerprint_sha256) !==
          admission.admissionFingerprintSha256
        )
          throw new ReviewedSourceHandoffError(
            'SOURCE_FINGERPRINT_MISMATCH',
            'Reviewed Source Admission fingerprint changed before delivery.'
          );

        const byKey = await client.query(
          `SELECT *
             FROM execution_reviewed_source_handoffs
            WHERE workspace_id=$1 AND delivery_idempotency_key=$2
            FOR UPDATE`,
          [admission.workspaceId, idempotencyKey]
        );
        if (
          byKey.rowCount &&
          String((byKey.rows[0] as Row).reviewed_source_admission_id) !==
            admission.reviewedSourceAdmissionId
        )
          throw new ReviewedSourceHandoffError(
            'IDEMPOTENCY_CONFLICT',
            'Delivery idempotency key is already bound to another Reviewed Source Admission.'
          );

        const existing = await client.query(
          `SELECT *
             FROM execution_reviewed_source_handoffs
            WHERE workspace_id=$1 AND reviewed_source_admission_id=$2
            FOR UPDATE`,
          [admission.workspaceId, admission.reviewedSourceAdmissionId]
        );
        if (existing.rowCount) {
          const row = existing.rows[0] as Row;
          if (
            String(row.delivery_idempotency_key) !== idempotencyKey ||
            String(row.delivery_request_fingerprint) !== requestFingerprint ||
            String(row.markreg_idempotency_key) !== markRegIdempotencyKey
          )
            throw new ReviewedSourceHandoffError(
              'VERSION_CONFLICT',
              'The Reviewed Source Admission already has different handoff semantics.'
            );
          if (String(row.status) === 'DELIVERED') {
            const record = this.mapDelivery(row);
            return { record, replay: clone(record.response!) };
          }
          await client.query(
            `UPDATE execution_reviewed_source_handoffs
                SET attempt_count=attempt_count+1,last_attempt_at=$3,last_error_code=NULL
              WHERE workspace_id=$1 AND reviewed_source_admission_id=$2`,
            [admission.workspaceId, admission.reviewedSourceAdmissionId, attemptedAt]
          );
          await this.insertDeliveryAudit(
            client,
            admission,
            'HANDOFF_RETRY_RECORDED',
            requestFingerprint,
            attemptedAt,
            { attempt: Number(row.attempt_count) + 1 }
          );
          const next = await client.query(
            `SELECT * FROM execution_reviewed_source_handoffs
              WHERE workspace_id=$1 AND reviewed_source_admission_id=$2`,
            [admission.workspaceId, admission.reviewedSourceAdmissionId]
          );
          return { record: this.mapDelivery(next.rows[0] as Row) };
        }

        await client.query(
          `INSERT INTO execution_reviewed_source_handoffs(
             reviewed_source_admission_id,workspace_id,delivery_idempotency_key,
             delivery_request_fingerprint,markreg_idempotency_key,status,attempt_count,last_attempt_at
           ) VALUES($1,$2,$3,$4,$5,'PENDING',1,$6)`,
          [
            admission.reviewedSourceAdmissionId,
            admission.workspaceId,
            idempotencyKey,
            requestFingerprint,
            markRegIdempotencyKey,
            attemptedAt
          ]
        );
        await this.insertDeliveryAudit(
          client,
          admission,
          'HANDOFF_ATTEMPTED',
          requestFingerprint,
          attemptedAt,
          { attempt: 1 }
        );
        return {
          record: {
            workspaceId: admission.workspaceId,
            reviewedSourceAdmissionId: admission.reviewedSourceAdmissionId,
            deliveryIdempotencyKey: idempotencyKey,
            deliveryRequestFingerprint: requestFingerprint,
            markRegIdempotencyKey,
            status: 'PENDING' as const,
            attemptCount: 1,
            lastAttemptAt: attemptedAt
          }
        };
      });
    } catch (cause) {
      if (cause instanceof ReviewedSourceHandoffError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async markDeliveryFailed(
    admission: ReviewedSourceAdmissionEnvelope,
    requestFingerprint: string,
    errorCode: string,
    failedAt: string
  ) {
    try {
      await this.database.transact(async (client) => {
        const result = await client.query(
          `UPDATE execution_reviewed_source_handoffs
              SET last_error_code=$4,last_attempt_at=$5
            WHERE workspace_id=$1 AND reviewed_source_admission_id=$2
              AND delivery_request_fingerprint=$3 AND status='PENDING'
          RETURNING reviewed_source_admission_id`,
          [
            admission.workspaceId,
            admission.reviewedSourceAdmissionId,
            requestFingerprint,
            cleanText(errorCode, 'errorCode', 200),
            failedAt
          ]
        );
        if (!result.rowCount) return;
        await this.insertDeliveryAudit(
          client,
          admission,
          'HANDOFF_RETRY_RECORDED',
          requestFingerprint,
          failedAt,
          { errorCode }
        );
      });
    } catch (cause) {
      if (cause instanceof ReviewedSourceHandoffError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async markDelivered(
    admission: ReviewedSourceAdmissionEnvelope,
    requestFingerprint: string,
    result: ReviewedSourceProjectionResult,
    deliveredAt: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const current = await client.query(
          `SELECT * FROM execution_reviewed_source_handoffs
            WHERE workspace_id=$1 AND reviewed_source_admission_id=$2
            FOR UPDATE`,
          [admission.workspaceId, admission.reviewedSourceAdmissionId]
        );
        if (!current.rowCount)
          throw new ReviewedSourceHandoffError(
            'STALE_SOURCE',
            'Reviewed Source handoff state was not found.'
          );
        const row = current.rows[0] as Row;
        if (String(row.delivery_request_fingerprint) !== requestFingerprint)
          throw new ReviewedSourceHandoffError(
            'VERSION_CONFLICT',
            'Reviewed Source handoff request fingerprint changed before completion.'
          );
        if (String(row.status) === 'DELIVERED') return this.mapDelivery(row);
        const updated = await client.query(
          `UPDATE execution_reviewed_source_handoffs
              SET status='DELIVERED',last_error_code=NULL,last_attempt_at=$3,delivered_at=$3,response_record=$4::jsonb
            WHERE workspace_id=$1 AND reviewed_source_admission_id=$2
          RETURNING *`,
          [
            admission.workspaceId,
            admission.reviewedSourceAdmissionId,
            deliveredAt,
            JSON.stringify(result)
          ]
        );
        await this.insertDeliveryAudit(
          client,
          admission,
          'HANDOFF_DELIVERED',
          requestFingerprint,
          deliveredAt,
          {
            lifecycleEvent: {
              id: result.event.lifecycleEventId,
              version: result.event.version
            },
            currentLifecycleView: {
              id: result.currentView.lifecycleViewId,
              version: result.currentView.version
            }
          }
        );
        return this.mapDelivery(updated.rows[0] as Row);
      });
    } catch (cause) {
      if (cause instanceof ReviewedSourceHandoffError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async getDelivery(workspaceId: string, reviewedSourceAdmissionId: ReviewedSourceAdmissionId) {
    try {
      const result = await this.query.query(
        `SELECT * FROM execution_reviewed_source_handoffs
          WHERE workspace_id=$1 AND reviewed_source_admission_id=$2`,
        [workspaceId, reviewedSourceAdmissionId]
      );
      return result.rowCount ? this.mapDelivery(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async insertAdmissionCommand(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    requestFingerprint: string,
    admission: ReviewedSourceAdmissionEnvelope,
    createdAt: string
  ) {
    await client.query(
      `INSERT INTO execution_reviewed_source_admission_commands(
         workspace_id,idempotency_key,request_fingerprint,reviewed_source_admission_id,response_record,created_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
      [
        workspaceId,
        idempotencyKey,
        requestFingerprint,
        admission.reviewedSourceAdmissionId,
        JSON.stringify(admission),
        createdAt
      ]
    );
  }

  private async insertDeliveryAudit(
    client: QueryClient,
    admission: ReviewedSourceAdmissionEnvelope,
    action: 'HANDOFF_ATTEMPTED' | 'HANDOFF_RETRY_RECORDED' | 'HANDOFF_DELIVERED',
    requestFingerprint: string,
    createdAt: string,
    details: Readonly<Record<string, unknown>>
  ) {
    await client.query(
      `INSERT INTO execution_reviewed_source_handoff_audit(
         workspace_id,reviewed_source_admission_id,action,actor_id,source_fingerprint,details,created_at
       ) VALUES($1,$2,$3,'service_reviewed_source_handoff',$4,$5::jsonb,$6)`,
      [
        admission.workspaceId,
        admission.reviewedSourceAdmissionId,
        action,
        requestFingerprint,
        JSON.stringify(details),
        createdAt
      ]
    );
  }

  private mapDelivery(row: Row): ReviewedSourceHandoffRecord {
    return {
      workspaceId: String(row.workspace_id),
      reviewedSourceAdmissionId: String(
        row.reviewed_source_admission_id
      ) as ReviewedSourceAdmissionId,
      deliveryIdempotencyKey: String(row.delivery_idempotency_key),
      deliveryRequestFingerprint: String(row.delivery_request_fingerprint),
      markRegIdempotencyKey: String(row.markreg_idempotency_key),
      status: String(row.status) as ReviewedSourceHandoffStatus,
      attemptCount: Number(row.attempt_count),
      lastAttemptAt: new Date(row.last_attempt_at as string).toISOString(),
      ...(row.last_error_code ? { lastErrorCode: String(row.last_error_code) } : {}),
      ...(row.delivered_at
        ? { deliveredAt: new Date(row.delivered_at as string).toISOString() }
        : {}),
      ...(row.response_record
        ? { response: clone(row.response_record as ReviewedSourceProjectionResult) }
        : {})
    };
  }

  private unavailable(cause: unknown) {
    if (cause instanceof ReviewedSourceHandoffError) return cause;
    return new ReviewedSourceHandoffError(
      'PERSISTENCE_UNAVAILABLE',
      'Execution Reviewed Source handoff persistence is unavailable.',
      503,
      true,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}

export class ReviewedSourceAdmissionService {
  readonly consequences: EvidenceLifecycleAuthorityConsequences =
    reviewedSourceAdmissionAuthorityConsequences;

  constructor(
    private readonly repository: ReviewedSourceAdmissionRepository,
    private readonly evidenceReview: ExecutionEvidenceReviewRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly admissionIdFactory: () => ReviewedSourceAdmissionId = () =>
      `reviewed-source-admission_${randomUUID()}`
  ) {}

  async admit(
    command: Readonly<AdmitReviewedSourceCommand>,
    principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>
  ) {
    const workspaceId = this.requirePrincipal(principal);
    const commandWorkspaceId = cleanWorkspaceId(command.workspaceId);
    this.assertWorkspace(commandWorkspaceId, workspaceId);
    const decisionVersion = exactVersion(
      command.expectedEvidenceReviewDecisionVersion,
      'expectedEvidenceReviewDecisionVersion'
    );
    if (typeof decisionVersion !== 'number')
      throw new ReviewedSourceHandoffError(
        'INVALID_INPUT',
        'expectedEvidenceReviewDecisionVersion must be a positive integer.',
        422,
        false
      );
    const decisionFingerprint = exactSha256(
      command.expectedEvidenceReviewDecisionFingerprintSha256,
      'expectedEvidenceReviewDecisionFingerprintSha256'
    );
    const formalMatterVersion = exactVersion(
      command.expectedFormalMatterVersion,
      'expectedFormalMatterVersion'
    );
    const admittedEvidenceReferences = normalizeReferences(command.admittedEvidenceReferences);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200) as MarkOrbitId;
    const requestFingerprint = reviewedSourceHandoffFingerprint({
      command: 'ADMIT_REVIEWED_SOURCE',
      workspaceId,
      evidenceReviewDecisionId: command.evidenceReviewDecisionId,
      expectedEvidenceReviewDecisionVersion: decisionVersion,
      expectedEvidenceReviewDecisionFingerprintSha256: decisionFingerprint,
      formalMatterId: command.formalMatterId,
      expectedFormalMatterVersion: formalMatterVersion,
      admittedEvidenceReferences,
      correlationId,
      reviewerPrincipalId: principal.userId
    });
    const replay = await this.repository.findAdmissionReplay(workspaceId, idempotencyKey);
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new ReviewedSourceHandoffError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different Reviewed Source Admission payload.'
        );
      return replay.admission;
    }

    const decision = await this.evidenceReview.findDecisionById(command.evidenceReviewDecisionId);
    if (!decision)
      throw new ReviewedSourceHandoffError(
        'REVIEW_DECISION_NOT_ADMISSIBLE',
        'Evidence Review Decision was not found.'
      );
    this.assertWorkspace(decision.workspaceId, workspaceId);
    if (decision.outcome !== 'ADMITTED_FOR_INTERNAL_USE')
      throw new ReviewedSourceHandoffError(
        'REVIEW_DECISION_NOT_ADMISSIBLE',
        'Only ADMITTED_FOR_INTERNAL_USE review decisions may be admitted downstream.'
      );
    if (Number(decision.version) !== decisionVersion)
      throw new ReviewedSourceHandoffError(
        'SOURCE_VERSION_MISMATCH',
        'Exact Evidence Review Decision version is required.'
      );
    if (decision.decisionFingerprintSha256 !== decisionFingerprint)
      throw new ReviewedSourceHandoffError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Evidence Review Decision fingerprint does not match the exact reviewed source.'
      );
    if (decision.correlationId !== correlationId || decision.source.correlationId !== correlationId)
      throw new ReviewedSourceHandoffError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the exact Evidence Review Decision.'
      );
    if (
      await this.evidenceReview.hasNewerReceipt(
        decision.source.providerReturn.id,
        Number(decision.source.providerReturn.version)
      )
    )
      throw new ReviewedSourceHandoffError(
        'STALE_SOURCE',
        'A newer Provider Return evidence receipt supersedes this reviewed source.'
      );

    const admittedAt = exactTimestamp(this.now(), 'admittedAt');
    const unsigned: Omit<ReviewedSourceAdmissionEnvelope, 'admissionFingerprintSha256'> = {
      schemaVersion: 1,
      reviewedSourceAdmissionId: this.admissionIdFactory(),
      workspaceId,
      version: 1,
      formalMatter: {
        id: command.formalMatterId,
        version: formalMatterVersion
      },
      reviewDecision: {
        id: decision.evidenceReviewDecisionId,
        version: decision.version
      },
      reviewDecisionFingerprintSha256: decision.decisionFingerprintSha256,
      evidenceSource: clone(decision.source),
      admittedEvidenceReferences,
      admittedAt,
      correlationId
    };
    const admission: ReviewedSourceAdmissionEnvelope = {
      ...unsigned,
      admissionFingerprintSha256: reviewedSourceHandoffFingerprint(unsigned)
    };
    return this.repository.recordAdmission(
      admission,
      principal.userId,
      idempotencyKey,
      requestFingerprint
    );
  }

  getAdmission(workspaceId: string, reviewedSourceAdmissionId: ReviewedSourceAdmissionId) {
    return this.repository.findAdmission(cleanWorkspaceId(workspaceId), reviewedSourceAdmissionId);
  }

  private requirePrincipal(principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>) {
    const workspaceId = cleanWorkspaceId(principal.workspaceId, 'principal.workspaceId');
    if (!principal.permissions.includes('review:perform'))
      throw new ReviewedSourceHandoffError(
        'PERMISSION_DENIED',
        'review:perform permission is required.',
        403,
        false
      );
    return workspaceId;
  }

  private assertWorkspace(actual: string, expected: string) {
    if (actual !== expected)
      throw new ReviewedSourceHandoffError(
        'PERMISSION_DENIED',
        'Reviewed Source belongs to another Workspace.',
        403,
        false
      );
  }
}

export class ReviewedSourceHandoffService {
  constructor(
    private readonly repository: ReviewedSourceAdmissionRepository,
    private readonly markReg: MarkRegLifecycleProjectionClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async deliver(command: Readonly<DeliverReviewedSourceCommand>) {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const admissionVersion = exactVersion(
      command.expectedReviewedSourceAdmissionVersion,
      'expectedReviewedSourceAdmissionVersion'
    );
    if (typeof admissionVersion !== 'number')
      throw new ReviewedSourceHandoffError(
        'INVALID_INPUT',
        'expectedReviewedSourceAdmissionVersion must be a positive integer.',
        422,
        false
      );
    const admissionFingerprint = exactSha256(
      command.expectedAdmissionFingerprintSha256,
      'expectedAdmissionFingerprintSha256'
    );
    const formalMatterVersion = exactVersion(
      command.expectedFormalMatterVersion,
      'expectedFormalMatterVersion'
    );
    const state = command.state;
    const eventCode = cleanText(command.eventCode, 'eventCode', 200);
    const customerSafeLabel = cleanText(command.customerSafeLabel, 'customerSafeLabel', 300);
    const customerSafeSummary = cleanText(command.customerSafeSummary, 'customerSafeSummary', 2000);
    const occurredAt = exactTimestamp(command.occurredAt, 'occurredAt');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = cleanText(command.correlationId, 'correlationId', 200) as MarkOrbitId;

    const admission = await this.repository.findAdmission(
      workspaceId,
      command.reviewedSourceAdmissionId
    );
    if (!admission)
      throw new ReviewedSourceHandoffError('STALE_SOURCE', 'Reviewed Source Admission was not found.');
    if (admission.version !== admissionVersion)
      throw new ReviewedSourceHandoffError(
        'SOURCE_VERSION_MISMATCH',
        'Exact Reviewed Source Admission version is required.'
      );
    if (admission.admissionFingerprintSha256 !== admissionFingerprint)
      throw new ReviewedSourceHandoffError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Reviewed Source Admission fingerprint does not match the exact admitted source.'
      );
    if (
      admission.formalMatter.id !== command.formalMatterId ||
      !sameVersion(admission.formalMatter.version, formalMatterVersion)
    )
      throw new ReviewedSourceHandoffError(
        'SOURCE_VERSION_MISMATCH',
        'Reviewed Source Admission does not bind the requested exact Formal Matter.'
      );
    if (admission.correlationId !== correlationId)
      throw new ReviewedSourceHandoffError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the exact Reviewed Source Admission.'
      );

    const normalized = {
      command: 'DELIVER_REVIEWED_SOURCE_TO_MARKREG',
      workspaceId,
      reviewedSourceAdmissionId: admission.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: admissionVersion,
      expectedAdmissionFingerprintSha256: admissionFingerprint,
      formalMatterId: command.formalMatterId,
      expectedFormalMatterVersion: formalMatterVersion,
      state,
      eventCode,
      customerSafeLabel,
      customerSafeSummary,
      occurredAt,
      correlationId
    } as const;
    const requestFingerprint = reviewedSourceHandoffFingerprint(normalized);
    const markRegIdempotencyKey = `wp05-reviewed-source:${admission.reviewedSourceAdmissionId}:v${admission.version}`;
    const attemptedAt = exactTimestamp(this.now(), 'attemptedAt');
    const prepared = await this.repository.prepareDelivery(
      admission,
      idempotencyKey,
      requestFingerprint,
      markRegIdempotencyKey,
      attemptedAt
    );
    if (prepared.replay) return prepared.replay;

    const projectCommand: ProjectLifecycleEventCommand = {
      workspaceId,
      reviewedSourceAdmissionId: admission.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: admission.version,
      expectedAdmissionFingerprintSha256: admission.admissionFingerprintSha256,
      formalMatterId: admission.formalMatter.id,
      expectedFormalMatterVersion: admission.formalMatter.version,
      state,
      eventCode,
      customerSafeLabel,
      customerSafeSummary,
      occurredAt,
      idempotencyKey: markRegIdempotencyKey,
      correlationId
    };

    let result: ReviewedSourceProjectionResult;
    try {
      result = await this.markReg.project(projectCommand);
    } catch (cause) {
      const error =
        cause instanceof ReviewedSourceHandoffError
          ? cause
          : new ReviewedSourceHandoffError(
              'DEPENDENCY_UNAVAILABLE',
              'MarkReg lifecycle projection transport is unavailable.',
              503,
              true,
              { cause: cause instanceof Error ? cause.message : String(cause) }
            );
      await this.repository.markDeliveryFailed(
        admission,
        requestFingerprint,
        error.code,
        exactTimestamp(this.now(), 'failedAt')
      );
      throw error;
    }

    const delivered = await this.repository.markDelivered(
      admission,
      requestFingerprint,
      result,
      exactTimestamp(this.now(), 'deliveredAt')
    );
    return clone(delivered.response!);
  }

  getDelivery(workspaceId: string, reviewedSourceAdmissionId: ReviewedSourceAdmissionId) {
    return this.repository.getDelivery(cleanWorkspaceId(workspaceId), reviewedSourceAdmissionId);
  }
}

export function reviewedSourceAdmissionConsequences(): Readonly<EvidenceLifecycleAuthorityConsequences> {
  return reviewedSourceAdmissionAuthorityConsequences;
}
