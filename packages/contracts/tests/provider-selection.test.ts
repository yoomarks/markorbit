import { describe, expect, it } from 'vitest';
import { providerDiscoveryContractFixtureV1 } from '../src/provider-discovery.js';
import {
  noDownstreamProviderSelectionAuthorityConsequences,
  providerSelectionContractFixtureV1,
  providerSelectionStatuses,
  providerSelectionValidationDenialReasons
} from '../src/provider-selection.js';

describe('Human Provider Selection V1 contract', () => {
  it('keeps Discovery candidate authority distinct from explicit Human Selection', () => {
    const candidate = providerDiscoveryContractFixtureV1.candidateResult.candidates[0];
    const selection = providerSelectionContractFixtureV1.currentSelection;

    expect(candidate.authorityConsequences.providerSelected).toBe(false);
    expect(selection.authorityConsequences.humanProviderSelectionRecorded).toBe(true);
    expect(selection.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId).toBe(
      candidate.providerDiscoveryCandidateId
    );
    expect(selection.sourceLineage.discoveryCandidate.candidateFingerprintSha256).toBe(
      candidate.candidateFingerprintSha256
    );
    expect(selection.sourceLineage.provider.providerId).toBe(candidate.providerId);
    expect(selection.sourceLineage.providerSupplyCapability.id).toBe(
      candidate.providerSupplyCapability.id
    );
  });

  it('records trusted human authority and does not treat payload identity as authority', () => {
    const command = providerSelectionContractFixtureV1.createCommand;

    expect(command.trustedHumanAuthority.source).toBe('CORE_WORKSPACE_PRINCIPAL');
    expect(command.trustedHumanAuthority.payloadIdentityAuthoritative).toBe(false);
    expect(command.acknowledgement.affirmativeHumanAction).toBe(true);
    expect(command.acknowledgement.reviewedCandidateId).toBe(
      command.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId
    );
    expect(command.acknowledgement.reviewedCandidateFingerprintSha256).toBe(
      command.sourceLineage.discoveryCandidate.candidateFingerprintSha256
    );
  });

  it('retains exact references without copying a whole Provider projection or private customer data', () => {
    const selectionJson = JSON.stringify(providerSelectionContractFixtureV1.currentSelection);

    expect(selectionJson).not.toContain('authorizedProjection');
    expect(selectionJson).not.toContain('capacityUnits');
    expect(selectionJson).not.toContain('availabilityUnits');
    expect(selectionJson).not.toContain('customerEmail');
    expect(selectionJson).not.toContain('customerPhone');
    expect(selectionJson).not.toContain('margin');
    expect(selectionJson).not.toContain('profit');
    expect(selectionJson).not.toContain('rawEvidence');
    expect(providerSelectionContractFixtureV1.currentSelection.acknowledgement).toMatchObject({
      containsCustomerDocuments: false,
      containsRawEvidenceArtifacts: false,
      containsEndClientRelationshipInformation: false,
      containsApplicantOwnerOfficialData: false,
      containsCommercialMarginOrProfit: false
    });
  });

  it('keeps persisted CURRENT lifecycle separate from current usability', () => {
    const selection = providerSelectionContractFixtureV1.currentSelection;
    const validation = providerSelectionContractFixtureV1.currentButNotUsable;

    expect(selection.status).toBe('CURRENT');
    expect(validation.currentlyUsable).toBe(false);
    expect(validation.decision).toBe('DENY');
    if (validation.decision === 'DENY') {
      expect(validation.denialReason).toBe('VISIBILITY_NO_LONGER_AUTHORIZED');
    }
  });

  it('requires current authority again before Selection commit and later downstream use', () => {
    const lineage = providerSelectionContractFixtureV1.currentSelection.sourceLineage;

    expect(
      lineage.visibilityAuthorizationAtReview.currentAuthorityRevalidationRequiredBeforeServe
    ).toBe(true);
    expect(lineage.currentAuthorityRevalidationRequiredBeforeSelectionCommit).toBe(true);
    expect(lineage.currentAuthorityRevalidationRequiredBeforeDownstreamUse).toBe(true);
    expect(lineage.directExecutorDisclosureAtReview.state).toBe('UNPROVEN');
  });

  it('represents idempotent historical replay without restoring current usability', () => {
    const replay = providerSelectionContractFixtureV1.replayResult;

    expect(replay.replayed).toBe(true);
    expect(replay.replayDoesNotEstablishCurrentUsability).toBe(true);
    expect(replay.mutation).toBe('CREATED');
    expect(replay.selection.status).toBe('CURRENT');
  });

  it('allows revoke to target the exact current Selection without carrying candidate exposure', () => {
    const revoke = providerSelectionContractFixtureV1.revokeCommand;

    expect(revoke.target).toEqual({
      providerSelectionId: providerSelectionContractFixtureV1.currentSelection.providerSelectionId,
      version: providerSelectionContractFixtureV1.currentSelection.version,
      scopeVersion: providerSelectionContractFixtureV1.currentSelection.scopeVersion
    });
    expect(revoke).not.toHaveProperty('sourceLineage');
    expect(revoke.reasonCode).toBe('HUMAN_WITHDRAWAL');
  });

  it('keeps every downstream authority consequence false even after current validation succeeds', () => {
    const validation = providerSelectionContractFixtureV1.validForBoundedReview;

    expect(validation.currentlyUsable).toBe(true);
    expect(validation.validationDoesNotAuthorizeDownstreamAction).toBe(true);
    expect(validation.authorityConsequences).toEqual(
      noDownstreamProviderSelectionAuthorityConsequences
    );
    expect(validation.authorityConsequences).toMatchObject({
      providerAllocated: false,
      providerAccepted: false,
      providerEngaged: false,
      professionalAppointmentCreated: false,
      externalContactAuthorized: false,
      protectedActionReleased: false,
      filingAuthorized: false,
      filingSubmitted: false,
      paymentAuthorized: false,
      paymentCreated: false,
      officialTruthCreated: false,
      matterCompleted: false
    });
  });

  it('freezes the three-state lifecycle and fail-closed validation vocabulary', () => {
    expect(providerSelectionStatuses).toEqual(['CURRENT', 'SUPERSEDED', 'REVOKED']);
    expect(providerSelectionValidationDenialReasons).toContain('SELECTION_SUPERSEDED');
    expect(providerSelectionValidationDenialReasons).toContain('SELECTION_REVOKED');
    expect(providerSelectionValidationDenialReasons).toContain('STALE_CANDIDATE');
    expect(providerSelectionValidationDenialReasons).toContain('PARTICIPATION_NOT_ACTIVE');
    expect(providerSelectionValidationDenialReasons).toContain('VISIBILITY_NO_LONGER_AUTHORIZED');
    expect(providerSelectionValidationDenialReasons).toContain('DIRECT_EXECUTOR_NOT_ESTABLISHED');
    expect(providerSelectionValidationDenialReasons).toContain('AUTHORITY_UNAVAILABLE');
  });
});
