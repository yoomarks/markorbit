import { createHash } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  BusinessAttributionLinkV1,
  BusinessAttributionReferenceV1
} from '@markorbit/contracts/business-attribution';
import type {
  CommunicationLinkId,
  CommunicationLinkV1
} from '@markorbit/contracts/communication-link';
import type {
  OutboundContactPolicyReferenceV1,
  OutboundContactReadinessV1
} from '@markorbit/contracts/outbound-contact-policy';
import type {
  PartnerBriefV1,
  PartnerCandidateIdV1,
  PartnerCandidateV1,
  PartnerQualificationDecisionV1
} from '@markorbit/contracts/partner-intelligence';
import type {
  WorkspaceDirectoryEntryId,
  WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import type { CreateBusinessAttributionLinkCommand } from './business-attribution.js';
import type {
  ManagedCommunicationClientNotificationSendReceiptV1,
  ManagedCommunicationClientNotificationSendRequestV1,
  ManagedCommunicationClientNotificationSender
} from './client-notification-handoff.js';
import type { EvaluateOutboundContactReadinessCommand } from './outbound-contact-policy.js';
import type {
  CreatePartnerCandidateCommand,
  QualifyPartnerCandidateCommand
} from './partner-intelligence-store.js';

export type PartnerIntelligenceErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_INPUT'
  | 'SOURCE_NOT_CURRENT'
  | 'CANDIDATE_NOT_QUALIFIED'
  | 'POLICY_NOT_READY'
  | 'COOPERATION_CONTEXT_NOT_CURRENT'
  | 'RECONCILIATION_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE';

export class PartnerIntelligenceError extends Error {
  constructor(
    readonly code: PartnerIntelligenceErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PartnerIntelligenceError';
  }
}

export interface PartnerKnowledgeSourceReader {
  resolve(workspaceId: string, readyPackageId: string): Promise<BusinessAttributionReferenceV1>;
}
export interface PartnerCandidateStore {
  createCandidate(command: Readonly<CreatePartnerCandidateCommand>): Promise<PartnerCandidateV1>;
  qualify(
    command: Readonly<QualifyPartnerCandidateCommand>
  ): Promise<PartnerQualificationDecisionV1>;
  findCandidate(
    workspaceId: string,
    id: PartnerCandidateIdV1
  ): Promise<PartnerCandidateV1 | undefined>;
  findQualification(
    workspaceId: string,
    id: PartnerCandidateIdV1
  ): Promise<PartnerQualificationDecisionV1 | undefined>;
}
export interface PartnerPolicyEvaluator {
  evaluate(
    command: Readonly<EvaluateOutboundContactReadinessCommand>
  ): Promise<OutboundContactReadinessV1>;
}
export interface PartnerDirectoryReader {
  getLatest(
    workspaceId: string,
    id: WorkspaceDirectoryEntryId
  ): Promise<WorkspaceDirectoryEntryV1 | undefined>;
}
export interface PartnerCommunicationLinkReader {
  getLatest(workspaceId: string, id: CommunicationLinkId): Promise<CommunicationLinkV1 | undefined>;
}
export interface PartnerAttributionWriter {
  create(
    command: Readonly<CreateBusinessAttributionLinkCommand>
  ): Promise<BusinessAttributionLinkV1>;
}

export interface AdmitPartnerCandidateCommand {
  principal: Readonly<WorkspacePrincipal>;
  knowledgeReadyPackageId: string;
  publicEvidenceRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  brief: Readonly<PartnerBriefV1>;
  idempotencyKey: string;
}
export interface SendPartnerOutreachCommand {
  principal: Readonly<WorkspacePrincipal>;
  candidate: Readonly<{ id: PartnerCandidateIdV1; version: 1; fingerprintSha256: string }>;
  qualificationDecision: Readonly<{ id: string; version: 1; fingerprintSha256: string }>;
  endpointFingerprintSha256: string;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  reviewedSendFingerprintSha256: string;
  confirmation: Readonly<{ confirmed: true; acknowledgedEffect: 'SEND_EXTERNAL_PARTNER_EMAIL' }>;
  message: Readonly<ManagedCommunicationClientNotificationSendRequestV1>;
  idempotencyKey: string;
}
export interface RecordPartnerOutcomeCommand {
  principal: Readonly<WorkspacePrincipal>;
  candidate: Readonly<{ id: PartnerCandidateIdV1; version: 1; fingerprintSha256: string }>;
  qualificationDecision: Readonly<{ id: string; version: 1; fingerprintSha256: string }>;
  directoryEntry: Readonly<{ id: WorkspaceDirectoryEntryId; version: number }>;
  communicationLink: Readonly<{ id: CommunicationLinkId; version: number }>;
  downstreamRef: Readonly<BusinessAttributionReferenceV1>;
  confirmation: Readonly<{
    confirmed: true;
    acknowledgedEffect: 'LINK_PARTNER_COOPERATION_OUTCOME';
  }>;
  idempotencyKey: string;
}

export interface PartnerOutreachResultV1 {
  schemaVersion: 1;
  candidate: Readonly<{ id: PartnerCandidateIdV1; version: 1 }>;
  qualificationDecision: Readonly<{ id: string; version: 1 }>;
  readiness: Readonly<OutboundContactReadinessV1>;
  sendReceipt: Readonly<ManagedCommunicationClientNotificationSendReceiptV1>;
  responseState: 'NOT_OBSERVED';
  cooperationOutcomeState: 'UNKNOWN';
  authorityConsequences: Readonly<{
    providerCreated: false;
    providerCapabilityVerified: false;
    consentInferred: false;
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
const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const manager = (principal: Readonly<WorkspacePrincipal>) => {
  if (principal.kind !== 'WORKSPACE' || !principal.permissions.includes('matter:manage'))
    throw new PartnerIntelligenceError(
      'PERMISSION_DENIED',
      'matter:manage permission is required.',
      403
    );
};
const exactSha = (value: string, field: string) => {
  if (!/^[0-9a-f]{64}$/u.test(value))
    throw new PartnerIntelligenceError('INVALID_INPUT', `${field} must be lowercase SHA-256.`, 422);
  return value;
};

export function partnerReviewedSendFingerprintSha256V1(
  message: Readonly<ManagedCommunicationClientNotificationSendRequestV1>
): string {
  return digest(message);
}

export class HttpCorePartnerKnowledgeSourceReader implements PartnerKnowledgeSourceReader {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async resolve(
    workspaceId: string,
    readyPackageId: string
  ): Promise<BusinessAttributionReferenceV1> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/u, '')}/internal/knowledge/ready-packages/${encodeURIComponent(readyPackageId)}/product-loop-source`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': workspaceId
          }
        }
      );
    } catch (cause) {
      throw new PartnerIntelligenceError(
        'DEPENDENCY_UNAVAILABLE',
        'Core Knowledge source authority is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const payload = (await response.json().catch(() => undefined)) as
      { source?: Record<string, unknown> } | undefined;
    if (response.status === 404)
      throw new PartnerIntelligenceError(
        'SOURCE_NOT_CURRENT',
        'Accepted Knowledge ReadyPackage was not found in this Workspace.',
        404
      );
    if (!response.ok || !payload?.source)
      throw new PartnerIntelligenceError(
        'DEPENDENCY_UNAVAILABLE',
        'Core returned invalid Knowledge source evidence.',
        503
      );
    const source = payload.source;
    if (
      source.schemaVersion !== 1 ||
      source.owner !== 'CORE' ||
      source.kind !== 'KNOWLEDGE_READY_PACKAGE' ||
      source.sourceId !== readyPackageId ||
      !(
        (typeof source.sourceVersion === 'string' && source.sourceVersion.trim()) ||
        (typeof source.sourceVersion === 'number' &&
          Number.isSafeInteger(source.sourceVersion) &&
          source.sourceVersion > 0)
      ) ||
      typeof source.sourceFingerprintSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(source.sourceFingerprintSha256) ||
      typeof source.observedAt !== 'string' ||
      !Number.isFinite(Date.parse(source.observedAt))
    )
      throw new PartnerIntelligenceError(
        'SOURCE_NOT_CURRENT',
        'Core Knowledge source identity does not match the requested ReadyPackage.'
      );
    return {
      owner: 'CORE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      id: readyPackageId,
      version: source.sourceVersion,
      fingerprintSha256: source.sourceFingerprintSha256,
      observedAt: new Date(source.observedAt).toISOString()
    };
  }
}

export class PartnerIntelligenceService {
  constructor(
    private readonly knowledge: PartnerKnowledgeSourceReader,
    private readonly candidates: PartnerCandidateStore,
    private readonly policy: PartnerPolicyEvaluator,
    private readonly sender: ManagedCommunicationClientNotificationSender,
    private readonly directory: PartnerDirectoryReader,
    private readonly communicationLinks: PartnerCommunicationLinkReader,
    private readonly attribution: PartnerAttributionWriter
  ) {}

  async admit(command: Readonly<AdmitPartnerCandidateCommand>): Promise<PartnerCandidateV1> {
    manager(command.principal);
    if (
      !command.publicEvidenceRefs.length ||
      command.publicEvidenceRefs.some((ref) => ref.owner !== 'PUBLIC_SOURCE')
    )
      throw new PartnerIntelligenceError(
        'INVALID_INPUT',
        'At least one bounded PUBLIC_SOURCE evidence reference is required.',
        422
      );
    const knowledge = await this.knowledge.resolve(
      command.principal.workspaceId,
      command.knowledgeReadyPackageId
    );
    return this.candidates.createCandidate({
      workspaceId: command.principal.workspaceId,
      evidenceRefs: [...command.publicEvidenceRefs, knowledge],
      brief: command.brief,
      admittedByPrincipalId: command.principal.userId,
      idempotencyKey: command.idempotencyKey
    });
  }

  async qualify(
    command: Readonly<
      { principal: Readonly<WorkspacePrincipal> } & Omit<
        QualifyPartnerCandidateCommand,
        'workspaceId' | 'decidedByPrincipalId'
      >
    >
  ): Promise<PartnerQualificationDecisionV1> {
    manager(command.principal);
    return this.candidates.qualify({
      workspaceId: command.principal.workspaceId,
      candidate: command.candidate,
      outcome: command.outcome,
      rationale: command.rationale,
      decidedByPrincipalId: command.principal.userId,
      idempotencyKey: command.idempotencyKey
    });
  }

  async sendOutreach(
    command: Readonly<SendPartnerOutreachCommand>
  ): Promise<PartnerOutreachResultV1> {
    manager(command.principal);
    if (
      !command.confirmation.confirmed ||
      command.confirmation.acknowledgedEffect !== 'SEND_EXTERNAL_PARTNER_EMAIL'
    )
      throw new PartnerIntelligenceError(
        'INVALID_INPUT',
        'Explicit human partner-send confirmation is required.',
        422
      );
    const { candidate, decision } = await this.qualified(
      command.principal.workspaceId,
      command.candidate,
      command.qualificationDecision
    );
    const to = command.message.participants.filter((item) => item.role === 'TO');
    if (
      command.message.schemaVersion !== 1 ||
      command.message.channel !== 'EMAIL' ||
      to.length !== 1 ||
      createHash('sha256').update(to[0]!.address.trim().toLowerCase()).digest('hex') !==
        exactSha(command.endpointFingerprintSha256, 'endpointFingerprintSha256')
    )
      throw new PartnerIntelligenceError(
        'INVALID_INPUT',
        'The bounded EMAIL recipient does not match its opaque fingerprint.',
        422
      );
    const reviewed = partnerReviewedSendFingerprintSha256V1(command.message);
    if (
      reviewed !== exactSha(command.reviewedSendFingerprintSha256, 'reviewedSendFingerprintSha256')
    )
      throw new PartnerIntelligenceError(
        'INVALID_INPUT',
        'The reviewed partner outreach fingerprint does not match the exact message.',
        422
      );
    const targetRef = {
      owner: 'LITE',
      kind: 'PARTNER_CANDIDATE',
      id: candidate.partnerCandidateId,
      version: 1
    } as const;
    let readiness: OutboundContactReadinessV1;
    try {
      readiness = await this.policy.evaluate({
        workspaceId: command.principal.workspaceId,
        actorPrincipalId: command.principal.userId,
        targetRef,
        endpointFingerprintSha256: command.endpointFingerprintSha256,
        purpose: 'PARTNER_OUTREACH',
        policyRef: command.policyRef,
        reviewedSendFingerprintSha256: reviewed
      });
    } catch (cause) {
      throw new PartnerIntelligenceError(
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
      readiness.purpose !== 'PARTNER_OUTREACH' ||
      !same(readiness.policyRef, command.policyRef) ||
      readiness.reviewedSendFingerprintSha256 !== reviewed ||
      Object.values(readiness.authorityConsequences).some((value) => value !== false)
    )
      throw new PartnerIntelligenceError(
        'DEPENDENCY_UNAVAILABLE',
        'Outbound contact policy returned mismatched partner readiness evidence.',
        503
      );
    if (readiness.outcome !== 'READY_FOR_HUMAN_SEND')
      throw new PartnerIntelligenceError(
        'POLICY_NOT_READY',
        `Outbound contact policy is ${readiness.outcome}: ${readiness.reason}.`,
        422
      );
    let sendReceipt: Readonly<ManagedCommunicationClientNotificationSendReceiptV1>;
    try {
      sendReceipt = await this.sender.send({
        workspaceId: command.principal.workspaceId,
        idempotencyKey: `partner-intelligence:${candidate.partnerCandidateId}:${command.idempotencyKey}`,
        correlationId: `partner-intelligence:${candidate.partnerCandidateId}`,
        request: command.message
      });
    } catch (cause) {
      const code =
        cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
      if (code === 'RECONCILIATION_REQUIRED' || code === 'SEND_IN_PROGRESS')
        throw new PartnerIntelligenceError(
          'RECONCILIATION_REQUIRED',
          'Managed Communication send requires reconciliation before retry.'
        );
      if (code === 'IDEMPOTENCY_CONFLICT')
        throw new PartnerIntelligenceError(
          'IDEMPOTENCY_CONFLICT',
          'The stable partner send identity conflicts with an earlier request.'
        );
      throw new PartnerIntelligenceError(
        'DEPENDENCY_UNAVAILABLE',
        'Managed Communication send owner is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    return {
      schemaVersion: 1,
      candidate: { id: candidate.partnerCandidateId, version: 1 },
      qualificationDecision: { id: decision.partnerQualificationDecisionId, version: 1 },
      readiness,
      sendReceipt,
      responseState: 'NOT_OBSERVED',
      cooperationOutcomeState: 'UNKNOWN',
      authorityConsequences: {
        providerCreated: false,
        providerCapabilityVerified: false,
        consentInferred: false,
        externalMessageSent: true
      }
    };
  }

  async recordOutcome(
    command: Readonly<RecordPartnerOutcomeCommand>
  ): Promise<BusinessAttributionLinkV1> {
    manager(command.principal);
    if (
      !command.confirmation.confirmed ||
      command.confirmation.acknowledgedEffect !== 'LINK_PARTNER_COOPERATION_OUTCOME'
    )
      throw new PartnerIntelligenceError(
        'INVALID_INPUT',
        'Explicit human cooperation-outcome confirmation is required.',
        422
      );
    const { candidate } = await this.qualified(
      command.principal.workspaceId,
      command.candidate,
      command.qualificationDecision
    );
    let entry: WorkspaceDirectoryEntryV1 | undefined;
    let communicationLink: CommunicationLinkV1 | undefined;
    try {
      [entry, communicationLink] = await Promise.all([
        this.directory.getLatest(command.principal.workspaceId, command.directoryEntry.id),
        this.communicationLinks.getLatest(
          command.principal.workspaceId,
          command.communicationLink.id
        )
      ]);
    } catch (cause) {
      throw new PartnerIntelligenceError(
        'DEPENDENCY_UNAVAILABLE',
        'Partner cooperation evidence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (
      !entry ||
      entry.version !== command.directoryEntry.version ||
      entry.status !== 'ACTIVE' ||
      !entry.roles.some((role) => role === 'COOPERATING_AGENT' || role === 'FOREIGN_COUNSEL')
    )
      throw new PartnerIntelligenceError(
        'COOPERATION_CONTEXT_NOT_CURRENT',
        'A current cooperating-agent or foreign-counsel Directory entry is required.',
        422
      );
    if (
      !communicationLink ||
      communicationLink.version !== command.communicationLink.version ||
      communicationLink.lifecycle !== 'ACTIVE' ||
      communicationLink.decision.status !== 'CONFIRMED' ||
      communicationLink.target.targetKind !== 'WORKSPACE_DIRECTORY_ENTRY' ||
      communicationLink.target.workspaceId !== command.principal.workspaceId ||
      communicationLink.target.workspaceDirectoryEntryId !== entry.workspaceDirectoryEntryId ||
      communicationLink.target.version !== entry.version
    )
      throw new PartnerIntelligenceError(
        'COOPERATION_CONTEXT_NOT_CURRENT',
        'A current human-confirmed Communication Link to the exact Directory entry is required.',
        422
      );
    if (
      command.downstreamRef.owner !== 'MARKREG' ||
      !['FORMAL_MATTER', 'FORMAL_TRADEMARK_SERVICE_OPPORTUNITY', 'INTAKE'].includes(
        command.downstreamRef.kind
      )
    )
      throw new PartnerIntelligenceError(
        'INVALID_INPUT',
        'An exact MarkReg cooperation outcome reference is required.',
        422
      );
    const directoryRef: BusinessAttributionReferenceV1 = {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      id: entry.workspaceDirectoryEntryId,
      version: entry.version,
      fingerprintSha256: digest(entry),
      observedAt: entry.updatedAt
    };
    const responseRef: BusinessAttributionReferenceV1 = {
      owner: 'MANAGED_COMMUNICATION',
      kind: communicationLink.source.scope,
      id:
        communicationLink.source.scope === 'MESSAGE'
          ? communicationLink.source.messageId
          : communicationLink.source.threadRef,
      version: communicationLink.version,
      fingerprintSha256: digest(communicationLink.source),
      observedAt: communicationLink.source.observedAt
    };
    const communicationLinkRef: BusinessAttributionReferenceV1 = {
      owner: 'LITE',
      kind: 'COMMUNICATION_LINK',
      id: communicationLink.communicationLinkId,
      version: communicationLink.version,
      fingerprintSha256: digest(communicationLink),
      observedAt: communicationLink.updatedAt
    };
    return this.attribution.create({
      workspaceId: command.principal.workspaceId,
      actorPrincipalId: command.principal.userId,
      idempotencyKey: `partner-intelligence:${candidate.partnerCandidateId}:${command.idempotencyKey}`,
      motionKind: 'PARTNER_DEVELOPMENT',
      sourceRefs: candidate.evidenceRefs,
      touchpointRefs: [responseRef, communicationLinkRef, directoryRef],
      downstreamRef: command.downstreamRef,
      attributionState: 'ATTRIBUTED',
      evidenceBasis: 'HUMAN_CONFIRMED'
    });
  }

  private async qualified(
    workspaceId: string,
    candidateRef: Readonly<{ id: PartnerCandidateIdV1; version: 1; fingerprintSha256: string }>,
    decisionRef: Readonly<{ id: string; version: 1; fingerprintSha256: string }>
  ) {
    let candidate: PartnerCandidateV1 | undefined;
    let decision: PartnerQualificationDecisionV1 | undefined;
    try {
      [candidate, decision] = await Promise.all([
        this.candidates.findCandidate(workspaceId, candidateRef.id),
        this.candidates.findQualification(workspaceId, candidateRef.id)
      ]);
    } catch (cause) {
      throw new PartnerIntelligenceError(
        'DEPENDENCY_UNAVAILABLE',
        'Partner Candidate evidence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (
      !candidate ||
      !decision ||
      candidate.version !== candidateRef.version ||
      candidate.partnerCandidateFingerprintSha256 !== candidateRef.fingerprintSha256 ||
      decision.partnerQualificationDecisionId !== decisionRef.id ||
      decision.version !== decisionRef.version ||
      decision.partnerQualificationFingerprintSha256 !== decisionRef.fingerprintSha256 ||
      decision.outcome !== 'QUALIFIED'
    )
      throw new PartnerIntelligenceError(
        'CANDIDATE_NOT_QUALIFIED',
        'Exact human-qualified Partner Candidate evidence is required.',
        422
      );
    return { candidate, decision };
  }
}
