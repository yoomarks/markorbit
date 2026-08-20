import { describe, expect, it } from 'vitest';
import type {
  TrademarkServiceRequirementCandidate,
  TrademarkServiceWorkPackage
} from '@markorbit/contracts/trademark-service-workbench';
import { assessTrademarkServiceReadiness } from '../src/trademark-service-readiness.js';

const workspaceId = '94949494-9494-4949-8949-949494949494';
const workPackageId = 'trademark-service-work-package_readiness-test' as const;
const source = {
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_SOURCE',
  sourceId: 'knowledge_readiness',
  sourceVersion: '1',
  observedAt: '2026-08-21T04:00:00.000Z',
  freshness: 'CURRENT'
} as const;

function requirement(
  overrides: Partial<TrademarkServiceRequirementCandidate> &
    Pick<TrademarkServiceRequirementCandidate, 'requirementId' | 'kind' | 'status' | 'title'>
): TrademarkServiceRequirementCandidate {
  return {
    schemaVersion: 1,
    workspaceId,
    workPackageId,
    explanation: 'Source-backed preparation requirement.',
    jurisdiction: 'US',
    sourceReferences: [source],
    sourceFreshnessReviewed: true,
    professionalReviewRequired: false,
    certifiedLegalRequirement: false,
    legalDeadlineCertified: false,
    officialTruthVerifiedByLite: false,
    createdAt: '2026-08-21T04:00:00.000Z',
    ...overrides
  };
}

function workPackage(
  overrides: Partial<TrademarkServiceWorkPackage> = {}
): TrademarkServiceWorkPackage {
  return {
    schemaVersion: 1,
    workPackageId,
    workspaceId,
    version: 3,
    asset: { id: 'trademark-asset_readiness', version: 2 },
    intent: {
      kind: 'RENEWAL',
      jurisdiction: 'US',
      title: 'Prepare renewal service',
      rationale: 'Reviewed professional-service need.',
      inferredFromProductContext: true,
      reviewedByUser: true,
      legalConclusionCreated: false,
      serviceAvailabilityVerified: false,
      legalDeadlineCertified: false
    },
    requirementCandidates: [],
    missingInputs: [],
    readiness: {
      state: 'DRAFT',
      presentRequirementCount: 0,
      blockingMissingCount: 0,
      reviewRequiredCount: 0,
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
    createdByUserId: 'user_wp04',
    createdAt: '2026-08-21T03:00:00.000Z',
    updatedAt: '2026-08-21T03:00:00.000Z',
    parallelMatterLifecycleCreated: false,
    officialTruthCreated: false,
    protectedActionAuthorized: false,
    ...overrides
  };
}

function assess(packageOverrides: Partial<TrademarkServiceWorkPackage> = {}) {
  return assessTrademarkServiceReadiness({
    workPackage: workPackage(packageOverrides),
    evaluatedAt: '2026-08-21T04:10:00.000Z'
  });
}

describe('M12-WP04 readiness and missing information engine', () => {
  it('keeps a newly anchored package in DRAFT before requirement composition', () => {
    const result = assess();
    expect(result.readiness).toMatchObject({
      state: 'DRAFT',
      preparationCompletenessOnly: true,
      successProbabilityCalculated: false,
      filingEligibilityCertified: false,
      legalValidityCertified: false
    });
    expect(result.legalInsufficiencyFindingCreated).toBe(false);
  });

  it('marks missing Asset/Matter or jurisdiction context as CONTEXT_INCOMPLETE', () => {
    const result = assess({
      asset: undefined,
      matterReference: undefined,
      intent: {
        ...workPackage().intent,
        jurisdiction: ''
      }
    });
    expect(result.readiness.state).toBe('CONTEXT_INCOMPLETE');
    expect(result.missingInputs.map((input) => input.reason)).toEqual(
      expect.arrayContaining(['ASSET_CONTEXT_MISSING', 'JURISDICTION_CONTEXT_MISSING'])
    );
  });

  it('routes candidate, unknown, stale-review or professional-review requirements to REQUIREMENTS_REVIEW_REQUIRED', () => {
    const result = assess({
      requirementCandidates: [
        requirement({
          requirementId: 'trademark-service-requirement_review',
          kind: 'TIMING_OR_DEADLINE_REVIEW',
          status: 'PRESENT',
          title: 'Review timing context',
          professionalReviewRequired: true
        })
      ]
    });
    expect(result.readiness).toMatchObject({
      state: 'REQUIREMENTS_REVIEW_REQUIRED',
      reviewRequiredCount: 1
    });
    expect(result.readiness.successProbabilityCalculated).toBe(false);
  });

  it('detects missing client document and evidence inputs without making a legal insufficiency finding', () => {
    const result = assess({
      requirementCandidates: [
        requirement({
          requirementId: 'trademark-service-requirement_document',
          kind: 'DOCUMENT',
          status: 'MISSING',
          title: 'Supporting document'
        }),
        requirement({
          requirementId: 'trademark-service-requirement_evidence',
          kind: 'EVIDENCE',
          status: 'MISSING',
          title: 'Use evidence'
        })
      ]
    });
    expect(result.readiness.state).toBe('MISSING_CLIENT_INPUT');
    expect(result.readiness.blockingMissingCount).toBe(2);
    expect(result.missingInputs.map((input) => input.reason)).toEqual(
      expect.arrayContaining(['DOCUMENT_MISSING', 'EVIDENCE_MISSING'])
    );
    expect(result.legalInsufficiencyFindingCreated).toBe(false);
  });

  it('routes owner-domain, capability and provider prerequisites to PROVIDER_INPUT_REQUIRED', () => {
    const result = assess({
      requirementCandidates: [
        requirement({
          requirementId: 'trademark-service-requirement_owner',
          kind: 'OWNER_DOMAIN_REVIEW',
          status: 'MISSING',
          title: 'Owner-domain review'
        }),
        requirement({
          requirementId: 'trademark-service-requirement_provider',
          kind: 'PROVIDER',
          status: 'MISSING',
          title: 'Provider context'
        })
      ]
    });
    expect(result.readiness.state).toBe('PROVIDER_INPUT_REQUIRED');
    expect(result.missingInputs.map((input) => input.reason)).toEqual(
      expect.arrayContaining(['OWNER_DOMAIN_REVIEW_MISSING', 'PROVIDER_CONTEXT_MISSING'])
    );
  });

  it('routes missing commercial prerequisites to COMMERCIAL_REVIEW_REQUIRED', () => {
    const result = assess({
      requirementCandidates: [
        requirement({
          requirementId: 'trademark-service-requirement_commercial',
          kind: 'COMMERCIAL',
          status: 'MISSING',
          title: 'Commercial context'
        })
      ]
    });
    expect(result.readiness.state).toBe('COMMERCIAL_REVIEW_REQUIRED');
    expect(result.missingInputs[0]?.reason).toBe('COMMERCIAL_CONTEXT_MISSING');
  });

  it('requires user confirmation when preparation is complete but intent has not been reviewed', () => {
    const result = assess({
      intent: { ...workPackage().intent, reviewedByUser: false },
      requirementCandidates: [
        requirement({
          requirementId: 'trademark-service-requirement_present',
          kind: 'DOCUMENT',
          status: 'PRESENT',
          title: 'Supporting document'
        })
      ]
    });
    expect(result.readiness.state).toBe('READY_FOR_USER_CONFIRMATION');
  });

  it('reaches READY_FOR_EXECUTION_PREPARATION only as a completeness state with all authority locks false', () => {
    const result = assess({
      requirementCandidates: [
        requirement({
          requirementId: 'trademark-service-requirement_present',
          kind: 'DOCUMENT',
          status: 'PRESENT',
          title: 'Supporting document'
        }),
        requirement({
          requirementId: 'trademark-service-requirement_na',
          kind: 'COMMERCIAL',
          status: 'NOT_APPLICABLE',
          title: 'Commercial review not applicable'
        })
      ]
    });
    expect(result.readiness).toMatchObject({
      state: 'READY_FOR_EXECUTION_PREPARATION',
      presentRequirementCount: 1,
      blockingMissingCount: 0,
      reviewRequiredCount: 0,
      preparationCompletenessOnly: true,
      successProbabilityCalculated: false,
      filingEligibilityCertified: false,
      legalValidityCertified: false
    });
    expect(result).toMatchObject({
      legalInsufficiencyFindingCreated: false,
      officialTruthVerifiedByLite: false
    });
  });

  it('preserves and deduplicates pre-existing missing inputs from composition', () => {
    const existing = {
      reason: 'OTHER_REVIEW_REQUIRED',
      title: 'Professional review required',
      explanation: 'Source-backed requirements are not available.',
      blocking: true
    } as const;
    const result = assess({ missingInputs: [existing, existing] });
    expect(result.missingInputs).toEqual([existing]);
    expect(result.readiness.state).toBe('REQUIREMENTS_REVIEW_REQUIRED');
  });
});
