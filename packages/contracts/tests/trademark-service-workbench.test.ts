import { describe, expect, it } from 'vitest';
import {
  noAutomaticTrademarkServiceConsequences,
  trademarkServiceIntentKinds,
  trademarkServiceReadinessStates,
  trademarkServiceRequirementKinds,
  trademarkServiceWorkbenchAuthority,
  type TrademarkServiceExecutionReadiness,
  type TrademarkServiceWorkPackage
} from '../src/trademark-service-workbench.js';

describe('M12-WP01 Trademark Service Workbench contracts', () => {
  it('freezes the initial professional service vocabulary', () => {
    expect(trademarkServiceIntentKinds).toContain('RENEWAL');
    expect(trademarkServiceIntentKinds).toContain('OFFICE_ACTION_RESPONSE');
    expect(trademarkServiceIntentKinds).toContain('ASSIGNMENT_OR_TRANSFER_RECORDAL');
    expect(trademarkServiceIntentKinds).toContain('EVIDENCE_PREPARATION');
    expect(trademarkServiceRequirementKinds).toContain('ORIGINAL_OR_HARD_COPY');
    expect(trademarkServiceRequirementKinds).toContain('LEGALIZATION_OR_APOSTILLE');
    expect(trademarkServiceReadinessStates.at(-1)).toBe('READY_FOR_EXECUTION_PREPARATION');
  });

  it('keeps readiness separate from legal outcome and protected execution authority', () => {
    const workPackage: TrademarkServiceWorkPackage = {
      schemaVersion: 1,
      workPackageId: 'trademark-service-work-package_test',
      workspaceId: '94949494-9494-4949-8949-949494949494',
      version: 1,
      asset: { id: 'trademark-asset_test', version: 3 },
      intent: {
        kind: 'RENEWAL',
        jurisdiction: 'US',
        title: 'Prepare renewal review',
        rationale: 'A reviewed Asset management recommendation requires preparation.',
        inferredFromProductContext: true,
        reviewedByUser: true,
        legalConclusionCreated: false,
        serviceAvailabilityVerified: false,
        legalDeadlineCertified: false
      },
      requirementCandidates: [],
      missingInputs: [],
      readiness: {
        state: 'READY_FOR_USER_CONFIRMATION',
        presentRequirementCount: 4,
        blockingMissingCount: 0,
        reviewRequiredCount: 1,
        evaluatedAt: '2026-08-21T03:00:00.000Z',
        preparationCompletenessOnly: true,
        successProbabilityCalculated: false,
        filingEligibilityCertified: false,
        legalValidityCertified: false
      },
      capabilityCandidates: [],
      providerCandidates: [],
      servicePackageCandidates: [],
      communicationDrafts: [],
      createdByUserId: 'user_test',
      createdAt: '2026-08-21T03:00:00.000Z',
      updatedAt: '2026-08-21T03:00:00.000Z',
      parallelMatterLifecycleCreated: false,
      officialTruthCreated: false,
      protectedActionAuthorized: false
    };

    expect(workPackage.readiness).toMatchObject({
      preparationCompletenessOnly: true,
      successProbabilityCalculated: false,
      filingEligibilityCertified: false,
      legalValidityCertified: false
    });
    expect(workPackage.protectedActionAuthorized).toBe(false);
  });

  it('keeps execution readiness as preparation evidence, not execution authorization', () => {
    const readiness: TrademarkServiceExecutionReadiness = {
      schemaVersion: 1,
      executionReadinessId: 'trademark-service-execution-readiness_test',
      workspaceId: '94949494-9494-4949-8949-949494949494',
      workPackage: { id: 'trademark-service-work-package_test', version: 2 },
      readinessState: 'READY_FOR_EXECUTION_PREPARATION',
      reviewedByUserId: 'user_test',
      reviewedAt: '2026-08-21T03:00:00.000Z',
      ownerDomainValidationReferences: ['markreg:review:1'],
      evidenceReferences: ['evidence:1'],
      executionPreparationReference: 'execution-preparation:1',
      executionAuthorized: false,
      filingAuthorized: false,
      externalContactAuthorized: false,
      paymentAuthorized: false,
      publicationAuthorized: false,
      providerEngagementAuthorized: false
    };

    expect(readiness).toMatchObject({
      executionAuthorized: false,
      filingAuthorized: false,
      externalContactAuthorized: false,
      paymentAuthorized: false,
      publicationAuthorized: false,
      providerEngagementAuthorized: false
    });
  });

  it('freezes all automatic consequence and owner-boundary locks', () => {
    expect(trademarkServiceWorkbenchAuthority).toMatchObject({
      mayPrepareServiceIntent: true,
      mayComposeRequirementCandidates: true,
      mayAssessPreparationCompleteness: true,
      mayCreateLegalConclusion: false,
      mayCertifyLegalRequirement: false,
      mayCertifyLegalDeadline: false,
      mayCalculateSuccessProbability: false,
      mayVerifyOfficialTruth: false,
      mayVerifyCapability: false,
      mayEngageProvider: false,
      mayBindQuote: false,
      mayContactExternally: false,
      mayAuthorizePayment: false,
      mayFileOrPublishExternally: false,
      mayBypassOwnerDomainValidation: false,
      mayUseCrossServiceSql: false
    });
    expect(noAutomaticTrademarkServiceConsequences).toContain('PROVIDER_ENGAGEMENT');
    expect(noAutomaticTrademarkServiceConsequences).toContain('BINDING_QUOTE');
    expect(noAutomaticTrademarkServiceConsequences).toContain('FILING_OR_RECORDAL');
  });
});
