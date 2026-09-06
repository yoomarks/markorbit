import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProductLoopConversionAnalyticsSnapshot } from '@markorbit/contracts/beta-readiness';
import {
  createWorkspaceInsightsClient,
  parseWorkspaceInsightsSnapshot
} from './workspace-insights.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';

function rate(numerator: number, denominator: number) {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : Number((numerator / denominator).toFixed(6))
  };
}

export function workspaceInsightsFixture(): ProductLoopConversionAnalyticsSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    owner: 'LITE',
    scope: 'WORKSPACE_ALL_TIME',
    generatedAt: '2026-09-06T10:00:00.000Z',
    sourceFamilies: [
      {
        schemaVersion: 1,
        owner: 'LITE',
        kind: 'CONTENT_OPPORTUNITY',
        provenance: 'DURABLE_OWNER_STATE'
      },
      {
        schemaVersion: 1,
        owner: 'LITE',
        kind: 'PREPARED_ACTION_HANDOFF_RESULT',
        provenance: 'DURABLE_OWNER_STATE',
        downstreamOwner: 'MARKREG'
      }
    ],
    content: {
      contentOpportunities: 6,
      draftPrepared: 5,
      humanReviewRecorded: 4,
      publishPackagesPrepared: 3,
      userReportedUseFeedback: 2,
      rates: {
        opportunityToDraft: rate(5, 6),
        draftToHumanReview: rate(4, 5),
        humanReviewToPublishPackage: rate(3, 4),
        publishPackageToUseFeedback: rate(2, 3)
      }
    },
    opportunity: {
      opportunityCandidates: 8,
      qualificationDecisions: 5,
      qualifiedForMarkReg: 3,
      formalOpportunityHandoffResults: 2,
      rates: {
        candidateToQualification: rate(5, 8),
        qualificationToQualified: rate(3, 5),
        qualifiedToFormalOpportunityHandoff: rate(2, 3)
      }
    },
    crossOwnerEvidence: {
      evidenceOwner: 'LITE',
      downstreamOwner: 'MARKREG',
      sourceKind: 'PREPARED_ACTION_HANDOFF_RESULT',
      directMarkRegQueryPerformed: false
    },
    observationalOnly: true,
    mutatesBusinessState: false,
    userReportedExternalUseVerified: false,
    authority: {
      businessAuthorityGranted: false,
      protectedActionAuthorized: false,
      productionDeploymentAuthorized: false,
      betaReleased: false,
      ownerReleaseAuthorized: false,
      customerTruthCreated: false,
      providerTruthCreated: false,
      officialTruthCreated: false,
      capabilityVerified: false,
      capabilityCanonMutated: false
    }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Workspace Insights Gateway client', () => {
  it('reads the exact authenticated Workspace snapshot without browser-owned analytics state', async () => {
    const snapshot = workspaceInsightsFixture();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createWorkspaceInsightsClient(workspaceId).load()).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:4000/api/lite/analytics/product-loop-conversions');
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(JSON.stringify(init ?? {})).not.toMatch(/localStorage|sessionStorage|internal-authorization/);
  });

  it.each([401, 403, 503])('preserves HTTP %s instead of manufacturing zero metrics', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ code: `HTTP_${status}`, message: 'Owner response' }), {
          status
        })
      )
    );

    await expect(createWorkspaceInsightsClient(workspaceId).load()).rejects.toMatchObject({
      status,
      code: `HTTP_${status}`
    });
  });

  it('maps network failure to retryable 503 instead of an empty snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));
    await expect(createWorkspaceInsightsClient(workspaceId).load()).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE',
      retryable: true
    });
  });

  it('fails closed on wrong-Workspace, invalid count, invalid ratio and widened authority payloads', () => {
    const base = workspaceInsightsFixture();
    const cases: unknown[] = [
      { ...base, workspaceId: 'other-workspace' },
      { ...base, content: { ...base.content, draftPrepared: -1 } },
      {
        ...base,
        content: {
          ...base.content,
          rates: {
            ...base.content.rates,
            opportunityToDraft: { numerator: 4, denominator: 6, rate: 0.666667 }
          }
        }
      },
      { ...base, observationalOnly: false },
      {
        ...base,
        authority: { ...base.authority, businessAuthorityGranted: true }
      }
    ];

    for (const value of cases) {
      expect(() => parseWorkspaceInsightsSnapshot(value, workspaceId)).toThrowError(
        expect.objectContaining({ status: 503, code: 'MALFORMED_ANALYTICS_SNAPSHOT' })
      );
    }
  });
});
