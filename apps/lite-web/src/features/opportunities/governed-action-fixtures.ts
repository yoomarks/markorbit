import type { ControlledHandoffPreparationResultV1 } from '@markorbit/contracts/controlled-handoff-preparation';
import type {
  ControlledHandoffCurrentValidationV1,
  ControlledHandoffMutationResultV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  EligibilityEvaluation,
  ServicePackage
} from '@markorbit/contracts/provider-execution';
import type { ProviderDiscoveryResultV1 } from '@markorbit/contracts/provider-discovery';
import type { ProviderSelectionMutationResultV1 } from '@markorbit/contracts/provider-selection';
import type { GovernedAllocationResult } from '../../api/governed-provider.js';

export const governedFixtureWorkspaceId = '018f0000-0000-7000-8000-000000000843';
export const governedFixtureAt = '2026-09-06T04:00:00.000Z';

export const governedServicePackageFixture = {
  schemaVersion: 1,
  servicePackageId: 'service-package_fixture-843',
  workspaceId: governedFixtureWorkspaceId,
  source: {
    instructionReferences: ['instruction:fixture-843-provider-handling']
  },
  jurisdiction: 'US',
  serviceType: 'TRADEMARK_APPLICATION',
  status: 'ELIGIBILITY_OPEN',
  admittedAt: governedFixtureAt,
  version: 3,
  servicePackageFingerprintSha256: '1'.repeat(64)
} as unknown as Readonly<ServicePackage>;

const request = {
  schemaVersion: 1,
  providerDiscoveryRequestId: 'provider-discovery-request_fixture-843',
  requesterWorkspaceId: governedFixtureWorkspaceId,
  need: {
    reference: governedServicePackageFixture.servicePackageId,
    version: governedServicePackageFixture.version,
    fingerprintSha256: governedServicePackageFixture.servicePackageFingerprintSha256,
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_APPLICATION'
  },
  purpose: 'PROVIDER_DISCOVERY',
  audience: { kind: 'BOUNDED_NETWORK' },
  contextReference: 'service-package:service-package_fixture-843:provider-progression',
  requestedDataClasses: [
    'PROVIDER_REFERENCE',
    'SUPPLY_PROFILE',
    'SERVICE_JURISDICTIONS',
    'PROVIDER_EVIDENCE_REFERENCE'
  ],
  requestedFields: [
    'providerId',
    'displayName',
    'serviceTypes',
    'jurisdictions',
    'evidenceReferences'
  ],
  requestedAt: governedFixtureAt,
  requestFingerprintSha256: '2'.repeat(64),
  correlationId: 'correlation_fixture-843'
} as const;

function candidate(
  suffix: string,
  displayName: string,
  limitation: string,
  providerSuffix: string
) {
  const providerId = `provider_fixture-${providerSuffix}`;
  const supplyId = `provider-supply-capability_fixture-${providerSuffix}`;
  return {
    schemaVersion: 1,
    providerDiscoveryCandidateId: `provider-discovery-candidate_fixture-${suffix}`,
    request,
    providerId,
    providerWorkspaceId: `018f0000-0000-7000-8000-00000000${providerSuffix.padStart(4, '0')}`,
    providerSupplyCapability: {
      id: supplyId,
      version: 7,
      fingerprintSha256: '4'.repeat(64)
    },
    authorizedProjection: {
      schemaVersion: 1,
      fields: [
        { dataClass: 'PROVIDER_REFERENCE', field: 'providerId', value: providerId },
        { dataClass: 'PROVIDER_REFERENCE', field: 'displayName', value: displayName },
        {
          dataClass: 'SUPPLY_PROFILE',
          field: 'serviceTypes',
          value: ['TRADEMARK_APPLICATION']
        },
        { dataClass: 'SERVICE_JURISDICTIONS', field: 'jurisdictions', value: ['US'] },
        {
          dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
          field: 'evidenceReferences',
          value: [`evidence:${suffix}:supply-verification`]
        }
      ]
    },
    visibilityAuthorization: {
      networkParticipationId: `network-participation_fixture-${providerSuffix}`,
      participationVersion: 4,
      visibilityPolicyVersion: 6,
      evaluatedAt: governedFixtureAt,
      currentAuthorityRevalidationRequiredBeforeServe: true
    },
    visibilityEvidence: [],
    suitabilityEvidence: [],
    directExecutorDisclosure: {
      state: 'UNPROVEN',
      evidenceReferences: [],
      requiresIndependentCurrentVerification: true
    },
    sourceVersions: [
      {
        owner: 'MGSN',
        sourceType: 'PROVIDER',
        sourceId: providerId,
        version: 3,
        fingerprintSha256: '5'.repeat(64),
        checkedAt: governedFixtureAt,
        authorityState: 'CURRENT'
      },
      {
        owner: 'MGSN',
        sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
        sourceId: supplyId,
        version: 7,
        fingerprintSha256: '4'.repeat(64),
        checkedAt: governedFixtureAt,
        authorityState: 'CURRENT'
      }
    ],
    evaluationPolicyVersion: 'mgsn-provider-discovery-v1',
    explanation: {
      summary: `${displayName} matches the bounded US trademark application need.`,
      matchedConstraints: ['US jurisdiction', 'Trademark application service'],
      evidenceReferences: [`evidence:${suffix}:supply-verification`],
      limitations: [
        {
          code: 'DIRECT_EXECUTOR_NOT_ESTABLISHED',
          explanation: limitation
        },
        {
          code: 'NO_BOUNDED_AVAILABILITY_SIGNAL',
          explanation: 'Raw capacity and availability are not exposed in Discovery.'
        }
      ]
    },
    candidateFingerprintSha256: suffix.repeat(64).slice(0, 64),
    generatedAt: governedFixtureAt,
    authorityConsequences: {
      providerSelected: false,
      providerAllocated: false,
      providerAccepted: false,
      providerEngaged: false,
      professionalAppointmentCreated: false,
      externalContactAuthorized: false,
      protectedActionAuthorized: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      officialTruthCreated: false
    }
  };
}

export const governedDiscoveryFixture = {
  schemaVersion: 1,
  request,
  evaluatedAt: governedFixtureAt,
  resultFingerprintSha256: '3'.repeat(64),
  authorityConsequences: {
    providerSelected: false,
    providerAllocated: false,
    providerAccepted: false,
    providerEngaged: false,
    professionalAppointmentCreated: false,
    externalContactAuthorized: false,
    protectedActionAuthorized: false,
    filingAuthorized: false,
    paymentAuthorized: false,
    officialTruthCreated: false
  },
  status: 'CANDIDATES',
  candidates: [
    candidate(
      'a',
      'Northstar Trademark Services',
      'Direct Executor must be independently revalidated before Selection.',
      '8431'
    ),
    candidate(
      'b',
      'Orbit Counsel Network',
      'Current responsibility proof remains a downstream requirement.',
      '8432'
    )
  ]
} as unknown as Readonly<ProviderDiscoveryResultV1>;

export const governedSelectionFixture = {
  schemaVersion: 1,
  mutation: 'CREATED',
  selection: {
    schemaVersion: 1,
    providerSelectionId: 'provider-selection_fixture-843',
    requesterWorkspaceId: governedFixtureWorkspaceId,
    scope: {
      owner: 'LITE',
      reference: governedServicePackageFixture.servicePackageId,
      version: governedServicePackageFixture.version,
      fingerprintSha256: governedServicePackageFixture.servicePackageFingerprintSha256
    },
    scopeVersion: 1,
    sourceLineage: {},
    trustedHumanAuthority: {},
    acknowledgement: {},
    selectedAt: governedFixtureAt,
    version: 1,
    correlationId: 'correlation_fixture-selection-843',
    authorityConsequences: {},
    status: 'CURRENT',
    supersededBy: null,
    revokedAt: null
  },
  replayed: false,
  replayDoesNotEstablishCurrentUsability: true,
  correlationId: 'correlation_fixture-selection-843'
} as unknown as Readonly<ProviderSelectionMutationResultV1>;

const projection = {
  schemaVersion: 1,
  items: [
    {
      dataClass: 'PROVIDER_REFERENCE',
      fieldPath: 'providerId',
      sourceOwner: 'MGSN',
      sourceReference: 'provider_fixture-8431',
      sourceVersion: 3,
      sourceFingerprintSha256: '5'.repeat(64),
      necessityReference: 'provider-routing',
      requested: true,
      authorizedBySourceOwner: true,
      minimumNecessary: true,
      fieldValueEmbeddedInEnvelope: false,
      evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE'
    }
  ],
  projectionFingerprintSha256: '8'.repeat(64),
  sourceSetFingerprintSha256: '9'.repeat(64),
  wildcardAllowed: false,
  wholeRecordAllowed: false,
  implicitFieldExpansionAllowed: false,
  fieldValuesEmbeddedInEnvelope: false,
  requestedAuthorizedMinimumNecessaryIntersectionRequired: true,
  forbiddenGenericDataClasses: [
    'END_CLIENT_RELATIONSHIP_INFORMATION',
    'ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT',
    'PRIVATE_CRM_CONTEXT',
    'UNRELATED_COMMUNICATIONS',
    'UNRELATED_ASSETS_OR_MATTERS'
  ]
} as const;

export const governedPreparationFixture = {
  schemaVersion: 1,
  status: 'READY_FOR_HUMAN_REVIEW',
  selection: {
    providerSelectionId: 'provider-selection_fixture-843',
    version: 1,
    scopeVersion: 1
  },
  evaluatedAt: governedFixtureAt,
  checkedAuthorityReferences: ['mgsn-provider:provider_fixture-8431:v3'],
  publicLimitations: [
    'Privacy Preview contains authorization descriptors only; no private field values are embedded.',
    'Selection and current source authority are revalidated before authorization.'
  ],
  correlationId: 'correlation_fixture-handoff-843',
  previewIsNotAuthorization: true,
  resultIsNotBearerCapability: true,
  authorityConsequences: {
    controlledHandoffAuthorized: false,
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
  },
  recipient: {
    providerId: 'provider_fixture-8431',
    providerWorkspaceId: '018f0000-0000-7000-8000-000000008431',
    role: 'FINAL_EXECUTION_PROVIDER'
  },
  purpose: {
    code: 'PROFESSIONAL_SERVICE_PREPARATION',
    contextReference: 'service-package:service-package_fixture-843:provider-progression',
    instructionReference: 'instruction:fixture-843-provider-handling',
    purposeFingerprintSha256: '7'.repeat(64),
    unrestrictedPurposeAllowed: false
  },
  authorizedProjection: projection,
  sourceLineage: {
    selectionLineage: {
      selection: {
        providerSelectionId: 'provider-selection_fixture-843',
        version: 1,
        scopeVersion: 1
      },
      selectionScope: {
        owner: 'LITE',
        reference: governedServicePackageFixture.servicePackageId,
        version: governedServicePackageFixture.version,
        fingerprintSha256: governedServicePackageFixture.servicePackageFingerprintSha256
      },
      selectionFingerprintSha256: '6'.repeat(64),
      selectedProvider: {
        providerId: 'provider_fixture-8431',
        providerWorkspaceId: '018f0000-0000-7000-8000-000000008431'
      },
      currentSelectionValidation: {
        purpose: 'CONTROLLED_HANDOFF_REVIEW',
        decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
        currentlyUsable: true,
        evaluatedAt: governedFixtureAt,
        validationPolicyVersion: 'mgsn-provider-selection-validation-v1',
        checkedAuthorityReferences: []
      }
    },
    currentSourceVersions: [],
    directExecutorAuthority: {
      disclosureState: 'INDEPENDENT_EVIDENCE_REFERENCED',
      directExecutorEstablished: true,
      finalExecutionProviderId: 'provider_fixture-8431',
      finalExecutionProviderWorkspaceId: '018f0000-0000-7000-8000-000000008431',
      authorityReference: 'mgsn-provider-responsibility:provider-responsibility_fixture-843',
      authorityVersion: 2,
      evidenceReferences: ['evidence:direct-executor:843'],
      checkedAt: governedFixtureAt,
      hiddenIntermediaryAllowed: false,
      onwardRecipientAuthorization: 'NONE'
    },
    currentAuthorityRevalidationRequiredBeforeAuthorize: true,
    currentAuthorityRevalidationRequiredBeforeConsumption: true,
    evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: true
  },
  reviewTuple: {
    originatingWorkspaceId: governedFixtureWorkspaceId,
    recipientProviderId: 'provider_fixture-8431',
    recipientProviderWorkspaceId: '018f0000-0000-7000-8000-000000008431',
    selection: {
      providerSelectionId: 'provider-selection_fixture-843',
      version: 1,
      scopeVersion: 1
    },
    purposeFingerprintSha256: '7'.repeat(64),
    projectionFingerprintSha256: '8'.repeat(64),
    sourceSetFingerprintSha256: '9'.repeat(64),
    previewFingerprintSha256: 'a'.repeat(64)
  },
  includedFields: [
    {
      dataClass: 'PROVIDER_REFERENCE',
      fieldPath: 'providerId',
      sourceOwner: 'MGSN',
      sourceReference: 'provider_fixture-8431',
      necessityReference: 'provider-routing'
    },
    {
      dataClass: 'PROVIDER_REFERENCE',
      fieldPath: 'displayName',
      sourceOwner: 'MGSN',
      sourceReference: 'provider_fixture-8431',
      necessityReference: 'human-review-label'
    },
    {
      dataClass: 'PROVIDER_EVIDENCE_REFERENCES',
      fieldPath: 'evidenceReferences',
      sourceOwner: 'MGSN',
      sourceReference: 'provider-supply-capability_fixture-8431',
      necessityReference: 'evidence-lineage-review'
    }
  ],
  excludedGenericDataClasses: projection.forbiddenGenericDataClasses,
  readyForExplicitHumanAcknowledgement: true
} as unknown as Readonly<ControlledHandoffPreparationResultV1>;

export const governedHandoffFixture = {
  schemaVersion: 1,
  mutation: 'AUTHORIZED',
  envelope: {
    schemaVersion: 1,
    controlledHandoffId: 'controlled-handoff_fixture-843',
    originatingWorkspaceId: governedFixtureWorkspaceId,
    recipient:
      governedPreparationFixture.status === 'READY_FOR_HUMAN_REVIEW'
        ? governedPreparationFixture.recipient
        : {},
    purpose:
      governedPreparationFixture.status === 'READY_FOR_HUMAN_REVIEW'
        ? governedPreparationFixture.purpose
        : {},
    authorizedProjection: projection,
    sourceLineage:
      governedPreparationFixture.status === 'READY_FOR_HUMAN_REVIEW'
        ? governedPreparationFixture.sourceLineage
        : {},
    trustedHumanAuthority: {},
    privacyPreviewAcknowledgement: {},
    authorizedAt: governedFixtureAt,
    validFrom: governedFixtureAt,
    validUntil: '2026-09-06T04:30:00.000Z',
    version: 1,
    correlationId: 'correlation_fixture-handoff-843',
    envelopeFingerprintSha256: 'b'.repeat(64),
    authorityConsequences: {},
    status: 'AUTHORIZED',
    revokedAt: null
  },
  replayed: false,
  replayDoesNotEstablishCurrentUsability: true,
  correlationId: 'correlation_fixture-handoff-843'
} as unknown as Readonly<ControlledHandoffMutationResultV1>;

export const governedHandoffValidationFixture = {
  schemaVersion: 1,
  envelope: { controlledHandoffId: 'controlled-handoff_fixture-843', version: 1 },
  purpose: 'HANDOFF_CONSUMPTION',
  attempt: {},
  evaluatedAt: governedFixtureAt,
  validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
  checkedAuthorityReferences: [],
  authorityConsequences: {},
  validationIsNotBearerCapability: true,
  validationDoesNotAuthorizeDownstreamAction: true,
  decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
  currentlyUsable: true,
  currentExactDisclosurePermitted: true,
  publicReason: 'Controlled Handoff is current for the exact reviewed disclosure.'
} as unknown as Readonly<ControlledHandoffCurrentValidationV1>;

export const governedEligibilityFixture = {
  schemaVersion: 1,
  eligibilityEvaluationId: 'eligibility-evaluation_fixture-843',
  workspaceId: governedFixtureWorkspaceId,
  servicePackage: {
    id: governedServicePackageFixture.servicePackageId,
    version: governedServicePackageFixture.version
  },
  providerSupplyCapability: {
    id: 'provider-supply-capability_fixture-8431',
    version: 7
  },
  outcome: 'ELIGIBLE',
  deterministicFingerprintSha256: 'c'.repeat(64),
  evaluatedAt: governedFixtureAt,
  version: 1
} as unknown as Readonly<EligibilityEvaluation>;

export const governedAllocationFixture = {
  requestFingerprintSha256: 'd'.repeat(64),
  allocation: {
    schemaVersion: 1,
    allocationId: 'allocation_fixture-843',
    workspaceId: governedFixtureWorkspaceId,
    servicePackage: {
      id: governedServicePackageFixture.servicePackageId,
      version: governedServicePackageFixture.version
    },
    eligibilityEvaluation: {
      id: 'eligibility-evaluation_fixture-843',
      version: 1
    },
    provider: {
      providerId: 'provider_fixture-8431',
      providerWorkspaceId: '018f0000-0000-7000-8000-000000008431'
    },
    providerSupplyCapability: {
      id: 'provider-supply-capability_fixture-8431',
      version: 7
    },
    status: 'OFFERED',
    allocatedByActorId: 'user_fixture-843',
    rationale: 'Governed provider routing.',
    allocatedAt: governedFixtureAt,
    version: 1
  },
  lineage: {
    allocationId: 'allocation_fixture-843',
    providerSelectionId: 'provider-selection_fixture-843',
    handoffBindingState: 'EXACT_CONTROLLED_HANDOFF',
    lineageFingerprintSha256: 'e'.repeat(64)
  }
} as unknown as Readonly<GovernedAllocationResult>;
