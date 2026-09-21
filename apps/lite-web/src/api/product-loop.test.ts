import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RelationshipModel } from '@markorbit/contracts';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision,
  PreparedActionJourney,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { createTodayClient } from './product-loop.js';

afterEach(() => vi.unstubAllGlobals());

const workspaceId = '25252525-2525-4252-8252-252525252525';
const candidateId = 'opportunity-candidate_today-1424';
const reviewedFingerprint = 'b'.repeat(64);

const recommendation: TodayRecommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_today-1424',
  workspaceId,
  version: 1,
  kind: 'OPPORTUNITY_REVIEW',
  title: 'Review qualified renewal service need',
  explanation: 'A human qualification is ready for a separate Prepared Action review.',
  sources: [
    {
      schemaVersion: 1,
      owner: 'LITE',
      kind: 'OPPORTUNITY_CANDIDATE',
      sourceId: candidateId,
      sourceVersion: 3,
      sourceFingerprintSha256: reviewedFingerprint,
      observedAt: '2026-09-21T10:00:00.000Z'
    }
  ],
  status: 'OPEN',
  recommendationFingerprintSha256: 'c'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-09-21T10:01:00.000Z',
  updatedAt: '2026-09-21T10:01:00.000Z'
};

const candidate: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: candidateId,
  workspaceId,
  version: 4,
  kind: 'TRADEMARK_SERVICE',
  title: 'Qualified renewal service need',
  serviceNeedSummary: 'Human review found a bounded trademark-service need.',
  sources: recommendation.sources,
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: 'd'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-09-21T09:30:00.000Z',
  updatedAt: '2026-09-21T10:00:30.000Z'
};

const qualification: OpportunityQualificationDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_today-1424',
  workspaceId,
  version: 1,
  candidate: { id: candidateId, version: 3 },
  expectedCandidateFingerprintSha256: reviewedFingerprint,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: '11111111-1111-4111-8111-111111111111',
  rationale: 'Human reviewer confirmed this exact Candidate version for MarkReg review.',
  decidedAt: '2026-09-21T10:00:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
};

const prepared = {
  preparedAction: {
    preparedActionId: 'prepared-action_today-1424'
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

describe('Today qualified Opportunity Review client', () => {
  it('loads current Candidate owner truth while binding qualification to the exact reviewed source version', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(candidate))
      .mockResolvedValueOnce(json(qualification));
    vi.stubGlobal('fetch', fetchMock);

    const evidence = await createTodayClient(workspaceId).loadOpportunityReview(recommendation);

    expect(evidence).toEqual({
      source: recommendation.sources[0],
      candidate,
      qualification
    });
    expect(candidate.version).toBeGreaterThan(qualification.candidate.version);
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get('x-markorbit-workspace-id')).toBe(workspaceId);
      expect(init?.method).toBe('GET');
    }
  });

  it('reloads exact Candidate and Qualification before preparing and POSTs only reviewed owner evidence plus explicit relationship model', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(candidate))
      .mockResolvedValueOnce(json(qualification))
      .mockResolvedValueOnce(json({ csrfToken: 'csrf-today-1424' }))
      .mockResolvedValueOnce(json(prepared, 201));
    vi.stubGlobal('fetch', fetchMock);

    const relationshipModel: RelationshipModel = 'CO_DELIVERY';
    const result = await createTodayClient(workspaceId).prepareQualifiedOpportunity(
      recommendation,
      relationshipModel
    );

    expect(result).toEqual(prepared);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:4000/api/lite/opportunity-candidates/${candidateId}`
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `http://127.0.0.1:4000/api/lite/opportunity-candidates/${candidateId}/qualification`
    );
    expect(fetchMock.mock.calls[2]).toEqual([
      'http://127.0.0.1:4000/api/auth/session',
      { credentials: 'include' }
    ]);

    const [url, init] = fetchMock.mock.calls[3]!;
    expect(url).toBe(
      `http://127.0.0.1:4000/api/lite/today/${recommendation.todayRecommendationId}/prepared-actions`
    );
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    const headers = new Headers(init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-today-1424');
    expect(headers.get('idempotency-key')).toBe(
      `prepare-opportunity:${recommendation.todayRecommendationId}:1:CO_DELIVERY`
    );
    if (typeof init?.body !== 'string') throw new Error('Expected JSON request body');
    expect(JSON.parse(init.body)).toEqual({
      recommendationVersion: 1,
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      plan: {
        kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        candidate: { id: candidateId, version: 3 },
        expectedCandidateFingerprintSha256: reviewedFingerprint,
        qualificationDecision: {
          id: qualification.opportunityQualificationDecisionId,
          version: qualification.version
        },
        relationshipModel: 'CO_DELIVERY'
      }
    });
    expect(init.body).not.toMatch(
      /workspaceId|customerId|actorId|userId|principalId|membershipId|customerContact/
    );
  });

  it('fails closed before POST when Qualification no longer matches Recommendation evidence', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(candidate))
      .mockResolvedValueOnce(
        json({
          ...qualification,
          expectedCandidateFingerprintSha256: 'e'.repeat(64)
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTodayClient(workspaceId).prepareQualifiedOpportunity(recommendation, 'DIRECT')
    ).rejects.toMatchObject({
      status: 409,
      code: 'STALE_OPPORTUNITY_EVIDENCE'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects missing or ambiguous Candidate source without owner reads', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const invalid = {
      ...recommendation,
      sources: []
    };

    await expect(
      createTodayClient(workspaceId).loadOpportunityReview(invalid)
    ).rejects.toMatchObject({
      status: 422,
      code: 'OPPORTUNITY_CANDIDATE_SOURCE_REQUIRED'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'QUALIFICATION_ABSENT'],
    [{ ...qualification, outcome: 'DEFERRED' }, 'CANDIDATE_NOT_QUALIFIED']
  ] as const)('keeps unavailable qualification state explicit: %s', async (decision, code) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(candidate))
        .mockResolvedValueOnce(json(decision))
    );

    await expect(
      createTodayClient(workspaceId).loadOpportunityReview(recommendation)
    ).rejects.toMatchObject({ code });
  });
});
