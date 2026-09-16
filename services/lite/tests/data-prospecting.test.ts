import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  noApplicantDiscoveryAuthorityConsequencesV1,
  type ApplicantPortfolioEnvelopeV1,
  type DataEngineApplicantCandidateReferenceV1,
  type DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import { DATA_ENGINE_DISCOVERY_CONTRACT_VERSION } from '@markorbit/contracts/data-engine-discovery';
import {
  noOutboundContactReadinessAuthorityConsequencesV1,
  type OutboundContactReadinessV1
} from '@markorbit/contracts/outbound-contact-policy';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision
} from '@markorbit/contracts/product-loop';
import {
  DataProspectingService,
  dataProspectingReviewedSendFingerprintSha256V1,
  type DataProspectingCandidateWriter
} from '../src/data-prospecting.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const observedAt = '2026-09-15T01:00:00.000Z';
const sourceSha = `sha256:${'a'.repeat(64)}`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId,
  membershipId: 'membership-1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-16T00:00:00.000Z'
};
const applicant: DataEngineApplicantCandidateReferenceV1 = {
  applicant_candidate_id: 'applicant-1',
  source_reference: {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'US',
    source_kind: 'APPLICANT_IDENTITY',
    source_id: 'applicant-source-1',
    source_version: 'snapshot-1',
    source_fingerprint_sha256: sourceSha,
    observed_at: observedAt
  }
};
const trademark: DataEngineDiscoveredTrademarkCandidateV1 = {
  candidate_type: APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  trademark_candidate_id: 'trademark-1',
  applicant,
  jurisdiction: 'US',
  mark_text: 'ORBIT',
  application_number: '99123456',
  registration_number: null,
  classes: [9],
  source_reference: {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'US',
    source_kind: 'TRADEMARK_RECORD',
    source_id: 'trademark-source-1',
    source_version: 'snapshot-1',
    source_fingerprint_sha256: sourceSha,
    observed_at: observedAt
  },
  official_truth_verified: false,
  legal_conclusion_created: false,
  workspace_relationship_established: false
};

function envelope(
  result: DataEngineDiscoveredTrademarkCandidateV1 = trademark
): ApplicantPortfolioEnvelopeV1 {
  const requestContext = { requester_workspace_id: workspaceId, request_id: 'owner-read' };
  const query = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    request_context: requestContext,
    applicant,
    ordering: ['trademark_candidate_id ASC'] as const,
    ranking_authority: 'NONE' as const,
    limits: { page_size: 1, max_results: 500 as const },
    query_hash: sourceSha
  };
  const snapshot = { source_version: 'snapshot-1', observed_at: observedAt };
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'engine-1',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'US',
    resource_kind: APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload: {
      query,
      source_snapshot: snapshot,
      results: [result],
      next_cursor: null,
      provenance: {
        query_hash: sourceSha,
        request_context: requestContext,
        source_snapshot: snapshot,
        engine_version: 'engine-1',
        result_count: 1,
        has_more: false,
        query
      },
      authority_consequences: noApplicantDiscoveryAuthorityConsequencesV1
    }
  };
}

const source = {
  schemaVersion: 1 as const,
  owner: 'DATA_ENGINE' as const,
  kind: 'DATA_ENGINE_APPLICANT_DISCOVERY' as const,
  sourceId: trademark.source_reference.source_id,
  sourceVersion: 'snapshot-1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt
};
const candidate: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: 'opportunity-candidate_g1',
  workspaceId,
  version: 2,
  kind: 'TRADEMARK_SERVICE',
  title: 'US trademark application 99123456',
  serviceNeedSummary: 'Human-reviewed prospect signal.',
  sources: [source],
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: 'b'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: observedAt,
  updatedAt: observedAt
};
const decision: OpportunityQualificationDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_g1',
  workspaceId,
  version: 1,
  candidate: { id: candidate.opportunityCandidateId, version: 1 },
  expectedCandidateFingerprintSha256: 'c'.repeat(64),
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: principal.userId,
  rationale: 'Human review found a bounded service conversation appropriate.',
  decidedAt: observedAt,
  formalOpportunityCreated: false,
  customerContacted: false
};
const message = {
  schemaVersion: 1 as const,
  accountRef: 'mailbox-growth',
  channel: 'EMAIL' as const,
  participants: [
    { role: 'SENDER' as const, address: 'growth@markorbit.com' },
    { role: 'TO' as const, address: 'prospect@example.com' }
  ],
  subject: 'Trademark application support',
  textBody: 'Would a short conversation about your observed application be useful?',
  attachments: []
};
const endpointFingerprintSha256 = createHash('sha256').update('prospect@example.com').digest('hex');

function harness(
  readinessOutcome: OutboundContactReadinessV1['outcome'] = 'READY_FOR_HUMAN_SEND',
  ownerEnvelope: ApplicantPortfolioEnvelopeV1 = envelope()
) {
  const createCandidateFromVerifiedSources = vi.fn(
    (
      command: Parameters<DataProspectingCandidateWriter['createCandidateFromVerifiedSources']>[0]
    ) =>
      Promise.resolve({
        ...candidate,
        version: 1,
        status: 'OPEN',
        sources: command.sources
      } as OpportunityCandidate)
  );
  const candidates: DataProspectingCandidateWriter = {
    createCandidateFromVerifiedSources,
    findLatestCandidate: vi.fn(() => Promise.resolve(candidate)),
    findQualificationDecision: vi.fn(() => Promise.resolve(decision))
  };
  const readiness: OutboundContactReadinessV1 = {
    schemaVersion: 1,
    workspaceId,
    evaluatedByPrincipalId: principal.userId,
    targetRef: {
      owner: 'LITE',
      kind: 'OPPORTUNITY_CANDIDATE',
      id: candidate.opportunityCandidateId,
      version: 2
    },
    channel: 'EMAIL',
    endpointFingerprintSha256,
    purpose: 'PROSPECT_OUTREACH',
    policyRef: { policyId: 'policy-us-prospect', version: 1 },
    reviewedSendFingerprintSha256: dataProspectingReviewedSendFingerprintSha256V1(message),
    outcome: readinessOutcome,
    reason:
      readinessOutcome === 'READY_FOR_HUMAN_SEND'
        ? 'CURRENT_ALLOWED_ASSERTION'
        : 'NO_CURRENT_ASSERTION',
    suppressionRefs: [],
    evaluatedAt: observedAt,
    readinessFingerprintSha256: 'd'.repeat(64),
    authorityConsequences: noOutboundContactReadinessAuthorityConsequencesV1
  };
  const evaluate = vi.fn(() => Promise.resolve(readiness));
  const receipt = {
    schemaVersion: 1 as const,
    sendId: 'send-g1',
    workspaceId,
    accountRef: message.accountRef,
    idempotencyKeySha256: 'e'.repeat(64),
    requestFingerprintSha256: 'f'.repeat(64),
    state: 'SENT' as const,
    messageId: 'message-g1',
    threadRef: 'thread-g1',
    provider: 'TEST',
    providerMessageId: 'provider-message-g1',
    providerReceiptRef: 'provider-receipt-g1',
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
  return {
    service: new DataProspectingService(
      { readTrademark: vi.fn(() => Promise.resolve(ownerEnvelope)) },
      candidates,
      { evaluate },
      { send }
    ),
    createCandidateFromVerifiedSources,
    evaluate,
    send
  };
}

describe('Data Prospecting G1 orchestration', () => {
  it('admits only one current unregistered-application fact as an OPEN human-review candidate', async () => {
    const { service, createCandidateFromVerifiedSources } = harness();
    const result = await service.admit({
      principal,
      applicant,
      trademark,
      signal: 'UNREGISTERED_TRADEMARK_APPLICATION',
      decision: 'OPEN_FOR_HUMAN_QUALIFICATION',
      idempotencyKey: 'g1-admit'
    });
    expect(result.status).toBe('OPEN');
    expect(createCandidateFromVerifiedSources).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        sources: [source]
      })
    );
    expect(result.formalOpportunityCreated).toBe(false);
    expect(result.customerContacted).toBe(false);
  });

  it('rejects a registered record because it is outside the bounded first dogfood signal', async () => {
    const registered = { ...trademark, registration_number: '7654321' };
    const { service } = harness('READY_FOR_HUMAN_SEND', envelope(registered));
    await expect(
      service.admit({
        principal,
        applicant,
        trademark: registered,
        signal: 'UNREGISTERED_TRADEMARK_APPLICATION',
        decision: 'OPEN_FOR_HUMAN_QUALIFICATION',
        idempotencyKey: 'g1-registered'
      })
    ).rejects.toMatchObject({ code: 'SIGNAL_NOT_ELIGIBLE' });
  });

  it('binds exact qualification, recipient, reviewed content, and current policy before sending', async () => {
    const { service, evaluate, send } = harness();
    const reviewedSendFingerprintSha256 = dataProspectingReviewedSendFingerprintSha256V1(message);
    const result = await service.sendOutreach({
      principal,
      candidate: {
        id: candidate.opportunityCandidateId,
        version: candidate.version,
        fingerprintSha256: candidate.opportunityCandidateFingerprintSha256
      },
      qualificationDecision: {
        id: decision.opportunityQualificationDecisionId,
        version: decision.version
      },
      endpointFingerprintSha256,
      policyRef: { policyId: 'policy-us-prospect', version: 1 },
      reviewedSendFingerprintSha256,
      confirmation: { confirmed: true, acknowledgedEffect: 'SEND_EXTERNAL_PROSPECT_EMAIL' },
      message,
      idempotencyKey: 'g1-send'
    });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'PROSPECT_OUTREACH', reviewedSendFingerprintSha256 })
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.authorityConsequences).toEqual({
      customerCreated: false,
      consentInferred: false,
      formalOpportunityCreated: false,
      externalMessageSent: true
    });
    expect(result.responseState).toBe('NOT_OBSERVED');
    expect(result.downstreamConversionState).toBe('UNKNOWN');
  });

  it('keeps UNKNOWN policy explicit and never calls Managed Communication', async () => {
    const { service, send } = harness('UNKNOWN');
    await expect(
      service.sendOutreach({
        principal,
        candidate: {
          id: candidate.opportunityCandidateId,
          version: candidate.version,
          fingerprintSha256: candidate.opportunityCandidateFingerprintSha256
        },
        qualificationDecision: {
          id: decision.opportunityQualificationDecisionId,
          version: decision.version
        },
        endpointFingerprintSha256,
        policyRef: { policyId: 'policy-us-prospect', version: 1 },
        reviewedSendFingerprintSha256: dataProspectingReviewedSendFingerprintSha256V1(message),
        confirmation: { confirmed: true, acknowledgedEffect: 'SEND_EXTERNAL_PROSPECT_EMAIL' },
        message,
        idempotencyKey: 'g1-unknown'
      })
    ).rejects.toMatchObject({ code: 'POLICY_NOT_READY' });
    expect(send).not.toHaveBeenCalled();
  });
});
