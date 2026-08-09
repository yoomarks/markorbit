import { createHash, randomUUID } from 'node:crypto';
import type {
  EvidenceHandoffId,
  EvidenceHandoffReference,
  HandoffProviderReturnEvidenceCommand,
  ProviderReturn
} from '@markorbit/contracts/provider-execution';
import {
  evidenceHandoffAuthorityConsequences,
  type ProviderExecutionAuthorityConsequences
} from '@markorbit/contracts/provider-execution';
import type {
  ExecutionReleaseRepository,
  FilingExecutionTaskDraftRepository
} from './filing-authorization.js';

export type ProviderEvidenceReviewStatus = 'PENDING_REVIEW';

export interface ExecutionProviderReturnEvidenceReceipt {
  schemaVersion: 1;
  evidenceHandoff: Readonly<EvidenceHandoffReference>;
  providerId: ProviderReturn['providerId'];
  providerWorkspaceId: string;
  providerActorId: string;
  workStatusClaim: string;
  artifacts: ProviderReturn['artifacts'];
  assertions: ProviderReturn['assertions'];
  reviewStatus: ProviderEvidenceReviewStatus;
  authorityConsequences: Readonly<ProviderExecutionAuthorityConsequences>;
  receivedAt: string;
}

export interface ExecutionProviderReturnEvidenceReplay {
  requestFingerprint: string;
  receipt: ExecutionProviderReturnEvidenceReceipt;
}

export interface ExecutionProviderReturnEvidenceRepository {
  findReplay(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<ExecutionProviderReturnEvidenceReplay | undefined>;
  findReceipt(
    evidenceHandoffId: EvidenceHandoffId
  ): Promise<ExecutionProviderReturnEvidenceReceipt | undefined>;
  findReceiptForProviderReturn(
    providerReturnId: ProviderReturn['providerReturnId'],
    providerReturnVersion: number
  ): Promise<ExecutionProviderReturnEvidenceReceipt | undefined>;
  saveReceipt(
    receipt: ExecutionProviderReturnEvidenceReceipt,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ExecutionProviderReturnEvidenceReceipt>;
}

export class ProviderReturnEvidenceError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'PERMISSION_DENIED'
      | 'IDEMPOTENCY_CONFLICT'
      | 'SOURCE_VERSION_MISMATCH'
      | 'SOURCE_FINGERPRINT_MISMATCH'
      | 'STALE_SOURCE'
      | 'RETURN_SUPERSEDED'
      | 'PERSISTENCE_UNAVAILABLE',
    message: string,
    public readonly status = 409,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ProviderReturnEvidenceError';
  }
}

export interface ProviderReturnEvidenceEnvelope {
  command: Readonly<HandoffProviderReturnEvidenceCommand>;
  providerReturn: Readonly<ProviderReturn & { providerActorId: string }>;
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

function cleanText(value: string, field: string) {
  const cleaned = value.trim();
  if (!cleaned)
    throw new ProviderReturnEvidenceError('INVALID_INPUT', `${field} is required.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string) {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new ProviderReturnEvidenceError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function exactSha256(value: string) {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new ProviderReturnEvidenceError(
      'INVALID_INPUT',
      'expectedProviderReturnFingerprintSha256 must be a lowercase SHA-256 fingerprint.',
      422
    );
  return cleaned;
}

export class ProviderReturnEvidenceService {
  constructor(
    private readonly repository: ExecutionProviderReturnEvidenceRepository,
    private readonly releases: ExecutionReleaseRepository,
    private readonly taskDrafts: FilingExecutionTaskDraftRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly evidenceHandoffIdFactory: () => EvidenceHandoffId = () =>
      `evidence-handoff_${randomUUID()}`
  ) {}

  async handoffProviderReturnEvidence(
    input: ProviderReturnEvidenceEnvelope
  ): Promise<EvidenceHandoffReference> {
    const workspaceId = cleanWorkspaceId(input.command.workspaceId);
    const idempotencyKey = cleanText(input.command.idempotencyKey, 'idempotencyKey');
    const expectedFingerprint = exactSha256(input.command.expectedProviderReturnFingerprintSha256);
    const providerReturn = input.providerReturn;
    const requestFingerprint = fingerprint({
      command: 'HANDOFF_PROVIDER_RETURN_EVIDENCE',
      workspaceId,
      providerReturnId: input.command.providerReturnId,
      expectedProviderReturnVersion: input.command.expectedProviderReturnVersion,
      expectedFingerprint,
      executionReleaseId: input.command.executionReleaseId,
      expectedExecutionReleaseVersion: input.command.expectedExecutionReleaseVersion,
      filingExecutionTaskDraftId: input.command.filingExecutionTaskDraftId,
      expectedFilingExecutionTaskDraftVersion:
        input.command.expectedFilingExecutionTaskDraftVersion,
      correlationId: input.command.correlationId
    });
    const replay = await this.repository.findReplay(workspaceId, idempotencyKey);
    if (replay) {
      if (replay.requestFingerprint !== requestFingerprint)
        throw new ProviderReturnEvidenceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has a different evidence handoff payload.',
          409
        );
      return replay.receipt.evidenceHandoff;
    }

    if (providerReturn.workspaceId !== workspaceId)
      throw new ProviderReturnEvidenceError(
        'PERMISSION_DENIED',
        'Provider Return belongs to another Workspace.',
        403
      );
    if (
      providerReturn.providerReturnId !== input.command.providerReturnId ||
      providerReturn.version !== input.command.expectedProviderReturnVersion ||
      providerReturn.status !== 'CURRENT'
    )
      throw new ProviderReturnEvidenceError(
        'RETURN_SUPERSEDED',
        'Execution only accepts the exact current Provider Return version.',
        409
      );
    if (providerReturn.returnFingerprintSha256 !== expectedFingerprint)
      throw new ProviderReturnEvidenceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Provider Return fingerprint does not match the exact handoff request.',
        409
      );
    if (providerReturn.correlationId !== input.command.correlationId)
      throw new ProviderReturnEvidenceError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Provider Return.',
        409
      );

    const release = await this.releases.findById(input.command.executionReleaseId);
    if (!release)
      throw new ProviderReturnEvidenceError(
        'STALE_SOURCE',
        'Execution Release was not found.',
        409
      );
    if (
      release.version !== input.command.expectedExecutionReleaseVersion ||
      release.status !== 'RELEASED_FOR_EXECUTION'
    )
      throw new ProviderReturnEvidenceError(
        'STALE_SOURCE',
        'Execution Release is not the exact released source.',
        409
      );

    const task = await this.taskDrafts.findById(input.command.filingExecutionTaskDraftId);
    if (!task)
      throw new ProviderReturnEvidenceError(
        'STALE_SOURCE',
        'Filing Execution Task Draft was not found.',
        409
      );
    if (
      task.executionReleaseId !== release.executionReleaseId ||
      task.status !== 'PREPARED' ||
      String(input.command.expectedFilingExecutionTaskDraftVersion) !== '1'
    )
      throw new ProviderReturnEvidenceError(
        'SOURCE_VERSION_MISMATCH',
        'Filing Execution Task Draft is not the exact prepared source version.',
        409
      );

    const receivedAt = this.now();
    const evidenceHandoff: EvidenceHandoffReference = {
      schemaVersion: 1,
      evidenceHandoffId: this.evidenceHandoffIdFactory(),
      workspaceId,
      providerReturn: { id: providerReturn.providerReturnId, version: providerReturn.version },
      providerReturnFingerprintSha256: providerReturn.returnFingerprintSha256,
      executionRelease: { id: release.executionReleaseId, version: release.version },
      filingExecutionTaskDraft: {
        id: task.filingExecutionTaskDraftId,
        version: input.command.expectedFilingExecutionTaskDraftVersion
      },
      correlationId: input.command.correlationId,
      handedOffAt: receivedAt
    };
    const receipt: ExecutionProviderReturnEvidenceReceipt = {
      schemaVersion: 1,
      evidenceHandoff,
      providerId: providerReturn.providerId,
      providerWorkspaceId: providerReturn.providerWorkspaceId,
      providerActorId: providerReturn.providerActorId,
      workStatusClaim: providerReturn.workStatusClaim,
      artifacts: providerReturn.artifacts,
      assertions: providerReturn.assertions,
      reviewStatus: 'PENDING_REVIEW',
      authorityConsequences: evidenceHandoffAuthorityConsequences,
      receivedAt
    };
    const saved = await this.repository.saveReceipt(receipt, idempotencyKey, requestFingerprint);
    return saved.evidenceHandoff;
  }

  getReceipt(evidenceHandoffId: EvidenceHandoffId) {
    return this.repository.findReceipt(evidenceHandoffId);
  }
}
