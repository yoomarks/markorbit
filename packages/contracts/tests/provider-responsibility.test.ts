import { describe, expect, it } from 'vitest';
import {
  directExecutorAssessmentEstablishesResponsibilityV1,
  noProviderResponsibilityAuthorityConsequences,
  providerDirectExecutorEstablishedFixtureV1,
  providerDirectExecutorRebrokeringDeniedFixtureV1,
  providerDirectExecutorRequiredSignerFixtureV1,
  providerResponsibilityDirectFixtureV1,
  providerResponsibilityRebrokeringFixtureV1,
  providerResponsibilityRequiredSignerFixtureV1,
  providerResponsibilityUnknownFixtureV1,
  type ProviderDirectExecutorAssessmentV1
} from '../src/provider-responsibility.js';

describe('Provider Responsibility V1', () => {
  it('keeps unknown or missing responsibility fail-closed for compliant discovery', () => {
    expect(directExecutorAssessmentEstablishesResponsibilityV1(undefined)).toBe(false);
    expect(directExecutorAssessmentEstablishesResponsibilityV1(null)).toBe(false);
    const unproven = {
      ...providerDirectExecutorRebrokeringDeniedFixtureV1,
      state: 'UNKNOWN_OR_UNPROVEN',
      publicReason: 'No current direct-executor proof is available.'
    } satisfies ProviderDirectExecutorAssessmentV1;
    expect(directExecutorAssessmentEstablishesResponsibilityV1(unproven)).toBe(false);
    expect(providerResponsibilityUnknownFixtureV1).toMatchObject({
      finalExecutorStatus: 'UNKNOWN',
      directResponsibilityStatus: 'UNKNOWN',
      noRebrokeringCommitmentState: 'UNKNOWN'
    });
  });

  it('distinguishes a verified direct final executor from a disclosed legally-required signer', () => {
    expect(providerResponsibilityDirectFixtureV1).toMatchObject({
      finalExecutorStatus: 'PROVIDER_IS_FINAL_EXECUTOR',
      directResponsibilityStatus: 'VERIFIED',
      noRebrokeringCommitmentState: 'COMMITTED',
      intermediaryDisclosureState: 'NO_INTERMEDIARY_DISCLOSED',
      legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false }
    });
    expect(directExecutorAssessmentEstablishesResponsibilityV1(providerDirectExecutorEstablishedFixtureV1)).toBe(true);

    expect(providerResponsibilityRequiredSignerFixtureV1.legallyRequiredDistinctSigner).toMatchObject({
      kind: 'REQUIRED',
      distinctSignerRequired: true,
      function: 'SIGNING_OR_FILING_ONLY',
      transparentlyDisclosed: true,
      receivesHandoffDataByDefault: false,
      doesNotReplaceFinalExecutionProvider: true
    });
    expect(providerDirectExecutorRequiredSignerFixtureV1).toMatchObject({
      state: 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED',
      directExecutorEstablished: true,
      finalExecutionProviderId: providerResponsibilityRequiredSignerFixtureV1.providerId,
      legallyRequiredDistinctSigner: { kind: 'REQUIRED' }
    });
    expect(directExecutorAssessmentEstablishesResponsibilityV1(providerDirectExecutorRequiredSignerFixtureV1)).toBe(true);
  });

  it('represents rebrokering or sub-agent disclosure as a negative responsibility state', () => {
    expect(providerResponsibilityRebrokeringFixtureV1).toMatchObject({
      finalExecutorStatus: 'PROVIDER_IS_NOT_FINAL_EXECUTOR',
      directResponsibilityStatus: 'DENIED',
      noRebrokeringCommitmentState: 'VIOLATION_RECORDED',
      intermediaryDisclosureState: 'REBROKERING_OR_SUBAGENT_DISCLOSED'
    });
    expect(providerDirectExecutorRebrokeringDeniedFixtureV1).toMatchObject({
      state: 'REBROKERING_OR_SUBAGENT_DISCLOSED',
      directExecutorEstablished: false,
      hiddenIntermediaryAllowed: false
    });
    expect(directExecutorAssessmentEstablishesResponsibilityV1(providerDirectExecutorRebrokeringDeniedFixtureV1)).toBe(false);
  });

  it('keeps evidence source authority and artifact access separate', () => {
    expect(providerResponsibilityDirectFixtureV1.evidenceReferences).toHaveLength(1);
    expect(providerResponsibilityDirectFixtureV1.evidenceReferences[0]).toMatchObject({
      authorityClass: 'MGSN_VERIFIED_REFERENCE',
      verificationState: 'INDEPENDENTLY_VERIFIED',
      sourceVersion: 2,
      artifactAccessAuthorized: false
    });
    expect(providerResponsibilityDirectFixtureV1.evidenceReferences[0]?.sourceFingerprintSha256).toHaveLength(64);
  });

  it('does not fold Provider operational, participation or visibility authority into responsibility truth', () => {
    const serialized = JSON.stringify(providerResponsibilityDirectFixtureV1);
    expect(serialized).not.toContain('operationalStatus');
    expect(serialized).not.toContain('networkParticipationId');
    expect(serialized).not.toContain('visibilityPolicy');
    expect(serialized).not.toContain('capacityUnits');
    expect(serialized).not.toContain('availabilityUnits');
  });

  it('keeps team and signer references bounded without relationship/contact payloads', () => {
    const serialized = JSON.stringify(providerResponsibilityRequiredSignerFixtureV1);
    for (const forbidden of ['clientEmail', 'clientPhone', 'customerRelationship', 'margin', 'profit']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(providerResponsibilityRequiredSignerFixtureV1.legallyRequiredDistinctSigner).not.toHaveProperty('contact');
  });

  it('requires current authority for a positive assessment and marks it historical-use unsafe', () => {
    expect(providerDirectExecutorEstablishedFixtureV1).toMatchObject({
      profileAuthorityState: 'CURRENT',
      directExecutorEstablished: true,
      currentAuthorityRevalidationRequiredBeforeUse: true
    });
    const stale = {
      ...providerDirectExecutorRebrokeringDeniedFixtureV1,
      state: 'AUTHORITY_NOT_CURRENT',
      profileAuthorityState: 'STALE',
      publicReason: 'Responsibility authority is stale.'
    } satisfies ProviderDirectExecutorAssessmentV1;
    expect(directExecutorAssessmentEstablishesResponsibilityV1(stale)).toBe(false);
  });

  it('creates no downstream authority and no score, rank, winner or appointment semantics', () => {
    expect(noProviderResponsibilityAuthorityConsequences).toEqual({
      providerSelected: false,
      providerAllocated: false,
      providerAccepted: false,
      providerEngaged: false,
      professionalAppointmentCreated: false,
      externalContactAuthorized: false,
      protectedActionReleased: false,
      filingAuthorized: false,
      filingSubmitted: false,
      paymentAuthorized: false,
      officialTruthCreated: false
    });
    const serialized = JSON.stringify(providerDirectExecutorEstablishedFixtureV1);
    for (const forbidden of ['score', 'rank', 'winner', 'appointmentCreated']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
