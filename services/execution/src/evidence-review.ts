import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import {
  evidenceReviewAuthorityConsequences,
  type EvidenceReviewCorrectionReason,
  type EvidenceReviewDecision,
  type EvidenceReviewDecisionId,
  type EvidenceReviewSource,
  type EvidenceReceiptId,
  type RecordEvidenceReviewDecisionCommand
} from '@markorbit/contracts/evidence-lifecycle';
import type { EvidenceHandoffId, ProviderReturnId } from '@markorbit/contracts/provider-execution';
import type {
  ExecutionProviderReturnEvidenceReceipt,
  ExecutionProviderReturnEvidenceRepository
} from './provider-return-evidence.js';

export type EvidenceCorrectionRequestId = `evidence-correction-request_${string}`;

export interface AuthenticatedEvidenceReviewerPrincipal {
  workspaceId: string;
  userId: MarkOrbitId;
  permissions: readonly string[];
}

export interface ExecutionEvidenceCorrectionRequest {
  schemaVersion: 1;
  correctionRequestId: EvidenceCorrectionRequestId;
  workspaceId: string;
  version: 1;
  evidenceReviewDecisionId: EvidenceReviewDecisionId;
  evidenceReceipt: Readonly<{ id: EvidenceReceiptId; version: number }>;
  providerReturn: Readonly<{ id: ProviderReturnId; version: number }>;
  reasons: ReadonlyArray<Readonly<EvidenceReviewCorrectionReason>>;
  requestedBy: MarkOrbitId;
  status: 'OPEN';
  createdAt: string;
  correlationId: MarkOrbitId;
}

export interface ExecutionEvidenceReviewDecisionRecord extends EvidenceReviewDecision {
  authorityConsequences: typeof evidenceReviewAuthorityConsequences;
  correctionRequest?: Readonly<{ id: EvidenceCorrectionRequestId; version: 1 }>;
}

export interface ExecutionEvidenceReviewReplay {
  requestFingerprint: string;
  decision: ExecutionEvidenceReviewDecisionRecord;
}

export interface ExecutionEvidenceReviewRepository {
  findSourceByReceiptId(evidenceReceiptId: EvidenceReceiptId): Promise<EvidenceReviewSource | undefined>;
  findSourceByHandoffId(evidenceHandoffId: EvidenceHandoffId): Promise<EvidenceReviewSource | undefined>;
  captureSource(
    source: EvidenceReviewSource,
    actorId: MarkOrbitId
  ): Promise<EvidenceReviewSource>;
  hasNewerReceipt(providerReturnId: ProviderReturnId, providerReturnVersion: number): Promise<boolean>;
  findReplay(workspaceId: string, idempotencyKey: string): Promise<ExecutionEvidenceReviewReplay | undefined>;
  findDecisionByReceipt(
    evidenceReceiptId: EvidenceReceiptId
  ): Promise<ExecutionEvidenceReviewDecisionRecord | undefined>;
  findDecisionById(
    evidenceReviewDecisionId: EvidenceReviewDecisionId
  ): Promise<ExecutionEvidenceReviewDecisionRecord | undefined>;
  findCorrectionRequestForDecision(
    evidenceReviewDecisionId: EvidenceReviewDecisionId
  ): Promise<ExecutionEvidenceCorrectionRequest | undefined>;
  recordDecision(
    decision: ExecutionEvidenceReviewDecisionRecord,
    correctionRequest: ExecutionEvidenceCorrectionRequest | undefined,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ExecutionEvidenceReviewDecisionRecord>;
}

export class EvidenceReviewError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'PERMISSION_DENIED'
      | 'STALE_SOURCE'
      | 'SOURCE_VERSION_MISMATCH'
      | 'SOURCE_FINGERPRINT_MISMATCH'
      | 'IDEMPOTENCY_CONFLICT'
      | 'VERSION_CONFLICT'
      | 'PERSISTENCE_UNAVAILABLE',
    message: string,
    public readonly status = 409,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'EvidenceReviewError';
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new EvidenceReviewError('INVALID_INPUT', `${field} is required.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string, field = 'workspaceId'): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new EvidenceReviewError('INVALID_INPUT', `${field} must be a Core Workspace UUID.`, 422);
  return cleaned;
}

function exactSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new EvidenceReviewError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function normalizeCorrectionReasons(
  values: ReadonlyArray<Readonly<EvidenceReviewCorrectionReason>>
): EvidenceReviewCorrectionReason[] {
  return values.map((value, index) => ({
    code: cleanText(value.code, `correctionReasons[${index}].code`),
    message: cleanText(value.message, `correctionReasons[${index}].message`),
    evidenceReferences: value.evidenceReferences.map((reference, evidenceIndex) =>
      cleanText(
        reference,
        `correctionReasons[${index}].evidenceReferences[${evidenceIndex}]`
      )
    )
  }));
}

export class EvidenceReviewService {
  constructor(
    private readonly repository: ExecutionEvidenceReviewRepository,
    private readonly evidenceReceipts: ExecutionProviderReturnEvidenceRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly evidenceReceiptIdFactory: () => EvidenceReceiptId = () =>
      `evidence-receipt_${randomUUID()}`,
    private readonly decisionIdFactory: () => EvidenceReviewDecisionId = () =>
      `evidence-review-decision_${randomUUID()}`,
    private readonly correctionRequestIdFactory: () => EvidenceCorrectionRequestId = () =>
      `evidence-correction-request_${randomUUID()}`
  ) {}

  async captureReviewSource(
    evidenceHandoffId: EvidenceHandoffId,
    principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>
  ): Promise<EvidenceReviewSource> {
    const principalWorkspaceId = this.requirePrincipal(principal, false);
    const existing = await this.repository.findSourceByHandoffId(evidenceHandoffId);
    if (existing) {
      this.assertWorkspace(existing.workspaceId, principalWorkspaceId);
      await this.assertNotSuperseded(existing);
      return existing;
    }

    const receipt = await this.evidenceReceipts.findReceipt(evidenceHandoffId);
    if (!receipt)
      throw new EvidenceReviewError(
        'STALE_SOURCE',
        'Execution evidence receipt was not found.',
        409
      );
    this.assertWorkspace(receipt.evidenceHandoff.workspaceId, principalWorkspaceId);
    if (receipt.reviewStatus !== 'PENDING_REVIEW')
      throw new EvidenceReviewError(
        'STALE_SOURCE',
        'Execution evidence receipt is not reviewable.',
        409
      );

    const source: EvidenceReviewSource = {
      schemaVersion: 1,
      workspaceId: principalWorkspaceId,
      evidenceReceipt: { id: this.evidenceReceiptIdFactory(), version: 1 },
      evidenceReceiptFingerprintSha256: fingerprint(receipt),
      evidenceHandoffId: receipt.evidenceHandoff.evidenceHandoffId,
      providerReturn: {
        id: receipt.evidenceHandoff.providerReturn.id,
        version: Number(receipt.evidenceHandoff.providerReturn.version)
      },
      providerReturnFingerprintSha256: receipt.evidenceHandoff.providerReturnFingerprintSha256,
      providerId: receipt.providerId,
      correlationId: receipt.evidenceHandoff.correlationId,
      capturedAt: this.now()
    };
    await this.assertNotSuperseded(source);
    const captured = await this.repository.captureSource(source, principal.userId);
    await this.assertNotSuperseded(captured);
    return captured;
  }

  async recordDecision(
    command: Readonly<RecordEvidenceReviewDecisionCommand>,
    principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>
  ): Promise<ExecutionEvidenceReviewDecisionRecord> {
    const principalWorkspaceId = this.requirePrincipal(principal, true);
    const commandWorkspaceId = cleanWorkspaceId(command.workspaceId);
    this.assertWorkspace(commandWorkspaceId, principalWorkspaceId);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const rationale = cleanText(command.rationale, 'rationale');
    const expectedFingerprint = exactSha256(
      command.expectedEvidenceReceiptFingerprintSha256,
      'expectedEvidenceReceiptFingerprintSha256'
    );
    if (!Number.isInteger(command.expectedEvidenceReceiptVersion) || command.expectedEvidenceReceiptVersion < 1)
      throw new EvidenceReviewError(
        'INVALID_INPUT',
        'expectedEvidenceReceiptVersion must be a positive integer.',
        422
      );
    const correctionReasons = normalizeCorrectionReasons(command.correctionReasons);
    if (command.outcome === 'CORRECTION_REQUIRED' && correctionReasons.length === 0)
      throw new EvidenceReviewError(
        'INVALID_INPUT',
        'CORRECTION_REQUIRED requires at least one correction reason.',
        422
      );
    if (command.outcome !== 'CORRECTION_REQUIRED' && correctionReasons.length > 0)
      throw new EvidenceReviewError(
        'INVALID_INPUT',
        'Correction reasons are only allowed for CORRECTION_REQUIRED.',
        422
      );

    const requestFingerprint = fingerprint({
      command: 'RECORD_EVIDENCE_REVIEW_DECISION',
      workspaceId: commandWorkspaceId,
      evidenceReceiptId: command.evidenceReceiptId,
      expectedEvidenceReceiptVersion: command.expectedEvidenceReceiptVersion,
      expectedEvidenceReceiptFingerprintSha256: expectedFingerprint,
      outcome: command.outcome,
      rationale,
      correctionReasons,
      reviewerPrincipalId: principal.userId,
      correlationId: command.correlationId
    });
    const replay = await this.repository.findReplay(commandWorkspaceId, idempotencyKey);
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new EvidenceReviewError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different Evidence Review Decision payload.',
          409
        );
      return replay.decision;
    }

    const source = await this.repository.findSourceByReceiptId(command.evidenceReceiptId);
    if (!source)
      throw new EvidenceReviewError('STALE_SOURCE', 'Evidence review source was not found.', 409);
    this.assertWorkspace(source.workspaceId, principalWorkspaceId);
    if (Number(source.evidenceReceipt.version) !== command.expectedEvidenceReceiptVersion)
      throw new EvidenceReviewError(
        'SOURCE_VERSION_MISMATCH',
        'Exact evidence receipt version is required.',
        409
      );
    if (source.evidenceReceiptFingerprintSha256 !== expectedFingerprint)
      throw new EvidenceReviewError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Evidence receipt fingerprint does not match the exact review source.',
        409
      );
    if (source.correlationId !== command.correlationId)
      throw new EvidenceReviewError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the evidence receipt.',
        409
      );
    await this.assertNotSuperseded(source);

    if (await this.repository.findDecisionByReceipt(source.evidenceReceipt.id))
      throw new EvidenceReviewError(
        'VERSION_CONFLICT',
        'An authoritative review decision already exists for this exact evidence receipt.',
        409
      );

    const reviewedAt = this.now();
    const evidenceReviewDecisionId = this.decisionIdFactory();
    const decisionCore: Omit<EvidenceReviewDecision, 'decisionFingerprintSha256'> = {
      schemaVersion: 1,
      evidenceReviewDecisionId,
      workspaceId: principalWorkspaceId,
      version: 1,
      source,
      outcome: command.outcome,
      reviewerPrincipalId: principal.userId,
      rationale,
      correctionReasons,
      reviewedAt,
      correlationId: command.correlationId
    };
    const correctionRequest: ExecutionEvidenceCorrectionRequest | undefined =
      command.outcome === 'CORRECTION_REQUIRED'
        ? {
            schemaVersion: 1,
            correctionRequestId: this.correctionRequestIdFactory(),
            workspaceId: principalWorkspaceId,
            version: 1,
            evidenceReviewDecisionId,
            evidenceReceipt: {
              id: source.evidenceReceipt.id,
              version: Number(source.evidenceReceipt.version)
            },
            providerReturn: {
              id: source.providerReturn.id,
              version: Number(source.providerReturn.version)
            },
            reasons: correctionReasons,
            requestedBy: principal.userId,
            status: 'OPEN',
            createdAt: reviewedAt,
            correlationId: command.correlationId
          }
        : undefined;
    const decision: ExecutionEvidenceReviewDecisionRecord = {
      ...decisionCore,
      decisionFingerprintSha256: fingerprint(decisionCore),
      authorityConsequences: evidenceReviewAuthorityConsequences,
      ...(correctionRequest
        ? { correctionRequest: { id: correctionRequest.correctionRequestId, version: 1 } }
        : {})
    };
    return this.repository.recordDecision(
      decision,
      correctionRequest,
      idempotencyKey,
      requestFingerprint
    );
  }

  async getDecision(
    evidenceReviewDecisionId: EvidenceReviewDecisionId,
    principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>
  ) {
    const workspaceId = this.requirePrincipal(principal, false);
    const decision = await this.repository.findDecisionById(evidenceReviewDecisionId);
    if (!decision) return undefined;
    this.assertWorkspace(decision.workspaceId, workspaceId);
    return decision;
  }

  async getCorrectionRequest(
    evidenceReviewDecisionId: EvidenceReviewDecisionId,
    principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>
  ) {
    const workspaceId = this.requirePrincipal(principal, false);
    const request = await this.repository.findCorrectionRequestForDecision(evidenceReviewDecisionId);
    if (!request) return undefined;
    this.assertWorkspace(request.workspaceId, workspaceId);
    return request;
  }

  private requirePrincipal(
    principal: Readonly<AuthenticatedEvidenceReviewerPrincipal>,
    perform: boolean
  ) {
    const workspaceId = cleanWorkspaceId(principal.workspaceId, 'principal.workspaceId');
    const permission = perform ? 'review:perform' : 'review:read';
    if (!principal.permissions.includes(permission) && !(perform && principal.permissions.includes('review:perform')))
      throw new EvidenceReviewError(
        'PERMISSION_DENIED',
        `${permission} permission is required.`,
        403
      );
    return workspaceId;
  }

  private assertWorkspace(actual: string, expected: string) {
    if (actual !== expected)
      throw new EvidenceReviewError(
        'PERMISSION_DENIED',
        'Evidence review source belongs to another Workspace.',
        403
      );
  }

  private async assertNotSuperseded(source: EvidenceReviewSource) {
    if (
      await this.repository.hasNewerReceipt(
        source.providerReturn.id,
        Number(source.providerReturn.version)
      )
    )
      throw new EvidenceReviewError(
        'STALE_SOURCE',
        'A newer Provider Return evidence receipt supersedes this review source.',
        409
      );
  }
}

export function evidenceReceiptFingerprint(receipt: ExecutionProviderReturnEvidenceReceipt) {
  return fingerprint(receipt);
}
