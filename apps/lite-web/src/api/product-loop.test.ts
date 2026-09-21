import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision,
  PreparedActionJourney,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { createTodayClient } from './product-loop.js';

const workspaceId = '25252525-2525-4252-8252-252525252525';
const candidateId = 'opportunity-candidate_today-browser';
const reviewedFingerprint = 'a'.repeat(64);

const recommendation: TodayRecommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_today-browser',
  workspaceId,
  version: 1,
  kind: 'OPPORTUNITY_REVIEW',
  title: 'Review qualified trademark service need',
  explanation: 'Human qualification is ready for an explicit service-handling review.',
  sources: [
    {
      schemaVersion: 1,
      owner: 'LITE',
      kind: 'OPPORTUNITY_CANDIDATE',
      sourceId: candidateId,
      sourceVersion: 1,
      sourceFingerprintSha256: reviewedFingerprint,
      observedAt: '2026-09-21T10:00:00.000Z'
    }
  ],
  status: 'OPEN',
  recommendationFingerprintSha256: 'b'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-09-21T10:01:00.000Z',
  updatedAt: '2026-09-21T10:01:00.000Z'
};

const candidate: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: candidateId,
  workspaceId,
  version: 2,
  kind: 'TRADEMARK_SERVICE',
  title: 'Qualified Candidate',
  serviceNeedSummary: 'A human-reviewed trademark service need.',
  sources: [],
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: 'c'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-09-21T09:00:00.000Z',
  updatedAt: '2026-09-21T10:02:00.000Z'
};

const qualification: OpportunityQualificationDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_today-browser',
  workspaceId,
  version: 1,
  candidate: { id: candidateId, version: 1 },
  expectedCandidateFingerprintSha256: reviewedFingerprint,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: 'principal_today-browser',
  rationale: 'Human reviewer accepted the exact Candidate for MarkReg review.',
  decidedAt: '2026-09-21T10:02:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
};

const prepared = {
  schemaVersion: 1,
  preparedAction: {
    preparedActionId: 'prepared-action_today-browser'
  }
} as unknown as PreparedActionJourney;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  expect(typeof init?.body).toBe('string');
  if (typeof init?.body !== 'string') throw new Error('Expected JSON body.');
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Today qualified Opportunity Review client', () => {
  it('re-reads exact Candidate and Qualification evidence before preparing the bounded owner plan', async () => {
    const requests: Array<{
      url: string;
      method: string;
      headers: HeadersInit | undefined;
      body?: Record<string, unknown>;
    }> = [];
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      requests.push({
        url,
        method: init?.method ?? 'GET',
        headers: init?.headers,
        ...(init?.body ? { body: bodyOf(init) } : {})
      });
      if (url.endsWith('/api/auth/session'))
        return Promise.resolve(jsonResponse({ csrfToken: 'csrf-qualified-opportunity' }));
      if (url.endsWith(`/api/lite/opportunity-candidates/${candidateId}/qualification`))
        return Promise.resolve(jsonResponse(qualification));
      if (url.endsWith(`/api/lite/opportunity-candidates/${candidateId}`))
        return Promise.resolve(jsonResponse(candidate));
      if (url.endsWith(`/api/lite/today/${recommendation.todayRecommendationId}/prepared-actions`))
        return Promise.resolve(jsonResponse(prepared, 201));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createTodayClient(workspaceId);
    const evidence = await client.loadQualifiedOpportunityReview(recommendation);
    const result = await client.prepareQualifiedOpportunity(
      recommendation,
      evidence,
      'WHITE_LABEL'
    );

    expect(evidence).toEqual({
      source: recommendation.sources[0],
      candidate,
      qualificationDecision: qualification
    });
    expect(result).toEqual(prepared);
    expect(
      requests.filter((request) =>
        request.url.endsWith(`/api/lite/opportunity-candidates/${candidateId}`)
      )
    ).toHaveLength(2);
    expect(
      requests.filter((request) =>
        request.url.endsWith(
          `/api/lite/opportunity-candidates/${candidateId}/qualification`
        )
      )
    ).toHaveLength(2);
    const mutation = requests.find(
      (request) => request.method === 'POST' && request.url.includes('/prepared-actions')
    );
    expect(mutation?.body).toEqual({
      recommendationVersion: 1,
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      plan: {
        kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        candidate: { id: candidateId, version: 1 },
        expectedCandidateFingerprintSha256: reviewedFingerprint,
        qualificationDecision: {
          id: qualification.opportunityQualificationDecisionId,
          version: qualification.version
        },
        relationshipModel: 'WHITE_LABEL'
      }
    });
    const headers = mutation?.headers as Record<string, string> | undefined;
    expect(headers?.['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(headers?.['x-markorbit-csrf-token']).toBe('csrf-qualified-opportunity');
    expect(headers?.['idempotency-key']).toBe(
      `prepare-opportunity:${recommendation.todayRecommendationId}:1`
    );
    expect(JSON.stringify(mutation?.body)).not.toMatch(
      /workspaceId|customerId|principalId|actorId|confirmedByPrincipalId|proposedCustomerIntent/
    );
  });

  it('fails closed when owner evidence changes after display but before prepare', async () => {
    const stale = { ...qualification, expectedCandidateFingerprintSha256: 'd'.repeat(64) };
    let qualificationReads = 0;
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.endsWith(`/api/lite/opportunity-candidates/${candidateId}/qualification`)) {
        qualificationReads += 1;
        return Promise.resolve(
          jsonResponse(qualificationReads === 1 ? qualification : stale)
        );
      }
      if (url.endsWith(`/api/lite/opportunity-candidates/${candidateId}`))
        return Promise.resolve(jsonResponse(candidate));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createTodayClient(workspaceId);
    const displayedEvidence = await client.loadQualifiedOpportunityReview(recommendation);
    await expect(
      client.prepareQualifiedOpportunity(recommendation, displayedEvidence, 'DIRECT')
    ).rejects.toMatchObject({
      status: 409,
      code: 'STALE_OPPORTUNITY_REVIEW'
    });
    expect(qualificationReads).toBe(2);
    expect(
      fetchMock.mock.calls.some(([input]) => requestUrl(input).includes('/api/auth/session'))
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) => requestUrl(input).includes('/prepared-actions'))
    ).toBe(false);
  });
});
