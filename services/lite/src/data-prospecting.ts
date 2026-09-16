import { createHash } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  DataEngineApplicantCandidateReferenceV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import type { ManagedCommunicationParticipantV1 } from '@markorbit/contracts/managed-communication';
import type {
  OutboundContactPolicyReferenceV1,
  OutboundContactReadinessV1
} from '@markorbit/contracts/outbound-contact-policy';
import type {
  OpportunityCandidate,
  OpportunityCandidateId,
  OpportunityQualificationDecision,
  ProductLoopSourceReference
} from '@markorbit/contracts/product-loop';
import type {
  ManagedCommunicationClientNotificationSendRequestV1,
  ManagedCommunicationClientNotificationSendReceiptV1,
  ManagedCommunicationClientNotificationSender
} from './client-notification-handoff.js';
import type { CreateVerifiedOpportunityCandidateCommand } from './candidate-qualification.js';
import {
  DiscoveredTrademarkAdmissionError,
  type ExactDiscoveredTrademarkReader
} from './discovered-trademark-admission.js';
import type { EvaluateOutboundContactReadinessCommand } from './outbound-contact-policy.js';

export type DataProspectingErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_INPUT'
  | 'SOURCE_NOT_CURRENT'
  | 'SIGNAL_NOT_ELIGIBLE'
  | 'CANDIDATE_NOT_QUALIFIED'
  | 'POLICY_NOT_READY'
  | 'RECONCILIATION_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE';

export class DataProspectingError extends Error {
  constructor(
    readonly code: DataProspectingErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DataProspectingError';
  }
}

export interface DataProspectingCandidateWriter {
  createCandidateFromVerifiedSources(
    command: Readonly<CreateVerifiedOpportunityCandidateCommand>
  ): Promise<OpportunityCandidate>;
  findLatestCandidate(
    workspaceId: string,
    id: OpportunityCandidateId
  ): Promise<OpportunityCandidate | undefined>;
  findQualificationDecision(
    workspaceId: string,
    id: OpportunityCandidateId
  ): Promise<OpportunityQualificationDecision | undefined>;
}

export interface DataProspectingPolicyEvaluator {
  evaluate(
    command: Readonly<EvaluateOutboundContactReadinessCommand>
  ): Promise<OutboundContactReadinessV1>;
}

export interface AdmitDataProspectingCandidateCommand {
  principal: Readonly<WorkspacePrincipal>;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  trademark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>;
  signal: 'UNREGISTERED_TRADEMARK_APPLICATION';
  decision: 'OPEN_FOR_HUMAN_QUALIFICATION';
  idempotencyKey: string;
}

export interface SendDataProspectingOutreachCommand {
  principal: Readonly<WorkspacePrincipal>;
  candidate: Readonly<{ id: OpportunityCandidateId; version: number; fingerprintSha256: string }>;
  qualificationDecision: Readonly<{ id: string; version: number }>;
  endpointFingerprintSha256: string;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  reviewedSendFingerprintSha256: string;
  confirmation: Readonly<{ confirmed: true; acknowledgedEffect: 'SEND_EXTERNAL_PROSPECT_EMAIL' }>;
  message: Readonly<ManagedCommunicationClientNotificationSendRequestV1>;
  idempotencyKey: string;
}

export interface DataProspectingOutreachResultV1 {
  schemaVersion: 1;
  candidate: Readonly<{ id: OpportunityCandidateId; version: number }>;
  qualificationDecision: Readonly<{ id: string; version: number }>;
  readiness: Readonly<OutboundContactReadinessV1>;
  sendReceipt: Readonly<ManagedCommunicationClientNotificationSendReceiptV1>;
  responseState: 'NOT_OBSERVED';
  downstreamConversionState: 'UNKNOWN';
  authorityConsequences: Readonly<{
    customerCreated: false;
    consentInferred: false;
    formalOpportunityCreated: false;
    externalMessageSent: true;
  }>;
}

const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stable(item)])
        )
      : value;

const digest = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');

export function dataProspectingReviewedSendFingerprintSha256V1(
  message: Readonly<ManagedCommunicationClientNotificationSendRequestV1>
): string {
  return digest(message);
}

function exactDataEngineSource(
  trademark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>
): ProductLoopSourceReference {
  return {
    schemaVersion: 1,
    owner: 'DATA_ENGINE',
    kind: 'DATA_ENGINE_APPLICANT_DISCOVERY',
    sourceId: trademark.source_reference.source_id,
    sourceVersion: trademark.source_reference.source_version,
    sourceFingerprintSha256: trademark.source_reference.source_fingerprint_sha256.slice(
      'sha256:'.length
    ),
    observedAt: trademark.source_reference.observed_at
  };
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireManager(principal: Readonly<WorkspacePrincipal>): void {
  if (principal.kind !== 'WORKSPACE' || !principal.permissions.includes('matter:manage'))
    throw new DataProspectingError(
      'PERMISSION_DENIED',
      'matter:manage permission is required.',
      403
    );
}

export class DataProspectingService {
  constructor(
    private readonly ownerReader: ExactDiscoveredTrademarkReader,
    private readonly candidates: DataProspectingCandidateWriter,
    private readonly policy: DataProspectingPolicyEvaluator,
    private readonly sender: ManagedCommunicationClientNotificationSender
  ) {}

  async admit(
    command: Readonly<AdmitDataProspectingCandidateCommand>
  ): Promise<OpportunityCandidate> {
    requireManager(command.principal);
    if (
      command.signal !== 'UNREGISTERED_TRADEMARK_APPLICATION' ||
      command.decision !== 'OPEN_FOR_HUMAN_QUALIFICATION'
    )
      throw new DataProspectingError(
        'INVALID_INPUT',
        'The bounded G1 signal and explicit review decision are required.',
        422
      );
    let envelope;
    try {
      envelope = await this.ownerReader.readTrademark({
        requestContext: {
          requester_workspace_id: command.principal.workspaceId,
          request_id: `data-prospecting-${digest(command.idempotencyKey)}`
        },
        applicant: command.applicant,
        trademark: {
          trademark_candidate_id: command.trademark.trademark_candidate_id,
          source_reference: command.trademark.source_reference
        }
      });
    } catch (cause) {
      if (
        cause instanceof DiscoveredTrademarkAdmissionError &&
        cause.code === 'OWNER_READ_NOT_CURRENT'
      )
        throw new DataProspectingError(
          'SOURCE_NOT_CURRENT',
          'The exact Data Engine prospect signal is not current.'
        );
      throw new DataProspectingError(
        'DEPENDENCY_UNAVAILABLE',
        'Data Engine exact owner read is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const current = envelope.fact_state === 'observed' ? envelope.payload?.results[0] : undefined;
    if (!current || envelope.payload?.results.length !== 1 || !same(current, command.trademark))
      throw new DataProspectingError(
        'SOURCE_NOT_CURRENT',
        'The exact Data Engine prospect signal is not current.'
      );
    if (!current.application_number || current.registration_number !== null)
      throw new DataProspectingError(
        'SIGNAL_NOT_ELIGIBLE',
        'G1 admits only an observed application without a registration number for human qualification.',
        422
      );
    return this.candidates.createCandidateFromVerifiedSources({
      workspaceId: command.principal.workspaceId,
      title: `${current.jurisdiction} trademark application ${current.application_number}`,
      serviceNeedSummary: `Data Engine observed application ${current.application_number} with no registration number in the current source record. This is a prospecting signal for human review, not a legal conclusion or verified service need.`,
      sources: [exactDataEngineSource(current)],
      idempotencyKey: command.idempotencyKey
    });
  }

  async sendOutreach(
    command: Readonly<SendDataProspectingOutreachCommand>
  ): Promise<DataProspectingOutreachResultV1> {
    requireManager(command.principal);
    if (
      !command.confirmation.confirmed ||
      command.confirmation.acknowledgedEffect !== 'SEND_EXTERNAL_PROSPECT_EMAIL'
    )
      throw new DataProspectingError(
        'INVALID_INPUT',
        'Explicit human send confirmation is required.',
        422
      );
    let candidate: OpportunityCandidate | undefined;
    let decision: OpportunityQualificationDecision | undefined;
    try {
      [candidate, decision] = await Promise.all([
        this.candidates.findLatestCandidate(command.principal.workspaceId, command.candidate.id),
        this.candidates.findQualificationDecision(
          command.principal.workspaceId,
          command.candidate.id
        )
      ]);
    } catch (cause) {
      throw new DataProspectingError(
        'DEPENDENCY_UNAVAILABLE',
        'Opportunity Candidate evidence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (
      !candidate ||
      !decision ||
      candidate.version !== command.candidate.version ||
      candidate.opportunityCandidateFingerprintSha256 !== command.candidate.fingerprintSha256 ||
      decision.opportunityQualificationDecisionId !== command.qualificationDecision.id ||
      decision.version !== command.qualificationDecision.version ||
      decision.outcome !== 'QUALIFIED_FOR_MARKREG' ||
      candidate.status !== 'DISPOSITIONED' ||
      !candidate.sources.some(
        (source) =>
          source.owner === 'DATA_ENGINE' && source.kind === 'DATA_ENGINE_APPLICANT_DISCOVERY'
      )
    )
      throw new DataProspectingError(
        'CANDIDATE_NOT_QUALIFIED',
        'Exact human-qualified Data Prospecting evidence is required.',
        422
      );

    const participantInput: unknown = command.message.participants;
    if (
      command.message.schemaVersion !== 1 ||
      command.message.channel !== 'EMAIL' ||
      !Array.isArray(participantInput)
    )
      throw new DataProspectingError('INVALID_INPUT', 'A bounded EMAIL message is required.', 422);
    const participants = participantInput as readonly Readonly<ManagedCommunicationParticipantV1>[];
    const to = participants.filter((participant) => participant.role === 'TO');
    if (
      to.length !== 1 ||
      createHash('sha256').update(to[0]!.address.trim().toLowerCase()).digest('hex') !==
        command.endpointFingerprintSha256
    )
      throw new DataProspectingError(
        'INVALID_INPUT',
        'The recipient endpoint does not match its opaque fingerprint.',
        422
      );
    const reviewed = dataProspectingReviewedSendFingerprintSha256V1(command.message);
    if (reviewed !== command.reviewedSendFingerprintSha256)
      throw new DataProspectingError(
        'INVALID_INPUT',
        'The reviewed outreach fingerprint does not match the exact message.',
        422
      );

    if (
      !command.policyRef.policyId.trim() ||
      !Number.isSafeInteger(command.policyRef.version) ||
      command.policyRef.version < 1
    )
      throw new DataProspectingError(
        'INVALID_INPUT',
        'An exact policy reference is required.',
        422
      );

    const targetRef = {
      owner: 'LITE',
      kind: 'OPPORTUNITY_CANDIDATE',
      id: candidate.opportunityCandidateId,
      version: candidate.version
    } as const;
    let readiness: OutboundContactReadinessV1;
    try {
      readiness = await this.policy.evaluate({
        workspaceId: command.principal.workspaceId,
        actorPrincipalId: command.principal.userId,
        targetRef,
        endpointFingerprintSha256: command.endpointFingerprintSha256,
        purpose: 'PROSPECT_OUTREACH',
        policyRef: command.policyRef,
        reviewedSendFingerprintSha256: reviewed
      });
    } catch (cause) {
      throw new DataProspectingError(
        'DEPENDENCY_UNAVAILABLE',
        'Outbound contact policy evaluation is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (
      readiness.workspaceId !== command.principal.workspaceId ||
      readiness.evaluatedByPrincipalId !== command.principal.userId ||
      !same(readiness.targetRef, targetRef) ||
      readiness.endpointFingerprintSha256 !== command.endpointFingerprintSha256 ||
      readiness.purpose !== 'PROSPECT_OUTREACH' ||
      !same(readiness.policyRef, command.policyRef) ||
      readiness.reviewedSendFingerprintSha256 !== reviewed ||
      Object.values(readiness.authorityConsequences).some((value) => value !== false)
    )
      throw new DataProspectingError(
        'DEPENDENCY_UNAVAILABLE',
        'Outbound contact policy returned mismatched readiness evidence.',
        503
      );
    if (readiness.outcome !== 'READY_FOR_HUMAN_SEND')
      throw new DataProspectingError(
        'POLICY_NOT_READY',
        `Outbound contact policy is ${readiness.outcome}: ${readiness.reason}.`,
        422
      );

    let sendReceipt: Readonly<ManagedCommunicationClientNotificationSendReceiptV1>;
    try {
      sendReceipt = await this.sender.send({
        workspaceId: command.principal.workspaceId,
        idempotencyKey: `data-prospecting:${candidate.opportunityCandidateId}:${command.idempotencyKey}`,
        correlationId: `data-prospecting:${candidate.opportunityCandidateId}`,
        request: command.message
      });
    } catch (cause) {
      const code =
        cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
      if (code === 'RECONCILIATION_REQUIRED' || code === 'SEND_IN_PROGRESS')
        throw new DataProspectingError(
          'RECONCILIATION_REQUIRED',
          'Managed Communication send requires reconciliation before retry.',
          409,
          { cause: cause instanceof Error ? cause : undefined }
        );
      if (code === 'IDEMPOTENCY_CONFLICT')
        throw new DataProspectingError(
          'IDEMPOTENCY_CONFLICT',
          'The stable outreach send identity conflicts with an earlier request.',
          409,
          { cause: cause instanceof Error ? cause : undefined }
        );
      throw new DataProspectingError(
        'DEPENDENCY_UNAVAILABLE',
        'Managed Communication send owner is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    return {
      schemaVersion: 1,
      candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
      qualificationDecision: {
        id: decision.opportunityQualificationDecisionId,
        version: decision.version
      },
      readiness,
      sendReceipt,
      responseState: 'NOT_OBSERVED',
      downstreamConversionState: 'UNKNOWN',
      authorityConsequences: {
        customerCreated: false,
        consentInferred: false,
        formalOpportunityCreated: false,
        externalMessageSent: true
      }
    };
  }
}
