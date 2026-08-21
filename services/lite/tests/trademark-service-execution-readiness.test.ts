import { describe, expect, it } from 'vitest';
import type { TrademarkServiceWorkPackage } from '@markorbit/contracts/trademark-service-workbench';
import {
  auditTrademarkServiceAuthorityBoundaries,
  prepareTrademarkServiceExecutionReadiness
} from '../src/trademark-service-execution-readiness.js';

const readyWorkPackage = (): TrademarkServiceWorkPackage => ({
  schemaVersion: 1,
  workPackageId: 'trademark-service-work-package_ready',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 6,
  asset: { id: 'trademark-asset_ready', version: 3 },
  intent: {
    kind: 'RENEWAL',
    jurisdiction: 'US',
    title: 'Prepare renewal',
    rationale: 'Reviewed preparation intent.',
    inferredFromProductContext: true,
    reviewedByUser: true,
    legalConclusionCreated: false,
    serviceAvailabilityVerified: false,
    legalDeadlineCertified: false
  },
  requirementCandidates: [],
  missingInputs: [],
  readiness: {
    state: 'READY_FOR_EXECUTION_PREPARATION',
    presentRequirementCount: 4,
    blockingMissingCount: 0,
    reviewRequiredCount: 0,
    evaluatedAt: '2026-08-21T01:30:00.000Z',
    preparationCompletenessOnly: true,
    successProbabilityCalculated: false,
    filingEligibilityCertified: false,
    legalValidityCertified: false
  },
  capabilityCandidates: [
    {
      capabilityReference: 'capability_us-renewal',
      capabilityVersion: '7',
      reason: 'Owner snapshot candidate.',
      verifiedCapability: false
    }
  ],
  providerCandidates: [
    {
      providerReference: 'provider_us-1',
      capabilityReference: 'capability_us-renewal',
      reason: 'MGSN owner snapshot candidate.',
      engaged: false,
      selectedForExecution: false
    }
  ],
  servicePackageCandidates: [
    {
      servicePackageReference: 'service-package_us-renewal',
      capabilityReference: 'capability_us-renewal',
      providerReference: 'provider_us-1',
      description: 'Candidate package.',
      sourceVersion: '4',
      selected: false
    }
  ],
  quoteCandidate: {
    currency: 'USD',
    lines: [],
    total: { amountMinor: 55000, currency: 'USD' },
    assumptions: [],
    limitations: ['Professional review required before commitment.'],
    bindingQuote: false,
    paymentAuthorized: false
  },
  communicationDrafts: [
    {
      preparationId: 'trademark-service-preparation_info',
      kind: 'CLIENT_INFORMATION_REQUEST',
      subject: 'Information request',
      body: 'Prepared draft only.',
      sent: false,
      externalContactAuthorized: false
    }
  ],
  createdByUserId: 'user_creator',
  createdAt: '2026-08-21T01:00:00.000Z',
  updatedAt: '2026-08-21T01:30:00.000Z',
  parallelMatterLifecycleCreated: false,
  officialTruthCreated: false,
  protectedActionAuthorized: false
});

function prepare(overrides: Partial<Parameters<typeof prepareTrademarkServiceExecutionReadiness>[0]> = {}) {
  return prepareTrademarkServiceExecutionReadiness({
    workspaceId: '11111111-1111-4111-8111-111111111111',
    workPackage: readyWorkPackage(),
    expectedWorkPackageVersion: 6,
    reviewedByUserId: 'user_reviewer',
    reviewedAt: '2026-08-21T02:00:00.000Z',
    ownerDomainValidationReferences: ['markreg-validation_1', 'capability-validation_7'],
    evidenceReferences: ['source-evidence_1'],
    executionPreparationReference: 'execution-preparation_candidate-1',
    ...overrides
  });
}

describe('M12-WP08 Execution Readiness and authority audit', () => {
  it('creates only a deterministic Execution preparation readiness reference', () => {
    const result = prepare();
    expect(result).toMatchObject({
      readinessState: 'READY_FOR_EXECUTION_PREPARATION',
      workPackage: { id: 'trademark-service-work-package_ready', version: 6 },
      executionPreparationReference: 'execution-preparation_candidate-1',
      executionAuthorized: false,
      filingAuthorized: false,
      externalContactAuthorized: false,
      paymentAuthorized: false,
      publicationAuthorized: false,
      providerEngagementAuthorized: false
    });
    expect(prepare().executionReadinessId).toBe(result.executionReadinessId);
  });

  it('rejects a stale Work Package version', () => {
    expect(() => prepare({ expectedWorkPackageVersion: 5 })).toThrow(
      'Service Work Package changed since the requested version.'
    );
  });

  it('rejects cross-Workspace preparation', () => {
    expect(() => prepare({ workspaceId: '22222222-2222-4222-8222-222222222222' })).toThrow(
      'Service Work Package does not belong to this Workspace.'
    );
  });

  it('rejects a package that has not reached the exact readiness state', () => {
    const workPackage = readyWorkPackage();
    workPackage.readiness = { ...workPackage.readiness, state: 'READY_FOR_USER_CONFIRMATION' };
    expect(() => prepare({ workPackage })).toThrow(
      'Service Work Package is not ready for Execution preparation.'
    );
  });

  it('requires explicit owner-domain validation and evidence references', () => {
    expect(() => prepare({ ownerDomainValidationReferences: [] })).toThrow(
      'ownerDomainValidationReferences must contain at least one explicit reference.'
    );
    expect(() => prepare({ evidenceReferences: [] })).toThrow(
      'evidenceReferences must contain at least one explicit reference.'
    );
  });

  it('requires the Service Intent to remain user-reviewed', () => {
    const workPackage = readyWorkPackage();
    workPackage.intent = { ...workPackage.intent, reviewedByUser: false };
    expect(() => prepare({ workPackage })).toThrow(
      'Service Intent must remain explicitly user-reviewed.'
    );
  });

  it('independently audits every M12 authority boundary before readiness can be prepared', () => {
    const audit = auditTrademarkServiceAuthorityBoundaries(readyWorkPackage());
    expect(audit.passed).toBe(true);
    expect(audit.checks).toHaveLength(8);
    expect(audit.checks.every((check) => check.passed)).toBe(true);

    const violated = readyWorkPackage();
    violated.providerCandidates = [
      {
        providerReference: 'provider_us-1',
        reason: 'Invalid promoted candidate.',
        engaged: true as false,
        selectedForExecution: false
      }
    ];
    expect(auditTrademarkServiceAuthorityBoundaries(violated).passed).toBe(false);
    expect(() => prepare({ workPackage: violated })).toThrow(
      'Service Work Package violates an M12 authority boundary.'
    );
  });

  it('normalizes explicit references without creating owner truth', () => {
    const result = prepare({
      ownerDomainValidationReferences: [' markreg-validation_1 ', 'markreg-validation_1'],
      evidenceReferences: [' evidence_2 ', 'evidence_1', 'evidence_2']
    });
    expect(result.ownerDomainValidationReferences).toEqual(['markreg-validation_1']);
    expect(result.evidenceReferences).toEqual(['evidence_1', 'evidence_2']);
    expect(result.executionAuthorized).toBe(false);
  });
});
