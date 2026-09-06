import type { ProductLoopConversionAnalyticsSnapshot } from '@markorbit/contracts/beta-readiness';
import type { WorkspaceInsightsClient } from '../../api/workspace-insights.js';

export const insightsFixtureWorkspaceId = '38383838-3838-4383-8383-383838383838';

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
    workspaceId: insightsFixtureWorkspaceId,
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

export function workspaceInsightsFixtureClient(
  snapshot: ProductLoopConversionAnalyticsSnapshot = workspaceInsightsFixture()
): WorkspaceInsightsClient {
  return { load: () => Promise.resolve(snapshot) };
}
