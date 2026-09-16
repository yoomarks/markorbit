import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { BusinessAttributionLinkV1 } from '@markorbit/contracts/business-attribution';
import { noBusinessAttributionAuthorityConsequencesV1 } from '@markorbit/contracts/business-attribution';
import {
  noCommunicationLinkAuthorityConsequencesV1,
  type CommunicationLinkV1
} from '@markorbit/contracts/communication-link';
import { noOutboundContactReadinessAuthorityConsequencesV1 } from '@markorbit/contracts/outbound-contact-policy';
import {
  noPartnerCandidateAuthorityConsequencesV1,
  noPartnerQualificationAuthorityConsequencesV1,
  partnerCandidateFingerprintSha256V1,
  partnerQualificationFingerprintSha256V1,
  type PartnerCandidateV1,
  type PartnerQualificationDecisionV1
} from '@markorbit/contracts/partner-intelligence';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  type WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import {
  HttpCorePartnerKnowledgeSourceReader,
  PartnerIntelligenceService,
  partnerReviewedSendFingerprintSha256V1,
  type PartnerCandidateStore
} from '../src/partner-intelligence.js';
import type { CreateBusinessAttributionLinkCommand } from '../src/business-attribution.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const observedAt = '2026-09-16T00:00:00.000Z';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId,
  membershipId: 'membership-1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-17T00:00:00.000Z'
};
const publicRef = {
  owner: 'PUBLIC_SOURCE',
  kind: 'TRADEMARK_REPRESENTATION_RECORD',
  id: 'https://public.example/record/1',
  version: 'v1',
  fingerprintSha256: 'a'.repeat(64),
  observedAt
};
const knowledgeRef = {
  owner: 'CORE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  id: 'ready-package_partner-1',
  version: 'CORE_ACCEPTED_V1',
  fingerprintSha256: 'b'.repeat(64),
  observedAt
};
const brief = {
  entityKind: 'FIRM' as const,
  displayName: 'Example IP Law',
  jurisdiction: 'US',
  serviceFocus: ['TRADEMARK_PROSECUTION'],
  observedPublicTrademarkWork: ['Representative shown on public record 1.'],
  chinaInternationalRelevance: 'Potential cross-border trademark cooperation.',
  existingWorkspaceHistory: null,
  cooperationHypothesis: 'Mutual referral conversation may be useful.',
  uncertainty: ['Public work does not establish verified capability.'],
  suggestedOutreach: {
    subject: 'Possible trademark cooperation',
    body: 'Would a short introductory conversation be useful?'
  }
};
const candidateWithoutFingerprint = {
  schemaVersion: 1 as const,
  partnerCandidateId: 'partner-candidate_1' as const,
  workspaceId,
  version: 1 as const,
  status: 'OPEN_FOR_HUMAN_QUALIFICATION' as const,
  evidenceRefs: [publicRef, knowledgeRef],
  brief,
  admittedByPrincipalId: principal.userId,
  admittedAt: observedAt,
  authorityConsequences: noPartnerCandidateAuthorityConsequencesV1
};
const candidate: PartnerCandidateV1 = {
  ...candidateWithoutFingerprint,
  partnerCandidateFingerprintSha256: partnerCandidateFingerprintSha256V1(
    candidateWithoutFingerprint
  )
};
const decisionWithoutFingerprint = {
  schemaVersion: 1 as const,
  partnerQualificationDecisionId: 'partner-qualification_1' as const,
  workspaceId,
  version: 1 as const,
  partnerCandidateId: candidate.partnerCandidateId,
  partnerCandidateVersion: 1 as const,
  partnerCandidateFingerprintSha256: candidate.partnerCandidateFingerprintSha256,
  outcome: 'QUALIFIED' as const,
  rationale: 'Human-qualified for one introductory conversation.',
  decidedByPrincipalId: principal.userId,
  decidedAt: observedAt,
  authorityConsequences: noPartnerQualificationAuthorityConsequencesV1
};
const decision: PartnerQualificationDecisionV1 = {
  ...decisionWithoutFingerprint,
  partnerQualificationFingerprintSha256: partnerQualificationFingerprintSha256V1(
    decisionWithoutFingerprint
  )
};
const message = {
  schemaVersion: 1 as const,
  accountRef: 'mailbox-growth',
  channel: 'EMAIL' as const,
  participants: [
    { role: 'SENDER' as const, address: 'growth@markorbit.com' },
    { role: 'TO' as const, address: 'partner@example.com' }
  ],
  subject: brief.suggestedOutreach.subject,
  textBody: brief.suggestedOutreach.body,
  attachments: []
};
const endpointFingerprintSha256 = createHash('sha256').update('partner@example.com').digest('hex');
const directoryEntry: WorkspaceDirectoryEntryV1 = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_partner1',
  workspaceId,
  version: 2,
  entryKind: 'ORGANIZATION',
  displayName: brief.displayName,
  aliases: [],
  status: 'ACTIVE',
  roles: ['COOPERATING_AGENT'],
  contactPoints: [],
  externalIdentityReferences: [],
  provenance: {
    sourceKind: 'WORKSPACE_USER',
    sourceReference: 'human-confirmed-cooperation',
    capturedAt: observedAt
  },
  authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
  createdAt: observedAt,
  updatedAt: observedAt,
  archivedAt: null
};
const communicationLink: CommunicationLinkV1 = {
  schemaVersion: 1,
  communicationLinkId: 'communication-link_partner1',
  workspaceId,
  version: 1,
  source: {
    owner: 'MANAGED_COMMUNICATION',
    scope: 'MESSAGE',
    accountRef: message.accountRef,
    messageId: 'message-response-1',
    threadRef: 'thread-partner-1',
    provider: 'TEST',
    providerMessageId: 'provider-response-1',
    observedAt
  },
  target: {
    targetKind: 'WORKSPACE_DIRECTORY_ENTRY',
    owner: 'LITE',
    workspaceId,
    workspaceDirectoryEntryId: directoryEntry.workspaceDirectoryEntryId,
    version: directoryEntry.version
  },
  decision: {
    status: 'CONFIRMED',
    basis: 'MANUAL',
    authority: 'HUMAN',
    decidedByPrincipalId: principal.userId,
    decidedAt: observedAt,
    reason: 'Confirmed response belongs to this cooperating agent.',
    evidenceReferences: ['human-review-1'],
    decisionFingerprintSha256: '7'.repeat(64)
  },
  lifecycle: 'ACTIVE',
  archivedAt: null,
  authorityConsequences: noCommunicationLinkAuthorityConsequencesV1,
  createdAt: observedAt,
  updatedAt: observedAt
};

function harness(
  readinessOutcome: 'READY_FOR_HUMAN_SEND' | 'BLOCKED' = 'READY_FOR_HUMAN_SEND',
  linkedResponse: CommunicationLinkV1 = communicationLink
) {
  const createCandidate = vi.fn(
    (command: Parameters<PartnerCandidateStore['createCandidate']>[0]) =>
      Promise.resolve({ ...candidate, evidenceRefs: command.evidenceRefs })
  );
  const qualify = vi.fn(() => Promise.resolve(decision));
  const candidates: PartnerCandidateStore = {
    createCandidate,
    qualify,
    findCandidate: vi.fn(() => Promise.resolve(candidate)),
    findQualification: vi.fn(() => Promise.resolve(decision))
  };
  const readiness = {
    schemaVersion: 1 as const,
    workspaceId,
    evaluatedByPrincipalId: principal.userId,
    targetRef: {
      owner: 'LITE',
      kind: 'PARTNER_CANDIDATE',
      id: candidate.partnerCandidateId,
      version: 1
    },
    channel: 'EMAIL' as const,
    endpointFingerprintSha256,
    purpose: 'PARTNER_OUTREACH' as const,
    policyRef: { policyId: 'policy-partner-us', version: 1 },
    reviewedSendFingerprintSha256: partnerReviewedSendFingerprintSha256V1(message),
    outcome: readinessOutcome,
    reason:
      readinessOutcome === 'READY_FOR_HUMAN_SEND'
        ? ('CURRENT_ALLOWED_ASSERTION' as const)
        : ('ACTIVE_SUPPRESSION' as const),
    suppressionRefs: [],
    evaluatedAt: observedAt,
    readinessFingerprintSha256: 'c'.repeat(64),
    authorityConsequences: noOutboundContactReadinessAuthorityConsequencesV1
  };
  const evaluate = vi.fn(() => Promise.resolve(readiness));
  const receipt = {
    schemaVersion: 1 as const,
    sendId: 'send-partner-1',
    workspaceId,
    accountRef: message.accountRef,
    idempotencyKeySha256: 'd'.repeat(64),
    requestFingerprintSha256: 'e'.repeat(64),
    state: 'SENT' as const,
    messageId: 'message-partner-1',
    threadRef: 'thread-partner-1',
    provider: 'TEST',
    providerMessageId: 'provider-message-1',
    providerReceiptRef: 'receipt-1',
    acceptedAt: observedAt,
    authority: {
      externalMessageSent: true as const,
      customerTruthMutated: false as const,
      matterTruthMutated: false as const,
      legalTruthCreated: false as const,
      knowledgeApproved: false as const,
      professionalDecisionCreated: false as const
    }
  };
  const send = vi.fn(() => Promise.resolve(receipt));
  const attribution: BusinessAttributionLinkV1 = {
    schemaVersion: 1,
    businessAttributionLinkId: 'business-attribution_partner1',
    workspaceId,
    version: 1,
    motionKind: 'PARTNER_DEVELOPMENT',
    sourceRefs: candidate.evidenceRefs,
    touchpointRefs: [],
    downstreamRef: {
      owner: 'MARKREG',
      kind: 'FORMAL_MATTER',
      id: 'formal-matter_1',
      version: 1,
      fingerprintSha256: 'f'.repeat(64),
      observedAt
    },
    attributionState: 'ATTRIBUTED',
    evidenceBasis: 'HUMAN_CONFIRMED',
    evaluatedAt: observedAt,
    recordedByPrincipalId: principal.userId,
    businessAttributionFingerprintSha256: '1'.repeat(64),
    authorityConsequences: noBusinessAttributionAuthorityConsequencesV1
  };
  const createAttribution = vi.fn((command: Readonly<CreateBusinessAttributionLinkCommand>) => {
    void command;
    return Promise.resolve(attribution);
  });
  return {
    service: new PartnerIntelligenceService(
      { resolve: vi.fn(() => Promise.resolve(knowledgeRef)) },
      candidates,
      { evaluate },
      { send },
      { getLatest: vi.fn(() => Promise.resolve(directoryEntry)) },
      { getLatest: vi.fn(() => Promise.resolve(linkedResponse)) },
      { create: createAttribution }
    ),
    createCandidate,
    qualify,
    evaluate,
    send,
    createAttribution
  };
}

const exactCandidate = {
  id: candidate.partnerCandidateId,
  version: 1 as const,
  fingerprintSha256: candidate.partnerCandidateFingerprintSha256
};
const exactDecision = {
  id: decision.partnerQualificationDecisionId,
  version: 1 as const,
  fingerprintSha256: decision.partnerQualificationFingerprintSha256
};

describe('Partner Intelligence G3 orchestration', () => {
  it('re-reads exact accepted Knowledge evidence from the Core owner boundary', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            source: {
              schemaVersion: 1,
              owner: 'CORE',
              kind: 'KNOWLEDGE_READY_PACKAGE',
              sourceId: knowledgeRef.id,
              sourceVersion: knowledgeRef.version,
              sourceFingerprintSha256: knowledgeRef.fingerprintSha256,
              observedAt
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const reader = new HttpCorePartnerKnowledgeSourceReader(
      'http://core.test',
      'partner-intelligence-core-secret-123456789',
      fetcher
    );
    await expect(reader.resolve(workspaceId, knowledgeRef.id)).resolves.toEqual(knowledgeRef);
    expect(fetcher).toHaveBeenCalledWith(
      `http://core.test/internal/knowledge/ready-packages/${knowledgeRef.id}/product-loop-source`,
      {
        headers: {
          'x-markorbit-internal-authorization': 'partner-intelligence-core-secret-123456789',
          'x-markorbit-workspace-id': workspaceId
        }
      }
    );
  });

  it('admits only a bounded public-evidence candidate with a current accepted Knowledge source', async () => {
    const h = harness();
    const result = await h.service.admit({
      principal,
      knowledgeReadyPackageId: knowledgeRef.id,
      publicEvidenceRefs: [publicRef],
      brief,
      idempotencyKey: 'admit-1'
    });
    expect(result.evidenceRefs).toEqual([publicRef, knowledgeRef]);
    expect(h.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ admittedByPrincipalId: principal.userId })
    );
    expect(result.authorityConsequences.providerCreated).toBe(false);
  });

  it('requires exact HUMAN qualification, JIT partner readiness and explicit send confirmation', async () => {
    const h = harness();
    const result = await h.service.sendOutreach({
      principal,
      candidate: exactCandidate,
      qualificationDecision: exactDecision,
      endpointFingerprintSha256,
      policyRef: { policyId: 'policy-partner-us', version: 1 },
      reviewedSendFingerprintSha256: partnerReviewedSendFingerprintSha256V1(message),
      confirmation: { confirmed: true, acknowledgedEffect: 'SEND_EXTERNAL_PARTNER_EMAIL' },
      message,
      idempotencyKey: 'send-1'
    });
    expect(h.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'PARTNER_OUTREACH' })
    );
    expect(h.send).toHaveBeenCalledOnce();
    expect(result.responseState).toBe('NOT_OBSERVED');
    expect(result.cooperationOutcomeState).toBe('UNKNOWN');
    expect(result.authorityConsequences.providerCreated).toBe(false);
  });

  it('fails closed when partner outreach is suppressed', async () => {
    const h = harness('BLOCKED');
    await expect(
      h.service.sendOutreach({
        principal,
        candidate: exactCandidate,
        qualificationDecision: exactDecision,
        endpointFingerprintSha256,
        policyRef: { policyId: 'policy-partner-us', version: 1 },
        reviewedSendFingerprintSha256: partnerReviewedSendFingerprintSha256V1(message),
        confirmation: { confirmed: true, acknowledgedEffect: 'SEND_EXTERNAL_PARTNER_EMAIL' },
        message,
        idempotencyKey: 'send-blocked'
      })
    ).rejects.toMatchObject({ code: 'POLICY_NOT_READY' });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('links an observed response, current Directory cooperation context and exact MarkReg outcome without MGSN promotion', async () => {
    const h = harness();
    const downstreamRef = {
      owner: 'MARKREG',
      kind: 'FORMAL_MATTER',
      id: 'formal-matter_1',
      version: 1,
      fingerprintSha256: '8'.repeat(64),
      observedAt
    };
    const result = await h.service.recordOutcome({
      principal,
      candidate: exactCandidate,
      qualificationDecision: exactDecision,
      directoryEntry: {
        id: directoryEntry.workspaceDirectoryEntryId,
        version: directoryEntry.version
      },
      communicationLink: {
        id: communicationLink.communicationLinkId,
        version: communicationLink.version
      },
      downstreamRef,
      confirmation: { confirmed: true, acknowledgedEffect: 'LINK_PARTNER_COOPERATION_OUTCOME' },
      idempotencyKey: 'outcome-1'
    });
    expect(result.motionKind).toBe('PARTNER_DEVELOPMENT');
    const attributionCommand = h.createAttribution.mock.calls[0]![0];
    expect(attributionCommand).toMatchObject({
      attributionState: 'ATTRIBUTED',
      evidenceBasis: 'HUMAN_CONFIRMED',
      downstreamRef
    });
    expect(attributionCommand.touchpointRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: 'MANAGED_COMMUNICATION',
          kind: 'MESSAGE',
          id: communicationLink.source.messageId
        }),
        expect.objectContaining({
          owner: 'LITE',
          kind: 'COMMUNICATION_LINK',
          id: communicationLink.communicationLinkId
        })
      ])
    );
    expect(result.authorityConsequences.providerAppointed).toBe(false);
  });

  it('fails closed when the Communication Link does not target the exact current Directory entry', async () => {
    const h = harness('READY_FOR_HUMAN_SEND', {
      ...communicationLink,
      target: { ...communicationLink.target, version: directoryEntry.version - 1 }
    });
    await expect(
      h.service.recordOutcome({
        principal,
        candidate: exactCandidate,
        qualificationDecision: exactDecision,
        directoryEntry: {
          id: directoryEntry.workspaceDirectoryEntryId,
          version: directoryEntry.version
        },
        communicationLink: {
          id: communicationLink.communicationLinkId,
          version: communicationLink.version
        },
        downstreamRef: {
          owner: 'MARKREG',
          kind: 'FORMAL_MATTER',
          id: 'formal-matter_1',
          version: 1,
          fingerprintSha256: '8'.repeat(64),
          observedAt
        },
        confirmation: { confirmed: true, acknowledgedEffect: 'LINK_PARTNER_COOPERATION_OUTCOME' },
        idempotencyKey: 'outcome-stale-link'
      })
    ).rejects.toMatchObject({ code: 'COOPERATION_CONTEXT_NOT_CURRENT' });
    expect(h.createAttribution).not.toHaveBeenCalled();
  });
});
