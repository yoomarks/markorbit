import type { ProductLoopConversionAnalyticsSnapshot } from '@markorbit/contracts/beta-readiness';

const noAuthority = {
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
} as const;

const sourceKinds = [
  'CONTENT_OPPORTUNITY',
  'CONTENT_DRAFT',
  'CONTENT_REVIEW_DECISION',
  'PUBLISH_PACKAGE',
  'CONTENT_USE_FEEDBACK',
  'OPPORTUNITY_CANDIDATE',
  'OPPORTUNITY_QUALIFICATION_DECISION'
] as const;

const sourceFamilies = sourceKinds.map((kind) => ({
  schemaVersion: 1 as const,
  owner: 'LITE' as const,
  kind,
  provenance: 'DURABLE_OWNER_STATE' as const
}));

const handoffSource = {
  schemaVersion: 1 as const,
  owner: 'LITE' as const,
  kind: 'PREPARED_ACTION_HANDOFF_RESULT' as const,
  provenance: 'DURABLE_OWNER_STATE' as const,
  downstreamOwner: 'MARKREG' as const
};

export const insightsWorkspaceId = '49494949-4949-4494-8949-494949494949';

export function workspaceInsightsFixture(
  workspaceId = insightsWorkspaceId
): ProductLoopConversionAnalyticsSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    owner: 'LITE',
    scope: 'WORKSPACE_ALL_TIME',
    generatedAt: '2026-09-06T11:30:00.000Z',
    sourceFamilies: [...sourceFamilies, handoffSource],
    content: {
      contentOpportunities: 8,
      draftPrepared: 6,
      humanReviewRecorded: 4,
      publishPackagesPrepared: 3,
      userReportedUseFeedback: 1,
      rates: {
        opportunityToDraft: { numerator: 6, denominator: 8, rate: 0.75 },
        draftToHumanReview: { numerator: 4, denominator: 6, rate: 4 / 6 },
        humanReviewToPublishPackage: { numerator: 3, denominator: 4, rate: 0.75 },
        publishPackageToUseFeedback: { numerator: 1, denominator: 3, rate: 1 / 3 }
      }
    },
    opportunity: {
      opportunityCandidates: 5,
      qualificationDecisions: 4,
      qualifiedForMarkReg: 2,
      formalOpportunityHandoffResults: 1,
      rates: {
        candidateToQualification: { numerator: 4, denominator: 5, rate: 0.8 },
        qualificationToQualified: { numerator: 2, denominator: 4, rate: 0.5 },
        qualifiedToFormalOpportunityHandoff: { numerator: 1, denominator: 2, rate: 0.5 }
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
    authority: noAuthority
  };
}
