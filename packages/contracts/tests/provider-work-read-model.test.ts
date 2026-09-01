import { describe, expect, it } from 'vitest';
import {
  noProviderWorkReadModelAuthorityConsequences,
  providerWorkPrivacyExclusionsV1,
  providerWorkReadModelContractFixtureV1,
  providerWorkSourceKinds,
  providerWorkSourceStates
} from '../src/provider-work-read-model.js';

describe('Provider Work Read Model V1 contract', () => {
  it('uses the existing Allocation as the work identity without creating a second lifecycle', () => {
    const item = providerWorkReadModelContractFixtureV1.activeAllocationKnownNoResponse;

    expect(item.allocation).toEqual({
      allocationId: 'allocation_fixture-419',
      version: 3,
      status: 'ACTIVE',
      updatedAt: '2026-09-01T09:50:00.000Z'
    });
    expect(item.allocationIsExistingM4TruthNotCreatedByProjection).toBe(true);
    expect(item).not.toHaveProperty('providerWorkItemId');
    expect(item).not.toHaveProperty('lifecycleStatus');
  });

  it('does not infer Provider Acceptance from an ACTIVE Allocation', () => {
    const item = providerWorkReadModelContractFixtureV1.activeAllocationKnownNoResponse;

    expect(item.allocation.status).toBe('ACTIVE');
    expect(item.responseState.kind).toBe('KNOWN_ABSENT');
    if (item.responseState.kind === 'KNOWN_ABSENT') {
      expect(item.responseState.allocationActiveDoesNotImplyPendingResponse).toBe(true);
    }
    expect(item.authorityConsequences.createsProviderAcceptance).toBe(false);
  });

  it('distinguishes known absence from unavailable response source', () => {
    const knownAbsent = providerWorkReadModelContractFixtureV1.activeAllocationKnownNoResponse;
    const unavailable = providerWorkReadModelContractFixtureV1.responseSourceUnavailable;

    expect(knownAbsent.responseState.kind).toBe('KNOWN_ABSENT');
    expect(unavailable.responseState.kind).toBe('SOURCE_UNAVAILABLE');
    if (unavailable.responseState.kind === 'SOURCE_UNAVAILABLE') {
      expect(unavailable.responseState.responseMustNotBeInferred).toBe(true);
    }
  });

  it('references exact Acceptance and Provider Return truth without copying acknowledgement, assertions or artifacts', () => {
    const item = providerWorkReadModelContractFixtureV1.acceptedWithReturnAndCurrentHandoff;
    const json = JSON.stringify(item);

    expect(item.responseState.kind).toBe('KNOWN_RESPONSE');
    if (item.responseState.kind === 'KNOWN_RESPONSE') {
      expect(item.responseState.response).toEqual({
        id: 'provider-acceptance_fixture-419',
        version: 2
      });
      expect(item.responseState.decision).toBe('ACCEPTED');
    }
    expect(item.returnState.kind).toBe('KNOWN_RETURN');
    if (item.returnState.kind === 'KNOWN_RETURN') {
      expect(item.returnState.providerReturn).toEqual({
        id: 'provider-return_fixture-419',
        version: 1
      });
      expect(item.returnState.status).toBe('CURRENT');
      expect(item.returnState.providerReturnRemainsClaimEvidenceNotOfficialTruth).toBe(true);
    }
    expect(json).not.toContain('acknowledgement');
    expect(json).not.toContain('assertions');
    expect(json).not.toContain('artifacts');
  });

  it('keeps Service Package and origin exposure bounded to exact references', () => {
    const item = providerWorkReadModelContractFixtureV1.activeAllocationKnownNoResponse;

    expect(item.servicePackage).toEqual({
      servicePackage: {
        id: 'service-package_fixture-419',
        version: 4
      },
      servicePackageFingerprintSha256: '4'.repeat(64)
    });
    expect(item.origin.exposureClass).toBe('ORIGINATING_PROFESSIONAL_REFERENCE_ONLY');
    expect(item).not.toHaveProperty('servicePackageSourceSnapshot');
    expect(item).not.toHaveProperty('allocationRationale');
  });

  it('represents current, expired, revoked and unknown incoming-data authority without embedding private fields', () => {
    const current = providerWorkReadModelContractFixtureV1.acceptedWithReturnAndCurrentHandoff;
    const expired = providerWorkReadModelContractFixtureV1.expiredIncomingAuthority;
    const revoked = providerWorkReadModelContractFixtureV1.revokedIncomingAuthority;
    const unknown = providerWorkReadModelContractFixtureV1.unknownIncomingAuthority;

    expect(current.incomingDataAuthority.state).toBe('CURRENTLY_USABLE');
    if (current.incomingDataAuthority.state === 'CURRENTLY_USABLE') {
      expect(current.incomingDataAuthority.handoff).toEqual({
        controlledHandoffId: 'controlled-handoff_fixture-405',
        version: 1
      });
      expect(current.incomingDataAuthority.currentExactProjectionMayBeResolvedSeparately).toBe(
        true
      );
      expect(current.incomingDataAuthority.embeddedPrivateFieldValues).toBe(false);
    }

    expect(expired.incomingDataAuthority.state).toBe('DENIED');
    if (expired.incomingDataAuthority.state === 'DENIED') {
      expect(expired.incomingDataAuthority.denialReason).toBe('HANDOFF_EXPIRED');
      expect(expired.incomingDataAuthority.incomingFieldsVisible).toBe(false);
    }

    expect(revoked.incomingDataAuthority.state).toBe('DENIED');
    if (revoked.incomingDataAuthority.state === 'DENIED') {
      expect(revoked.incomingDataAuthority.denialReason).toBe('HANDOFF_REVOKED');
      expect(revoked.incomingDataAuthority.incomingFieldsVisible).toBe(false);
    }

    expect(unknown.incomingDataAuthority.state).toBe('UNKNOWN');
    if (unknown.incomingDataAuthority.state === 'UNKNOWN') {
      expect(unknown.incomingDataAuthority.incomingFieldsVisible).toBe(false);
    }
  });

  it('makes privacy exclusions explicit and carries no generic relationship/commercial/raw evidence fields', () => {
    const item = providerWorkReadModelContractFixtureV1.acceptedWithReturnAndCurrentHandoff;
    const json = JSON.stringify(item);

    expect(item.privacyExclusions).toEqual(providerWorkPrivacyExclusionsV1);
    expect(Object.values(item.privacyExclusions).every((value) => value === false)).toBe(true);
    expect(json).not.toContain('customerEmail');
    expect(json).not.toContain('customerPhone');
    expect(json).not.toContain('relationshipMetadata');
    expect(json).not.toContain('marginAmount');
    expect(json).not.toContain('profitAmount');
    expect(json).not.toContain('rawEvidenceArtifact');
  });

  it('collapses wrong-Workspace and not-found reads without existence leakage', () => {
    const allowed = providerWorkReadModelContractFixtureV1.authorizedOwnWorkspaceRead;
    const denied = providerWorkReadModelContractFixtureV1.wrongWorkspaceRead;

    expect(allowed.decision).toBe('AUTHORIZED');
    if (allowed.decision === 'AUTHORIZED') {
      expect(allowed.existenceDisclosed).toBe(true);
      expect(allowed.item.provider.providerWorkspaceId).toBe(allowed.providerWorkspaceId);
      expect(allowed.readAuthorityDoesNotAuthorizeMutation).toBe(true);
    }

    expect(denied.decision).toBe('NOT_FOUND_OR_NOT_AUTHORIZED');
    if (denied.decision === 'NOT_FOUND_OR_NOT_AUTHORIZED') {
      expect(denied.item).toBeNull();
      expect(denied.existenceDisclosed).toBe(false);
      expect(denied.publicReason).toBe(
        'Provider work item was not found or is not available to this Workspace.'
      );
      expect(denied.publicReason).not.toContain('provider_fixture-419');
      expect(denied.publicReason).not.toContain('allocation_fixture-419');
      expect(denied.publicReason).not.toContain('018f0000-0000-7000-8000-000000004190');
    }
  });

  it('keeps dependency failure distinct from an empty or unauthorized queue', () => {
    const unavailable = providerWorkReadModelContractFixtureV1.unavailableRead;

    expect(unavailable.decision).toBe('SOURCE_UNAVAILABLE');
    if (unavailable.decision === 'SOURCE_UNAVAILABLE') {
      expect(unavailable.item).toBeNull();
      expect(unavailable.retryable).toBe(true);
      expect(unavailable.existenceDisclosed).toBe(false);
    }
  });

  it('creates no downstream authority even when source M4 truth already contains Acceptance and Return', () => {
    const item = providerWorkReadModelContractFixtureV1.acceptedWithReturnAndCurrentHandoff;

    expect(item.responseState.kind).toBe('KNOWN_RESPONSE');
    expect(item.returnState.kind).toBe('KNOWN_RETURN');
    expect(item.authorityConsequences).toEqual(noProviderWorkReadModelAuthorityConsequences);
    expect(Object.values(item.authorityConsequences).every((value) => value === false)).toBe(true);
    expect(item.queuePresenceIsNotActionAuthority).toBe(true);
  });

  it('freezes source-state vocabulary without inventing a queue lifecycle', () => {
    expect(providerWorkSourceKinds).toEqual([
      'ALLOCATION',
      'SERVICE_PACKAGE',
      'PROVIDER_ACCEPTANCE',
      'PROVIDER_RETURN',
      'INCOMING_DATA_AUTHORITY'
    ]);
    expect(providerWorkSourceStates).toEqual(['CURRENT', 'KNOWN_ABSENT', 'UNAVAILABLE']);
  });
});
