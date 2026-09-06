import { describe, expect, it, vi } from 'vitest';
import {
  noControlledHandoffPreparationAuthorityConsequences,
  type ControlledHandoffPreparationRequestV1
} from '@markorbit/contracts/controlled-handoff-preparation';
import {
  providerDirectExecutorEstablishedFixtureV1,
  providerDirectExecutorRebrokeringDeniedFixtureV1
} from '@markorbit/contracts/provider-responsibility';
import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';
import {
  ProviderSelectionError,
  type ProviderSelectionRepository,
  type ProviderSelectionService
} from '../src/provider-selection.js';
import type { ProviderResponsibilityService } from '../src/provider-responsibility.js';
import { ControlledHandoffPreparationService } from '../src/controlled-handoff-preparation.js';

const selection = providerSelectionContractFixtureV1.currentSelection;
const workspaceId = selection.requesterWorkspaceId;
const providerId = selection.sourceLineage.provider.providerId;
const providerWorkspaceId = selection.sourceLineage.provider.providerWorkspaceId;
const supplyId = selection.sourceLineage.providerSupplyCapability.id;
const participationId =
  selection.sourceLineage.visibilityAuthorizationAtReview.networkParticipationId;
const checkedAt = '2026-09-01T05:18:00.000Z';

const provider = {
  schemaVersion: 1,
  providerId,
  providerWorkspaceId,
  displayName: 'Private test provider display name',
  operationalStatus: 'ACTIVE',
  version: 2,
  createdBy: 'user_fixture-381',
  updatedBy: 'user_fixture-381',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: checkedAt
} as const;

const supply = {
  schemaVersion: 1,
  providerSupplyCapabilityId: supplyId,
  provider: {
    providerId,
    providerWorkspaceId,
    displayName: provider.displayName,
    operationalStatus: 'ACTIVE'
  },
  version: 7,
  status: 'ACTIVE',
  jurisdictions: ['US'],
  serviceTypes: ['TRADEMARK_APPLICATION'],
  effectivePeriod: { effectiveFrom: '2026-01-01T00:00:00.000Z' },
  capacityUnits: 10,
  availabilityUnits: 5,
  evidenceReferences: ['private-evidence-reference:test-865'],
  sourceFingerprintSha256: '4'.repeat(64),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: checkedAt,
  verificationState: 'VERIFIED_FOR_SUPPLY',
  createdBy: 'user_fixture-381',
  updatedBy: 'user_fixture-381'
} as const;

const participation = {
  schemaVersion: 1,
  networkParticipationId: participationId,
  workspaceId: providerWorkspaceId,
  providerId,
  version: 4,
  state: 'ACTIVE',
  authorizationReference: 'network-authority:test-865',
  reason: 'Active bounded participation for test.',
  actorId: 'user_fixture-381',
  correlationId: 'correlation_test-865-participation',
  occurredAt: checkedAt,
  createdAt: checkedAt
} as const;

const visibility = {
  schemaVersion: 1,
  networkParticipationId: participationId,
  participationVersion: participation.version,
  version: 6,
  scope: 'BOUNDED_PUBLIC',
  grants: [
    {
      dataClass: 'PROVIDER_REFERENCE',
      fields: ['providerId', 'displayName'],
      scope: 'BOUNDED_PUBLIC',
      audience: { kind: 'BOUNDED_NETWORK' },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['visibility-authority:test-865']
    }
  ],
  authorizationReference: 'visibility-authority:test-865',
  updatedAt: checkedAt,
  reason: 'Bounded visibility for test.',
  actorId: 'user_fixture-381',
  correlationId: 'correlation_test-865-visibility',
  createdAt: checkedAt
} as const;

const directAssessment = {
  ...structuredClone(providerDirectExecutorEstablishedFixtureV1),
  provider: { providerId, providerWorkspaceId },
  profile: {
    providerResponsibilityProfileId: 'provider-responsibility_test-865',
    version: 2,
    profileFingerprintSha256: 'b'.repeat(64)
  },
  finalExecutionProviderId: providerId,
  finalExecutionProviderWorkspaceId: providerWorkspaceId,
  checkedAt
} as const;

function request(
  overrides: Partial<ControlledHandoffPreparationRequestV1> = {}
): ControlledHandoffPreparationRequestV1 {
  return {
    schemaVersion: 1,
    selection: {
      providerSelectionId: selection.providerSelectionId,
      version: selection.version,
      scopeVersion: selection.scopeVersion
    },
    selectionScope: structuredClone(selection.scope),
    purpose: {
      code: 'PROFESSIONAL_SERVICE_PREPARATION',
      contextReference: 'context:test-865',
      instructionReference: 'instruction:test-865'
    },
    requestedFields: [
      {
        dataClass: 'PROVIDER_REFERENCE',
        fieldPath: 'providerId',
        sourceOwner: 'MGSN',
        sourceReference: providerId,
        necessityReference: 'necessity:selected-provider-reference'
      },
      {
        dataClass: 'PROVIDER_EVIDENCE_REFERENCES',
        fieldPath: 'evidenceReferences',
        sourceOwner: 'MGSN',
        sourceReference: supplyId,
        necessityReference: 'necessity:bounded-provider-evidence-reference'
      }
    ],
    checkedAt,
    correlationId: 'correlation_test-865-prepare',
    ...overrides
  };
}

type SelectionRecord = Awaited<ReturnType<ProviderSelectionRepository['findLatestSelection']>>;
type SelectionValidation = Awaited<ReturnType<ProviderSelectionService['validateCurrent']>>;
type ResponsibilityAssessment = NonNullable<
  Awaited<ReturnType<ProviderResponsibilityService['assessCurrent']>>['assessment']
>;

function harness(
  options: {
    validation?: SelectionValidation;
    assessment?: ResponsibilityAssessment;
    selectionRecord?: SelectionRecord;
  } = {}
) {
  const selectionRecord = options.selectionRecord ?? selection;
  const validation = options.validation ?? providerSelectionContractFixtureV1.validForBoundedReview;
  const assessment = options.assessment ?? directAssessment;
  const selections = {
    findLatestSelection: vi.fn(() => Promise.resolve(selectionRecord))
  };
  const selectionService = {
    validateCurrent: vi.fn(() => Promise.resolve(validation))
  };
  const network = {
    findCurrentParticipation: vi.fn(() => Promise.resolve(participation)),
    findCurrentVisibilityPolicy: vi.fn(() => Promise.resolve(visibility))
  };
  const providers = {
    findProviderById: vi.fn(() => Promise.resolve(provider)),
    findSupplyCapability: vi.fn(() => Promise.resolve(supply))
  };
  const responsibility = {
    assessCurrent: vi.fn(() => Promise.resolve({ state: assessment.state, assessment }))
  };
  const service = new ControlledHandoffPreparationService(
    selections,
    selectionService,
    network,
    providers,
    responsibility,
    () => '2026-09-01T05:19:00.000Z'
  );
  return { service, selections, selectionService, network, providers, responsibility };
}

describe('MGSN Controlled Handoff Preparation V1', () => {
  it('produces a deterministic descriptor-only Privacy Preview without authorizing Handoff', async () => {
    const { service } = harness();
    const first = await service.prepare({ workspaceId }, request());
    const second = await service.prepare({ workspaceId }, request());

    expect(first).toMatchObject({
      status: 'READY_FOR_HUMAN_REVIEW',
      previewIsNotAuthorization: true,
      resultIsNotBearerCapability: true,
      readyForExplicitHumanAcknowledgement: true,
      authorityConsequences: noControlledHandoffPreparationAuthorityConsequences,
      recipient: { providerId, providerWorkspaceId, role: 'FINAL_EXECUTION_PROVIDER' }
    });
    if (first.status !== 'READY_FOR_HUMAN_REVIEW' || second.status !== 'READY_FOR_HUMAN_REVIEW')
      throw new Error('expected READY preparation results');
    expect(first.reviewTuple.previewFingerprintSha256).toBe(
      second.reviewTuple.previewFingerprintSha256
    );
    expect(first.authorizedProjection.items).toHaveLength(2);
    expect(
      first.authorizedProjection.items.every((item) => item.fieldValueEmbeddedInEnvelope === false)
    ).toBe(true);
    expect(first.authorizedProjection.items.every((item) => item.sourceOwner === 'MGSN')).toBe(
      true
    );
    expect(JSON.stringify(first)).not.toContain(provider.displayName);
    expect(first.authorityConsequences.controlledPrivacyHandoffAuthorized).toBe(false);
    expect(first.authorityConsequences.externalContactAuthorized).toBe(false);
    expect(first.authorityConsequences.providerAllocated).toBe(false);
  });

  it('fails closed instead of upgrading a browser-requested external source owner', async () => {
    const { service } = harness();
    const result = await service.prepare(
      { workspaceId },
      request({
        requestedFields: [
          {
            dataClass: 'APPLICANT_OWNER_OFFICIAL_DATA',
            fieldPath: 'legalName',
            sourceOwner: 'MARKREG',
            sourceReference: 'applicant:test-865',
            necessityReference: 'necessity:applicant-name'
          }
        ]
      })
    );
    expect(result).toMatchObject({
      status: 'DENIED',
      denialReason: 'REQUESTED_FIELD_NOT_AUTHORIZED',
      readyForExplicitHumanAcknowledgement: false
    });
  });

  it('keeps wrong-Workspace Selection privacy-safe and does not continue to owner sources', async () => {
    const { service, selectionService, network, providers } = harness();
    const result = await service.prepare(
      { workspaceId: '018f0000-0000-7000-8000-000000009999' },
      request()
    );
    expect(result).toMatchObject({ status: 'DENIED', denialReason: 'SELECTION_NOT_CURRENT' });
    expect(selectionService.validateCurrent).not.toHaveBeenCalled();
    expect(network.findCurrentParticipation).not.toHaveBeenCalled();
    expect(providers.findProviderById).not.toHaveBeenCalled();
  });

  it('preserves source-unavailable as a distinct fail-closed result', async () => {
    const { service, selectionService } = harness();
    selectionService.validateCurrent.mockRejectedValueOnce(
      new ProviderSelectionError('AUTHORITY_UNAVAILABLE', 'current authority unavailable', 503)
    );
    const result = await service.prepare({ workspaceId }, request());
    expect(result).toMatchObject({
      status: 'SOURCE_UNAVAILABLE',
      retryable: true,
      readyForExplicitHumanAcknowledgement: false
    });
  });

  it('denies disclosed rebrokering rather than creating a positive preview', async () => {
    const rebrokering = {
      ...structuredClone(providerDirectExecutorRebrokeringDeniedFixtureV1),
      provider: { providerId, providerWorkspaceId },
      profile: {
        providerResponsibilityProfileId: 'provider-responsibility_test-865',
        version: 4,
        profileFingerprintSha256: 'd'.repeat(64)
      },
      checkedAt
    } as const;
    const { service } = harness({ assessment: rebrokering });
    const result = await service.prepare({ workspaceId }, request());
    expect(result).toMatchObject({
      status: 'DENIED',
      denialReason: 'HIDDEN_INTERMEDIARY_DETECTED',
      readyForExplicitHumanAcknowledgement: false
    });
  });

  it('denies stale Selection validation without producing a preview tuple', async () => {
    const { service } = harness({
      validation: providerSelectionContractFixtureV1.currentButNotUsable
    });
    const result = await service.prepare({ workspaceId }, request());
    expect(result).toMatchObject({ status: 'DENIED', readyForExplicitHumanAcknowledgement: false });
    expect('reviewTuple' in result).toBe(false);
  });
});
