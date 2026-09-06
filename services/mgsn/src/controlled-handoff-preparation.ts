import {
  noControlledHandoffPreparationAuthorityConsequences,
  type ControlledHandoffPreparationDenialReason,
  type ControlledHandoffPreparationRequestV1,
  type ControlledHandoffPreparationResultV1
} from '@markorbit/contracts/controlled-handoff-preparation';
import {
  controlledHandoffForbiddenGenericDataClasses,
  type AuthorizedDataProjectionV1,
  type ControlledHandoffAuthorizedProjectionItemV1,
  type ControlledHandoffDirectExecutorAuthorityV1,
  type ControlledHandoffPurposeV1,
  type ControlledHandoffSourceLineageV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type { DiscoveryCurrentSourceVersionV1 } from '@markorbit/contracts/provider-discovery';
import type { NetworkParticipationRepository } from './network-participation.js';
import { providerDiscoveryFingerprint } from './provider-discovery.js';
import type { ProviderRegistryRepository } from './provider-registry.js';
import { isSupplyOperationallyEligibleAt } from './provider-registry.js';
import type { ProviderResponsibilityService } from './provider-responsibility.js';
import {
  ProviderSelectionError,
  providerSelectionFingerprint,
  type ProviderSelectionRepository,
  type ProviderSelectionService
} from './provider-selection.js';

const sha256Pattern = /^[0-9a-f]{64}$/u;
const publicLimitations = Object.freeze([
  'Privacy Preview contains authorization descriptors only; no private field values are embedded.',
  'Evidence-reference visibility does not authorize retrieval of an underlying evidence artifact.',
  'Selection, source and Direct Executor authority must be revalidated again before authorization and consumption.'
]);

export interface ControlledHandoffPreparationPrincipal {
  workspaceId: string;
}

export type ControlledHandoffPreparationSelectionSource = Pick<
  ProviderSelectionRepository,
  'findLatestSelection'
>;
export type ControlledHandoffPreparationNetworkSource = Pick<
  NetworkParticipationRepository,
  'findCurrentParticipation' | 'findCurrentVisibilityPolicy'
>;
export type ControlledHandoffPreparationProviderSource = Pick<
  ProviderRegistryRepository,
  'findProviderById' | 'findSupplyCapability'
>;
export type ControlledHandoffPreparationResponsibilitySource = Pick<
  ProviderResponsibilityService,
  'assessCurrent'
>;

export class ControlledHandoffPreparationError extends Error {
  constructor(
    readonly code: 'INVALID_INPUT',
    readonly status: 400 | 422,
    message: string
  ) {
    super(message);
    this.name = 'ControlledHandoffPreparationError';
  }
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      422,
      `${field} must be a non-empty value no longer than ${maximum} characters.`
    );
  return value.trim();
}

function instant(value: unknown, field: string): string {
  const normalized = text(value, field, 100);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      422,
      `${field} must be an ISO timestamp.`
    );
  return new Date(normalized).toISOString();
}

function exactScope(
  left: ControlledHandoffPreparationRequestV1['selectionScope'],
  right: ControlledHandoffPreparationRequestV1['selectionScope']
): boolean {
  return (
    left.owner === right.owner &&
    left.reference === right.reference &&
    left.version === right.version &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
}

function exactSelection(
  left: ControlledHandoffPreparationRequestV1['selection'],
  right: ControlledHandoffPreparationRequestV1['selection']
): boolean {
  return (
    left.providerSelectionId === right.providerSelectionId &&
    left.version === right.version &&
    left.scopeVersion === right.scopeVersion
  );
}

function sourceVersion(
  sourceType: string,
  sourceId: string,
  version: number | string,
  fingerprintSha256: string,
  checkedAt: string
): DiscoveryCurrentSourceVersionV1 & { fingerprintSha256: string } {
  return {
    owner: 'MGSN',
    sourceType,
    sourceId,
    version,
    fingerprintSha256,
    checkedAt,
    authorityState: 'CURRENT'
  };
}

function providerFingerprint(provider: {
  providerId: string;
  providerWorkspaceId: string;
  operationalStatus: string;
  version: number;
  updatedAt: string;
}): string {
  return providerDiscoveryFingerprint({
    providerId: provider.providerId,
    providerWorkspaceId: provider.providerWorkspaceId,
    operationalStatus: provider.operationalStatus,
    version: provider.version,
    updatedAt: provider.updatedAt
  });
}

function participationFingerprint(participation: {
  networkParticipationId: string;
  version: number;
  state: string;
  occurredAt: string;
}): string {
  return providerDiscoveryFingerprint({
    networkParticipationId: participation.networkParticipationId,
    participationVersion: participation.version,
    state: participation.state,
    occurredAt: participation.occurredAt
  });
}

function visibilityFingerprint(policy: {
  networkParticipationId: string;
  version: number;
  scope: string;
  updatedAt: string;
}): string {
  return providerDiscoveryFingerprint({
    networkParticipationId: policy.networkParticipationId,
    version: policy.version,
    scope: policy.scope,
    updatedAt: policy.updatedAt
  });
}

function denied(
  request: ControlledHandoffPreparationRequestV1,
  evaluatedAt: string,
  denialReason: ControlledHandoffPreparationDenialReason,
  publicReason: string,
  checkedAuthorityReferences: readonly string[] = []
): ControlledHandoffPreparationResultV1 {
  return {
    schemaVersion: 1,
    status: 'DENIED',
    selection: request.selection,
    evaluatedAt,
    checkedAuthorityReferences: [...new Set(checkedAuthorityReferences)].sort(),
    publicLimitations,
    correlationId: request.correlationId,
    previewIsNotAuthorization: true,
    resultIsNotBearerCapability: true,
    authorityConsequences: noControlledHandoffPreparationAuthorityConsequences,
    denialReason,
    publicReason,
    readyForExplicitHumanAcknowledgement: false
  };
}

function unavailable(
  request: ControlledHandoffPreparationRequestV1,
  evaluatedAt: string,
  checkedAuthorityReferences: readonly string[] = []
): ControlledHandoffPreparationResultV1 {
  return {
    schemaVersion: 1,
    status: 'SOURCE_UNAVAILABLE',
    selection: request.selection,
    evaluatedAt,
    checkedAuthorityReferences: [...new Set(checkedAuthorityReferences)].sort(),
    publicLimitations,
    correlationId: request.correlationId,
    previewIsNotAuthorization: true,
    resultIsNotBearerCapability: true,
    authorityConsequences: noControlledHandoffPreparationAuthorityConsequences,
    publicReason: 'Current authority required for Privacy Preview cannot be verified.',
    retryable: true,
    readyForExplicitHumanAcknowledgement: false
  };
}

function validateRequest(request: ControlledHandoffPreparationRequestV1): string {
  if (request.schemaVersion !== 1)
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      400,
      'Unsupported Controlled Handoff Preparation schema version.'
    );
  text(request.selection.providerSelectionId, 'selection.providerSelectionId', 200);
  if (
    !Number.isInteger(request.selection.version) ||
    request.selection.version < 1 ||
    !Number.isInteger(request.selection.scopeVersion) ||
    request.selection.scopeVersion < 1
  )
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      422,
      'Selection version references must be positive integers.'
    );
  text(request.selectionScope.owner, 'selectionScope.owner', 100);
  text(request.selectionScope.reference, 'selectionScope.reference');
  if (!sha256Pattern.test(request.selectionScope.fingerprintSha256))
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      422,
      'selectionScope.fingerprintSha256 must be a lowercase SHA-256 value.'
    );
  text(request.purpose.code, 'purpose.code', 100);
  text(request.purpose.contextReference, 'purpose.contextReference');
  text(request.purpose.instructionReference, 'purpose.instructionReference');
  const requestedFields: unknown = request.requestedFields;
  if (!Array.isArray(requestedFields) || requestedFields.length === 0)
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      422,
      'At least one bounded disclosure descriptor is required.'
    );
  if (requestedFields.length > 100)
    throw new ControlledHandoffPreparationError(
      'INVALID_INPUT',
      422,
      'Too many disclosure descriptors were requested.'
    );
  for (const rawField of requestedFields) {
    if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField))
      throw new ControlledHandoffPreparationError(
        'INVALID_INPUT',
        422,
        'Each disclosure descriptor must be an object.'
      );
    const field = rawField as Record<string, unknown>;
    text(field.dataClass, 'requestedFields.dataClass', 100);
    const fieldPath = text(field.fieldPath, 'requestedFields.fieldPath');
    if (fieldPath.includes('*'))
      throw new ControlledHandoffPreparationError(
        'INVALID_INPUT',
        422,
        'Wildcard disclosure paths are not permitted.'
      );
    text(field.sourceOwner, 'requestedFields.sourceOwner', 100);
    text(field.sourceReference, 'requestedFields.sourceReference');
    text(field.necessityReference, 'requestedFields.necessityReference');
  }
  return instant(request.checkedAt, 'checkedAt');
}

function directExecutorAuthority(
  assessment: Exclude<
    NonNullable<Awaited<ReturnType<ProviderResponsibilityService['assessCurrent']>>['assessment']>,
    { directExecutorEstablished: false }
  >
): ControlledHandoffDirectExecutorAuthorityV1 {
  const signer = assessment.legallyRequiredDistinctSigner;
  return {
    disclosureState: 'INDEPENDENT_EVIDENCE_REFERENCED',
    directExecutorEstablished: true,
    finalExecutionProviderId: assessment.finalExecutionProviderId,
    finalExecutionProviderWorkspaceId: assessment.finalExecutionProviderWorkspaceId,
    authorityReference: `mgsn-provider-responsibility:${assessment.profile.providerResponsibilityProfileId}`,
    authorityVersion: assessment.profile.version,
    evidenceReferences: assessment.evidenceReferences,
    checkedAt: assessment.checkedAt,
    hiddenIntermediaryAllowed: false,
    onwardRecipientAuthorization: 'NONE',
    ...(signer.kind === 'REQUIRED'
      ? {
          legallyRequiredDistinctSigner: {
            signerReference: signer.signerReference,
            legalBasisReference: signer.legalBasisReference,
            transparentlyDisclosed: true,
            receivesHandoffDataByDefault: false
          }
        }
      : {})
  };
}

function purposeFor(request: ControlledHandoffPreparationRequestV1): ControlledHandoffPurposeV1 {
  const purposeFingerprintSha256 = providerDiscoveryFingerprint({
    code: request.purpose.code,
    contextReference: request.purpose.contextReference,
    instructionReference: request.purpose.instructionReference,
    unrestrictedPurposeAllowed: false
  });
  return {
    ...request.purpose,
    purposeFingerprintSha256,
    unrestrictedPurposeAllowed: false
  };
}

export class ControlledHandoffPreparationService {
  constructor(
    private readonly selections: ControlledHandoffPreparationSelectionSource,
    private readonly selectionService: Pick<ProviderSelectionService, 'validateCurrent'>,
    private readonly network: ControlledHandoffPreparationNetworkSource,
    private readonly providers: ControlledHandoffPreparationProviderSource,
    private readonly responsibility: ControlledHandoffPreparationResponsibilitySource,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async prepare(
    principal: ControlledHandoffPreparationPrincipal,
    request: ControlledHandoffPreparationRequestV1
  ): Promise<ControlledHandoffPreparationResultV1> {
    const checkedAt = validateRequest(request);
    const evaluatedAt = this.now();
    const workspaceId = text(principal.workspaceId, 'principal.workspaceId', 100).toLowerCase();

    let selection: Awaited<ReturnType<ProviderSelectionRepository['findLatestSelection']>>;
    try {
      selection = await this.selections.findLatestSelection(request.selection.providerSelectionId);
    } catch {
      return unavailable(request, evaluatedAt);
    }
    if (
      !selection ||
      selection.requesterWorkspaceId.toLowerCase() !== workspaceId ||
      selection.status !== 'CURRENT' ||
      selection.version !== request.selection.version ||
      selection.scopeVersion !== request.selection.scopeVersion ||
      !exactScope(selection.scope, request.selectionScope)
    )
      return denied(
        request,
        evaluatedAt,
        'SELECTION_NOT_CURRENT',
        'The reviewed Provider Selection is no longer current for this Workspace.'
      );

    let validation: Awaited<ReturnType<ProviderSelectionService['validateCurrent']>>;
    try {
      validation = await this.selectionService.validateCurrent(
        { workspaceId },
        {
          scope: request.selectionScope,
          providerSelectionId: request.selection.providerSelectionId,
          purpose: 'CONTROLLED_HANDOFF_REVIEW',
          checkedAt
        }
      );
    } catch (error) {
      if (error instanceof ProviderSelectionError && error.code !== 'AUTHORITY_UNAVAILABLE')
        return denied(
          request,
          evaluatedAt,
          'SELECTION_NOT_CURRENT',
          'The reviewed Provider Selection is no longer current for bounded Handoff review.'
        );
      return unavailable(request, evaluatedAt);
    }
    if (validation.decision !== 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW') {
      if (validation.denialReason === 'AUTHORITY_UNAVAILABLE')
        return unavailable(request, evaluatedAt, validation.checkedAuthorityReferences);
      return denied(
        request,
        evaluatedAt,
        validation.denialReason === 'SELECTION_SUPERSEDED' ||
          validation.denialReason === 'SELECTION_REVOKED' ||
          validation.denialReason === 'STALE_CANDIDATE'
          ? 'SELECTION_NOT_CURRENT'
          : 'OTHER_CURRENT_AUTHORITY_DENIED',
        validation.publicReason,
        validation.checkedAuthorityReferences
      );
    }
    if (
      !exactSelection(validation.selection, request.selection) ||
      !exactScope(validation.scope, request.selectionScope)
    )
      return denied(
        request,
        evaluatedAt,
        'SELECTION_SCOPE_MISMATCH',
        'The current Selection does not match the exact reviewed scope.',
        validation.checkedAuthorityReferences
      );

    const selectedProvider = selection.sourceLineage.provider;
    const selectedSupply = selection.sourceLineage.providerSupplyCapability;
    try {
      const [provider, supply, participation, responsibilityResult] = await Promise.all([
        this.providers.findProviderById(selectedProvider.providerId),
        this.providers.findSupplyCapability(selectedSupply.id),
        this.network.findCurrentParticipation(
          selectedProvider.providerWorkspaceId,
          selectedProvider.providerId
        ),
        this.responsibility.assessCurrent(
          selectedProvider.providerId,
          selectedProvider.providerWorkspaceId,
          checkedAt
        )
      ]);
      if (!provider || !supply || !participation)
        return denied(
          request,
          evaluatedAt,
          'OTHER_CURRENT_AUTHORITY_DENIED',
          'Current Provider network authority is not available for bounded Handoff review.',
          validation.checkedAuthorityReferences
        );
      const visibility = await this.network.findCurrentVisibilityPolicy(
        participation.networkParticipationId
      );
      if (!visibility)
        return denied(
          request,
          evaluatedAt,
          'VISIBILITY_NO_LONGER_AUTHORIZED',
          'Current Provider visibility does not authorize this review.',
          validation.checkedAuthorityReferences
        );
      if (participation.state !== 'ACTIVE')
        return denied(
          request,
          evaluatedAt,
          'PARTICIPATION_NOT_ACTIVE',
          'Current Provider network participation is not active.',
          validation.checkedAuthorityReferences
        );
      if (visibility.scope === 'PRIVATE')
        return denied(
          request,
          evaluatedAt,
          'VISIBILITY_NO_LONGER_AUTHORIZED',
          'Current Provider visibility does not authorize this review.',
          validation.checkedAuthorityReferences
        );
      if (
        provider.providerWorkspaceId.toLowerCase() !==
          selectedProvider.providerWorkspaceId.toLowerCase() ||
        provider.providerId !== selectedProvider.providerId ||
        supply.provider.providerId !== selectedProvider.providerId ||
        supply.provider.providerWorkspaceId.toLowerCase() !==
          selectedProvider.providerWorkspaceId.toLowerCase() ||
        supply.verificationState !== 'VERIFIED_FOR_SUPPLY' ||
        !isSupplyOperationallyEligibleAt(provider, supply, checkedAt)
      )
        return denied(
          request,
          evaluatedAt,
          'OTHER_CURRENT_AUTHORITY_DENIED',
          'Current Provider or Supply authority no longer supports this bounded review.',
          validation.checkedAuthorityReferences
        );

      const assessment = responsibilityResult.assessment;
      if (responsibilityResult.state === 'AUTHORITY_UNAVAILABLE')
        return unavailable(request, evaluatedAt, validation.checkedAuthorityReferences);
      if (
        !assessment ||
        assessment.directExecutorEstablished !== true ||
        assessment.profileAuthorityState !== 'CURRENT' ||
        assessment.finalExecutionProviderId !== selectedProvider.providerId ||
        assessment.finalExecutionProviderWorkspaceId.toLowerCase() !==
          selectedProvider.providerWorkspaceId.toLowerCase()
      ) {
        const hidden = responsibilityResult.state === 'REBROKERING_OR_SUBAGENT_DISCLOSED';
        return denied(
          request,
          evaluatedAt,
          hidden ? 'HIDDEN_INTERMEDIARY_DETECTED' : 'DIRECT_EXECUTOR_NOT_ESTABLISHED',
          assessment && 'publicReason' in assessment
            ? assessment.publicReason
            : 'Current Direct Executor responsibility is not established.',
          validation.checkedAuthorityReferences
        );
      }

      const providerSource = sourceVersion(
        'PROVIDER',
        provider.providerId,
        provider.version,
        providerFingerprint(provider),
        checkedAt
      );
      const supplySource = sourceVersion(
        'PROVIDER_SUPPLY_CAPABILITY',
        supply.providerSupplyCapabilityId,
        supply.version,
        supply.sourceFingerprintSha256,
        checkedAt
      );
      const participationSource = sourceVersion(
        'NETWORK_PARTICIPATION',
        participation.networkParticipationId,
        participation.version,
        participationFingerprint(participation),
        checkedAt
      );
      const visibilitySource = sourceVersion(
        'NETWORK_VISIBILITY_POLICY',
        visibility.networkParticipationId,
        visibility.version,
        visibilityFingerprint(visibility),
        checkedAt
      );
      const responsibilitySource = sourceVersion(
        'PROVIDER_RESPONSIBILITY_PROFILE',
        assessment.profile.providerResponsibilityProfileId,
        assessment.profile.version,
        assessment.profile.profileFingerprintSha256,
        checkedAt
      );
      const currentSourceVersions = [
        providerSource,
        supplySource,
        participationSource,
        visibilitySource,
        responsibilitySource
      ];
      const projectionItems: ControlledHandoffAuthorizedProjectionItemV1[] = [];
      for (const requested of request.requestedFields) {
        const providerField =
          requested.dataClass === 'PROVIDER_REFERENCE' &&
          requested.sourceOwner === 'MGSN' &&
          requested.sourceReference === provider.providerId &&
          ['providerId', 'providerWorkspaceId', 'displayName'].includes(requested.fieldPath);
        const evidenceField =
          requested.dataClass === 'PROVIDER_EVIDENCE_REFERENCES' &&
          requested.sourceOwner === 'MGSN' &&
          requested.sourceReference === supply.providerSupplyCapabilityId &&
          requested.fieldPath === 'evidenceReferences';
        if (!providerField && !evidenceField)
          return denied(
            request,
            evaluatedAt,
            'REQUESTED_FIELD_NOT_AUTHORIZED',
            'One or more requested disclosure descriptors are not currently source-authorized by MGSN.',
            validation.checkedAuthorityReferences
          );
        const source = providerField ? providerSource : supplySource;
        projectionItems.push({
          dataClass: requested.dataClass,
          fieldPath: requested.fieldPath,
          sourceOwner: 'MGSN',
          sourceReference: source.sourceId,
          sourceVersion: source.version,
          sourceFingerprintSha256: source.fingerprintSha256,
          necessityReference: requested.necessityReference,
          requested: true,
          authorizedBySourceOwner: true,
          minimumNecessary: true,
          fieldValueEmbeddedInEnvelope: false,
          evidenceArtifactRetrievalAuthority:
            requested.dataClass === 'PROVIDER_EVIDENCE_REFERENCES'
              ? 'SEPARATE_AUTHORITY_REQUIRED'
              : 'NOT_APPLICABLE'
        });
      }
      const normalizedItems = [...projectionItems].sort((left, right) =>
        providerDiscoveryFingerprint(left).localeCompare(providerDiscoveryFingerprint(right))
      );
      const sourceSetFingerprintSha256 = providerDiscoveryFingerprint(currentSourceVersions);
      const projectionFingerprintSha256 = providerDiscoveryFingerprint({
        schemaVersion: 1,
        items: normalizedItems,
        sourceSetFingerprintSha256,
        wildcardAllowed: false,
        wholeRecordAllowed: false,
        implicitFieldExpansionAllowed: false,
        fieldValuesEmbeddedInEnvelope: false,
        requestedAuthorizedMinimumNecessaryIntersectionRequired: true,
        forbiddenGenericDataClasses: controlledHandoffForbiddenGenericDataClasses
      });
      const authorizedProjection: AuthorizedDataProjectionV1 = {
        schemaVersion: 1,
        items: normalizedItems,
        projectionFingerprintSha256,
        sourceSetFingerprintSha256,
        wildcardAllowed: false,
        wholeRecordAllowed: false,
        implicitFieldExpansionAllowed: false,
        fieldValuesEmbeddedInEnvelope: false,
        requestedAuthorizedMinimumNecessaryIntersectionRequired: true,
        forbiddenGenericDataClasses: controlledHandoffForbiddenGenericDataClasses
      };
      const purpose = purposeFor(request);
      const sourceLineage: ControlledHandoffSourceLineageV1 = {
        selectionLineage: {
          selection: request.selection,
          selectionScope: request.selectionScope,
          selectionFingerprintSha256: providerSelectionFingerprint(selection),
          selectedProvider: {
            providerId: selectedProvider.providerId,
            providerWorkspaceId: selectedProvider.providerWorkspaceId
          },
          currentSelectionValidation: {
            purpose: 'CONTROLLED_HANDOFF_REVIEW',
            decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
            currentlyUsable: true,
            evaluatedAt: validation.evaluatedAt,
            validationPolicyVersion: validation.validationPolicyVersion,
            checkedAuthorityReferences: validation.checkedAuthorityReferences
          }
        },
        currentSourceVersions,
        directExecutorAuthority: directExecutorAuthority(assessment),
        currentAuthorityRevalidationRequiredBeforeAuthorize: true,
        currentAuthorityRevalidationRequiredBeforeConsumption: true,
        evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: true
      };
      const reviewTupleWithoutPreview = {
        originatingWorkspaceId: workspaceId,
        recipientProviderId: selectedProvider.providerId,
        recipientProviderWorkspaceId: selectedProvider.providerWorkspaceId,
        selection: request.selection,
        purposeFingerprintSha256: purpose.purposeFingerprintSha256,
        projectionFingerprintSha256,
        sourceSetFingerprintSha256
      };
      const previewFingerprintSha256 = providerDiscoveryFingerprint(reviewTupleWithoutPreview);
      const checkedAuthorityReferences = [
        ...validation.checkedAuthorityReferences,
        `mgsn-provider:${provider.providerId}:v${provider.version}`,
        `mgsn-provider-supply:${supply.providerSupplyCapabilityId}:v${supply.version}:${supply.sourceFingerprintSha256}`,
        `mgsn-network-participation:${participation.networkParticipationId}:v${participation.version}`,
        `mgsn-network-visibility:${visibility.networkParticipationId}:v${visibility.version}`,
        `mgsn-provider-responsibility:${assessment.profile.providerResponsibilityProfileId}:v${assessment.profile.version}:${assessment.profile.profileFingerprintSha256}`
      ];
      return {
        schemaVersion: 1,
        status: 'READY_FOR_HUMAN_REVIEW',
        selection: request.selection,
        evaluatedAt,
        checkedAuthorityReferences: [...new Set(checkedAuthorityReferences)].sort(),
        publicLimitations,
        correlationId: request.correlationId,
        previewIsNotAuthorization: true,
        resultIsNotBearerCapability: true,
        authorityConsequences: noControlledHandoffPreparationAuthorityConsequences,
        recipient: {
          providerId: selectedProvider.providerId,
          providerWorkspaceId: selectedProvider.providerWorkspaceId,
          role: 'FINAL_EXECUTION_PROVIDER'
        },
        purpose,
        authorizedProjection,
        sourceLineage,
        reviewTuple: {
          ...reviewTupleWithoutPreview,
          previewFingerprintSha256
        },
        includedFields: normalizedItems.map((item) => ({
          dataClass: item.dataClass,
          fieldPath: item.fieldPath,
          sourceOwner: item.sourceOwner,
          sourceReference: item.sourceReference,
          necessityReference: item.necessityReference
        })),
        excludedGenericDataClasses: controlledHandoffForbiddenGenericDataClasses,
        readyForExplicitHumanAcknowledgement: true
      };
    } catch {
      return unavailable(request, evaluatedAt, validation.checkedAuthorityReferences);
    }
  }
}
