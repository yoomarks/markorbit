import type {
  OpportunityCandidate,
  OpportunityQualificationDecision,
  OpportunityQualificationOutcome
} from '@markorbit/contracts/product-loop';
import type { OpportunityCandidateClient } from '../../api/opportunity-candidates.js';

const observedAt = '2026-08-31T08:00:00.000Z';

export const candidateFixture: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: 'opportunity-candidate_fixture-414',
  workspaceId: 'workspace-story',
  version: 3,
  kind: 'TRADEMARK_SERVICE',
  customerId: 'customer_opaque-414',
  title: 'Review a possible trademark monitoring service need',
  serviceNeedSummary:
    'A durable source observation may warrant human review; it does not establish customer demand.',
  sources: [
    {
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'TRADEMARK_CONTEXT',
      sourceId: 'knowledge-source_fixture-414',
      sourceVersion: 7,
      sourceFingerprintSha256: 'a'.repeat(64),
      observedAt
    }
  ],
  status: 'UNDER_REVIEW',
  opportunityCandidateFingerprintSha256: 'b'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: observedAt,
  updatedAt: '2026-08-31T09:00:00.000Z'
};

export function qualificationFixture(
  outcome: OpportunityQualificationOutcome,
  candidateVersion: number = candidateFixture.version
): OpportunityQualificationDecision {
  return {
    schemaVersion: 1,
    opportunityQualificationDecisionId: `opportunity-qualification_fixture-${outcome.toLowerCase()}`,
    workspaceId: candidateFixture.workspaceId,
    version: 1,
    candidate: { id: candidateFixture.opportunityCandidateId, version: candidateVersion },
    expectedCandidateFingerprintSha256:
      candidateVersion === candidateFixture.version ? 'b'.repeat(64) : 'c'.repeat(64),
    outcome,
    decidedByPrincipalId: 'principal_reviewer-414',
    rationale: 'Human reviewer recorded this bounded qualification rationale.',
    decidedAt: '2026-08-31T10:00:00.000Z',
    formalOpportunityCreated: false,
    customerContacted: false
  };
}

export function fixtureCandidateClient(
  decision: OpportunityQualificationDecision | null = null,
  items: readonly OpportunityCandidate[] = [candidateFixture]
): OpportunityCandidateClient {
  return {
    list: () => Promise.resolve({ items, nextCursor: null }),
    load: () => Promise.resolve(candidateFixture),
    loadQualification: () => Promise.resolve(decision)
  };
}
