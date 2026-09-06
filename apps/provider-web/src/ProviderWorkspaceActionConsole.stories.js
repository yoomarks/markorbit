import { toProviderWorkItemViewModel } from './provider-work-model.js';
import { renderProviderWorkDetail } from './provider-work-view.js';
import './styles.css';

const providerWorkspaceId = '018f0000-0000-7000-8000-000000004190';
const originWorkspaceId = '018f0000-0000-7000-8000-000000004191';
const privacyExclusions = Object.freeze({
  allocationRationaleIncluded: false,
  allocatorIdentityIncluded: false,
  supplyCapabilityContentsIncluded: false,
  servicePackageSourceSnapshotIncluded: false,
  providerAcceptanceAcknowledgementIncluded: false,
  providerReturnArtifactsIncluded: false,
  providerReturnAssertionsIncluded: false,
  endClientRelationshipInformationIncluded: false,
  endClientContactIncluded: false,
  originatingPricingMarginProfitIncluded: false,
  privateCrmContextIncluded: false,
  unrelatedCommunicationsIncluded: false,
  unrelatedAssetsOrMattersIncluded: false,
  rawPrivateEvidenceIncluded: false
});
const authorityConsequences = Object.freeze({
  createsProviderSelection: false,
  createsProviderAllocation: false,
  createsProviderAcceptance: false,
  createsProviderEngagement: false,
  createsProfessionalAppointment: false,
  authorizesExternalContact: false,
  authorizesProtectedActionRelease: false,
  authorizesFiling: false,
  submitsFiling: false,
  authorizesPayment: false,
  createsPayment: false,
  createsOfficialTruth: false,
  completesMatter: false
});

function rawItem(overrides = {}) {
  return {
    schemaVersion: 1,
    provider: { providerId: 'provider_fixture-842', providerWorkspaceId },
    allocation: {
      allocationId: 'allocation_fixture-842',
      version: 3,
      status: 'ACTIVE',
      updatedAt: '2026-09-06T10:00:00.000Z'
    },
    servicePackage: {
      servicePackage: { id: 'service-package_fixture-842', version: 4 },
      servicePackageFingerprintSha256: '4'.repeat(64)
    },
    origin: {
      originatingWorkspaceId: originWorkspaceId,
      professionalReference: 'professional-organization:fixture-842',
      exposureClass: 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY'
    },
    actionLineage: {
      correlationId: 'correlation_provider-work-fixture-842',
      actionAuthorityNotGrantedByProjection: true
    },
    responseState: {
      kind: 'KNOWN_ABSENT',
      checkedAt: '2026-09-06T10:00:00.000Z',
      absenceScopeFingerprintSha256: 'c'.repeat(64),
      allocationActiveDoesNotImplyPendingResponse: true
    },
    returnState: {
      kind: 'KNOWN_ABSENT',
      checkedAt: '2026-09-06T10:00:00.000Z',
      absenceScopeFingerprintSha256: 'd'.repeat(64)
    },
    incomingDataAuthority: {
      state: 'UNKNOWN',
      checkedAt: '2026-09-06T10:00:00.000Z',
      reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    },
    sourceChecks: [],
    sourceSetFingerprintSha256: '5'.repeat(64),
    projectionFingerprintSha256: '6'.repeat(64),
    projectedAt: '2026-09-06T10:00:00.000Z',
    privacyExclusions,
    authorityConsequences,
    allocationIsExistingM4TruthNotCreatedByProjection: true,
    queuePresenceIsNotActionAuthority: true,
    ...overrides
  };
}

function accepted(overrides = {}) {
  return rawItem({
    responseState: {
      kind: 'KNOWN_RESPONSE',
      response: { id: 'provider-acceptance_fixture-842', version: 2 },
      decision: 'ACCEPTED',
      respondedAt: '2026-09-06T10:05:00.000Z',
      responseFingerprintSha256: '7'.repeat(64)
    },
    ...overrides
  });
}

function story(item, options = {}) {
  const host = document.createElement('main');
  host.className = 'storybook-action-host';
  const panel = document.createElement('section');
  panel.className = 'panel detail-panel';
  const detail = document.createElement('div');
  panel.append(detail);
  host.append(panel);
  renderProviderWorkDetail(detail, toProviderWorkItemViewModel(item), {
    currentReturn: options.currentReturn,
    feedback: options.feedback,
    pending: false,
    onRespond: async () => {},
    onReturn: async () => {}
  });
  return host;
}

export default {
  title: 'Provider Web/Action Console',
  parameters: { layout: 'fullscreen' }
};

export const ResponseRequired = {
  render: () => story(rawItem())
};

export const AcceptedReturnRequired = {
  render: () => story(accepted())
};

export const CurrentReturnCorrection = {
  render: () =>
    story(
      accepted({
        returnState: {
          kind: 'KNOWN_RETURN',
          providerReturn: { id: 'provider-return_fixture-842', version: 3 },
          status: 'CURRENT',
          submittedAt: '2026-09-06T10:15:00.000Z',
          returnFingerprintSha256: '8'.repeat(64),
          providerReturnRemainsClaimEvidenceNotOfficialTruth: true
        }
      }),
      {
        currentReturn: {
          id: 'provider-return_fixture-842',
          version: 3,
          status: 'CURRENT',
          workStatusClaim: 'WORK_COMPLETED',
          artifacts: [{ reference: 'artifact_fixture-842' }],
          assertions: [],
          submittedAt: '2026-09-06T10:15:00.000Z',
          truthBoundary: 'Provider-owned claim/evidence only; not Official Truth.'
        }
      }
    )
};

export const DependencyUnavailable = {
  render: () =>
    story(
      rawItem({
        responseState: {
          kind: 'SOURCE_UNAVAILABLE',
          checkedAt: '2026-09-06T10:00:00.000Z',
          reason: 'DEPENDENCY_UNAVAILABLE',
          responseMustNotBeInferred: true
        }
      })
    )
};
export const IncomingDenied = {
  render: () =>
    story(
      rawItem({
        incomingDataAuthority: {
          state: 'DENIED',
          checkedAt: '2026-09-06T10:00:00.000Z',
          denialReason: 'REVOKED',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        }
      })
    )
};

export const IncomingUnknown = {
  render: () => story(rawItem())
};

export const Declined = {
  render: () =>
    story(
      rawItem({
        responseState: {
          kind: 'KNOWN_RESPONSE',
          response: { id: 'provider-acceptance_fixture-842', version: 2 },
          decision: 'DECLINED',
          respondedAt: '2026-09-06T10:05:00.000Z',
          responseFingerprintSha256: '7'.repeat(64)
        },
        allocation: {
          allocationId: 'allocation_fixture-842',
          version: 4,
          status: 'SUPERSEDED',
          updatedAt: '2026-09-06T10:05:00.000Z'
        }
      })
    )
};

export const IncomingCurrentlyUsable = {
  render: () =>
    story(
      rawItem({
        incomingDataAuthority: {
          state: 'CURRENTLY_USABLE',
          handoff: { id: 'controlled-handoff_fixture-842', version: 1 },
          validationReference: 'handoff-validation:fixture-842',
          validationFingerprintSha256: '9'.repeat(64),
          validationPolicyVersion: 'v1',
          checkedAt: '2026-09-06T10:00:00.000Z',
          currentExactProjectionMayBeResolvedSeparately: true,
          embeddedPrivateFieldValues: false
        }
      })
    )
};

export const IncomingKnownAbsent = {
  render: () =>
    story(
      rawItem({
        incomingDataAuthority: {
          state: 'KNOWN_ABSENT',
          checkedAt: '2026-09-06T10:00:00.000Z',
          authorityScopeFingerprintSha256: 'a'.repeat(64),
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        }
      })
    )
};
export const IncomingSourceUnavailable = {
  render: () =>
    story(
      rawItem({
        incomingDataAuthority: {
          state: 'SOURCE_UNAVAILABLE',
          checkedAt: '2026-09-06T10:00:00.000Z',
          reason: 'DEPENDENCY_UNAVAILABLE',
          incomingFieldsVisible: false,
          embeddedPrivateFieldValues: false
        }
      })
    )
};
