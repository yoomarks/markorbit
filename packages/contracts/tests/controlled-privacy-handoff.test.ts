import { describe, expect, it } from 'vitest';
import {
  controlledHandoffAuthorizedDataClasses,
  controlledHandoffContractFixtureV1,
  controlledHandoffForbiddenGenericDataClasses,
  controlledHandoffStatuses,
  controlledHandoffValidationDenialReasons,
  noDownstreamHandoffAuthorityConsequences
} from '../src/controlled-privacy-handoff.js';
import { providerSelectionContractFixtureV1 } from '../src/provider-selection.js';

describe('Controlled Privacy Handoff V1 contract', () => {
  it('keeps Provider Selection distinct from Handoff authorization and references the exact current Selection', () => {
    const selection = providerSelectionContractFixtureV1.currentSelection;
    const handoff = controlledHandoffContractFixtureV1.currentEnvelope;

    expect(selection.authorityConsequences.humanProviderSelectionRecorded).toBe(true);
    expect(selection.authorityConsequences.externalContactAuthorized).toBe(false);
    expect(handoff.authorityConsequences.controlledPrivacyHandoffAuthorized).toBe(true);
    expect(handoff.sourceLineage.selectionLineage.selection).toEqual({
      providerSelectionId: selection.providerSelectionId,
      version: selection.version,
      scopeVersion: selection.scopeVersion
    });
    expect(handoff.sourceLineage.selectionLineage.currentSelectionValidation).toMatchObject({
      purpose: 'CONTROLLED_HANDOFF_REVIEW',
      decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
      currentlyUsable: true
    });
  });

  it('freezes an exact requested-authorized-minimum-necessary projection without wildcard or whole-record fallback', () => {
    const projection = controlledHandoffContractFixtureV1.currentEnvelope.authorizedProjection;

    expect(projection.wildcardAllowed).toBe(false);
    expect(projection.wholeRecordAllowed).toBe(false);
    expect(projection.implicitFieldExpansionAllowed).toBe(false);
    expect(projection.fieldValuesEmbeddedInEnvelope).toBe(false);
    expect(projection.requestedAuthorizedMinimumNecessaryIntersectionRequired).toBe(true);
    expect(projection.items.length).toBeGreaterThan(0);
    for (const item of projection.items) {
      expect(item.requested).toBe(true);
      expect(item.authorizedBySourceOwner).toBe(true);
      expect(item.minimumNecessary).toBe(true);
      expect(item.fieldValueEmbeddedInEnvelope).toBe(false);
      expect(item.fieldPath).not.toContain('*');
      expect(controlledHandoffAuthorizedDataClasses).toContain(item.dataClass);
    }
  });

  it('keeps End-client relationship, commercial and unrelated private data outside the generic V1 projection', () => {
    const projection = controlledHandoffContractFixtureV1.currentEnvelope.authorizedProjection;
    const dataClasses = projection.items.map((item) => item.dataClass);
    const envelopeJson = JSON.stringify(controlledHandoffContractFixtureV1.currentEnvelope);

    expect(projection.forbiddenGenericDataClasses).toEqual(
      controlledHandoffForbiddenGenericDataClasses
    );
    for (const forbidden of controlledHandoffForbiddenGenericDataClasses) {
      expect(dataClasses).not.toContain(forbidden);
    }
    expect(envelopeJson).not.toContain('customerEmail');
    expect(envelopeJson).not.toContain('customerPhone');
    expect(envelopeJson).not.toContain('marginAmount');
    expect(envelopeJson).not.toContain('profitAmount');
    expect(envelopeJson).not.toContain('rawEvidenceArtifact');
  });

  it('binds the Privacy Preview acknowledgement to the exact recipient, Selection, purpose, projection and source set', () => {
    const handoff = controlledHandoffContractFixtureV1.currentEnvelope;
    const preview = handoff.privacyPreviewAcknowledgement;

    expect(preview.affirmativeHumanAction).toBe(true);
    expect(preview.originatingWorkspaceId).toBe(handoff.originatingWorkspaceId);
    expect(preview.recipientProviderId).toBe(handoff.recipient.providerId);
    expect(preview.recipientProviderWorkspaceId).toBe(handoff.recipient.providerWorkspaceId);
    expect(preview.selection).toEqual(handoff.sourceLineage.selectionLineage.selection);
    expect(preview.purposeFingerprintSha256).toBe(handoff.purpose.purposeFingerprintSha256);
    expect(preview.projectionFingerprintSha256).toBe(
      handoff.authorizedProjection.projectionFingerprintSha256
    );
    expect(preview.sourceSetFingerprintSha256).toBe(
      handoff.authorizedProjection.sourceSetFingerprintSha256
    );
  });

  it('requires finite validity, current-authority revalidation and exact Direct-to-Executor authority', () => {
    const handoff = controlledHandoffContractFixtureV1.currentEnvelope;
    const lineage = handoff.sourceLineage;

    expect(Date.parse(handoff.validUntil)).toBeGreaterThan(Date.parse(handoff.validFrom));
    expect(lineage.currentAuthorityRevalidationRequiredBeforeAuthorize).toBe(true);
    expect(lineage.currentAuthorityRevalidationRequiredBeforeConsumption).toBe(true);
    expect(lineage.directExecutorAuthority.directExecutorEstablished).toBe(true);
    expect(lineage.directExecutorAuthority.disclosureState).toBe('INDEPENDENT_EVIDENCE_REFERENCED');
    expect(lineage.directExecutorAuthority.hiddenIntermediaryAllowed).toBe(false);
    expect(lineage.directExecutorAuthority.onwardRecipientAuthorization).toBe('NONE');
    expect(lineage.directExecutorAuthority.finalExecutionProviderId).toBe(
      handoff.recipient.providerId
    );
  });

  it('keeps evidence-reference visibility separate from artifact retrieval authority', () => {
    const handoff = controlledHandoffContractFixtureV1.currentEnvelope;
    const evidenceItem = handoff.authorizedProjection.items.find(
      (item) => item.dataClass === 'PROVIDER_EVIDENCE_REFERENCES'
    );
    const validation = controlledHandoffContractFixtureV1.artifactRetrievalDenied;

    expect(handoff.sourceLineage.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval).toBe(
      true
    );
    expect(evidenceItem?.evidenceArtifactRetrievalAuthority).toBe('SEPARATE_AUTHORITY_REQUIRED');
    expect(validation.decision).toBe('DENY');
    if (validation.decision === 'DENY') {
      expect(validation.denialReason).toBe('EVIDENCE_ARTIFACT_ACCESS_NOT_AUTHORIZED');
    }
  });

  it('keeps recorded authorization separate from current usability and fails closed after expiry', () => {
    const handoff = controlledHandoffContractFixtureV1.currentEnvelope;
    const validation = controlledHandoffContractFixtureV1.expiredValidation;

    expect(handoff.status).toBe('AUTHORIZED');
    expect(validation.currentlyUsable).toBe(false);
    expect(validation.currentExactDisclosurePermitted).toBe(false);
    expect(validation.decision).toBe('DENY');
    if (validation.decision === 'DENY') {
      expect(validation.denialReason).toBe('HANDOFF_EXPIRED');
    }
  });

  it('represents replay and revoke without restoring or broadening disclosure authority', () => {
    const replay = controlledHandoffContractFixtureV1.replayResult;
    const revoke = controlledHandoffContractFixtureV1.revokeCommand;

    expect(replay.replayed).toBe(true);
    expect(replay.replayDoesNotEstablishCurrentUsability).toBe(true);
    expect(revoke.target).toEqual({
      controlledHandoffId: controlledHandoffContractFixtureV1.currentEnvelope.controlledHandoffId,
      version: controlledHandoffContractFixtureV1.currentEnvelope.version
    });
    expect(revoke).not.toHaveProperty('authorizedProjection');
    expect(revoke).not.toHaveProperty('sourceLineage');
  });

  it('allows only exact current disclosure while every downstream action consequence remains false', () => {
    const validation = controlledHandoffContractFixtureV1.validForExactConsumption;

    expect(validation.currentlyUsable).toBe(true);
    expect(validation.currentExactDisclosurePermitted).toBe(true);
    expect(validation.validationIsNotBearerCapability).toBe(true);
    expect(validation.validationDoesNotAuthorizeDownstreamAction).toBe(true);
    expect(validation.authorityConsequences).toEqual(noDownstreamHandoffAuthorityConsequences);
    expect(validation.authorityConsequences).toMatchObject({
      providerEngaged: false,
      providerAllocated: false,
      providerAccepted: false,
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

  it('freezes lifecycle, purpose and fail-closed denial vocabularies', () => {
    expect(controlledHandoffStatuses).toEqual(['AUTHORIZED', 'REVOKED']);
    expect(controlledHandoffValidationDenialReasons).toContain('HANDOFF_REVOKED');
    expect(controlledHandoffValidationDenialReasons).toContain('HANDOFF_EXPIRED');
    expect(controlledHandoffValidationDenialReasons).toContain('SELECTION_NOT_CURRENT');
    expect(controlledHandoffValidationDenialReasons).toContain('WRONG_RECIPIENT');
    expect(controlledHandoffValidationDenialReasons).toContain('PURPOSE_MISMATCH');
    expect(controlledHandoffValidationDenialReasons).toContain('PROJECTION_MISMATCH');
    expect(controlledHandoffValidationDenialReasons).toContain('SOURCE_VERSION_MISMATCH');
    expect(controlledHandoffValidationDenialReasons).toContain('DIRECT_EXECUTOR_NOT_ESTABLISHED');
    expect(controlledHandoffValidationDenialReasons).toContain('HIDDEN_INTERMEDIARY_DETECTED');
    expect(controlledHandoffValidationDenialReasons).toContain('AUTHORITY_UNAVAILABLE');
  });
});
