import { describe, expect, it } from 'vitest';
import {
  betaReadinessNoAuthorityConsequences,
  productConversionAnalyticsSourceFamilies,
  type ProductLoopConversionAnalyticsSnapshot
} from '../src/beta-readiness.js';

const workspaceId = '27272727-2727-4272-8272-272727272727';

describe('M7-WP-02 bounded Product conversion analytics contract', () => {
  it('uses only Lite-owned durable source families and local handoff evidence for MarkReg conversion', () => {
    expect(productConversionAnalyticsSourceFamilies.every((source) => source.owner === 'LITE')).toBe(
      true
    );
    expect(
      productConversionAnalyticsSourceFamilies.find(
        (source) => source.kind === 'PREPARED_ACTION_HANDOFF_RESULT'
      )
    ).toMatchObject({ owner: 'LITE', downstreamOwner: 'MARKREG' });
  });

  it('keeps metrics observational and non-authorizing', () => {
    const snapshot: ProductLoopConversionAnalyticsSnapshot = {
      schemaVersion: 1,
      workspaceId,
      owner: 'LITE',
      scope: 'WORKSPACE_ALL_TIME',
      generatedAt: '2026-08-12T07:00:00.000Z',
      sourceFamilies: productConversionAnalyticsSourceFamilies,
      content: {
        contentOpportunities: 2,
        draftPrepared: 1,
        humanReviewRecorded: 1,
        publishPackagesPrepared: 1,
        userReportedUseFeedback: 1,
        rates: {
          opportunityToDraft: { numerator: 1, denominator: 2, rate: 0.5 },
          draftToHumanReview: { numerator: 1, denominator: 1, rate: 1 },
          humanReviewToPublishPackage: { numerator: 1, denominator: 1, rate: 1 },
          publishPackageToUseFeedback: { numerator: 1, denominator: 1, rate: 1 }
        }
      },
      opportunity: {
        opportunityCandidates: 2,
        qualificationDecisions: 1,
        qualifiedForMarkReg: 1,
        formalOpportunityHandoffResults: 1,
        rates: {
          candidateToQualification: { numerator: 1, denominator: 2, rate: 0.5 },
          qualificationToQualified: { numerator: 1, denominator: 1, rate: 1 },
          qualifiedToFormalOpportunityHandoff: { numerator: 1, denominator: 1, rate: 1 }
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
      authority: betaReadinessNoAuthorityConsequences
    };

    expect(snapshot.observationalOnly).toBe(true);
    expect(snapshot.mutatesBusinessState).toBe(false);
    expect(snapshot.userReportedExternalUseVerified).toBe(false);
    expect(snapshot.crossOwnerEvidence.directMarkRegQueryPerformed).toBe(false);
    expect(Object.values(snapshot.authority).every((value) => value === false)).toBe(true);
  });
});
