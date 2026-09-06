import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  AuthorizeOrReplaceControlledHandoffCommandV1,
  ControlledHandoffConsumptionAttemptV1,
  ControlledHandoffId,
  ControlledHandoffValidationPurpose,
  RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  EligibilityEvaluationId,
  ProviderId,
  ProviderSupplyCapabilityId,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ControlledHandoffError,
  type ControlledHandoffPrincipal,
  type ControlledPrivacyHandoffService
} from './controlled-privacy-handoff.js';
import {
  GovernedAllocationError,
  type GovernedAllocationCommand,
  type GovernedAllocationService
} from './governed-allocation.js';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { createMgsnProviderDiscoveryHttpRoutes } from './governed-network-discovery-http.js';
import {
  assertExactTransportShape,
  bodyOf,
  enumArray,
  markOrbitId,
  optionalString,
  objectOf,
  parsedArray,
  positiveInteger,
  prefixedId,
  rejectTopLevelAuthority,
  requireIdempotency,
  requiredEnum,
  requiredLiteral,
  requiredString,
  sha256,
  stringArray,
  timestamp,
  trustedWorkspacePrincipalFor,
  versionValue,
  workspaceUuid,
  type Body,
  type TransportShape
} from './governed-network-http-boundary.js';
import {
  parseHumanActionEnvelope,
  type MgsnGovernedHumanActionEnvelopeV1
} from './governed-network-human-action.js';
import {
  createMgsnProviderSelectionHttpRoutes,
  currentSourceVersionTransportShape,
  parseCurrentSourceVersion,
  parseSelectionScope,
  parseSelectionVersionReference,
  providerSelectionVersionReferenceTransportShape,
  selectionScopeTransportShape
} from './governed-network-selection-http.js';
import type { ProviderSelectionService } from './provider-selection.js';

export {
  MGSN_GOVERNED_HUMAN_ACTION_HEADER,
  type MgsnGovernedHumanActionEnvelopeV1,
  type MgsnGovernedHumanActionKind
} from './governed-network-human-action.js';

export interface MgsnGovernedNetworkHttpServices {
  providerDiscovery: Pick<ProviderDiscoveryCurrentResponsibilityService, 'evaluate'>;
  providerSelection: Pick<
    ProviderSelectionService,
    'createOrReplace' | 'revoke' | 'validateCurrent'
  >;
  controlledHandoff: Pick<
    ControlledPrivacyHandoffService,
    'authorizeOrReplace' | 'revoke' | 'validateCurrent'
  >;
  governedAllocation: Pick<GovernedAllocationService, 'allocate'>;
}

export interface MgsnGovernedNetworkHttpOptions {
  internalServiceSecret?: string;
  services?: MgsnGovernedNetworkHttpServices;
}

const controlledHandoffVersionReferenceTransportShape = {
  controlledHandoffId: null,
  version: null
} satisfies TransportShape;

const controlledHandoffSelectionLineageTransportShape = {
  selection: providerSelectionVersionReferenceTransportShape,
  selectionScope: selectionScopeTransportShape,
  selectionFingerprintSha256: null,
  selectedProvider: {
    providerId: null,
    providerWorkspaceId: null
  },
  currentSelectionValidation: {
    purpose: null,
    decision: null,
    currentlyUsable: null,
    evaluatedAt: null,
    validationPolicyVersion: null,
    checkedAuthorityReferences: null
  }
} satisfies TransportShape;

const controlledHandoffDirectExecutorTransportShape = {
  disclosureState: null,
  directExecutorEstablished: null,
  finalExecutionProviderId: null,
  finalExecutionProviderWorkspaceId: null,
  authorityReference: null,
  authorityVersion: null,
  evidenceReferences: null,
  checkedAt: null,
  hiddenIntermediaryAllowed: null,
  onwardRecipientAuthorization: null,
  legallyRequiredDistinctSigner: {
    signerReference: null,
    legalBasisReference: null,
    transparentlyDisclosed: null,
    receivesHandoffDataByDefault: null
  }
} satisfies TransportShape;

const controlledHandoffSourceLineageTransportShape = {
  selectionLineage: controlledHandoffSelectionLineageTransportShape,
  currentSourceVersions: [currentSourceVersionTransportShape],
  directExecutorAuthority: controlledHandoffDirectExecutorTransportShape,
  currentAuthorityRevalidationRequiredBeforeAuthorize: null,
  currentAuthorityRevalidationRequiredBeforeConsumption: null,
  evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: null
} satisfies TransportShape;

const controlledHandoffProjectionTransportShape = {
  schemaVersion: null,
  items: [
    {
      dataClass: null,
      fieldPath: null,
      sourceOwner: null,
      sourceReference: null,
      sourceVersion: null,
      sourceFingerprintSha256: null,
      necessityReference: null,
      requested: null,
      authorizedBySourceOwner: null,
      minimumNecessary: null,
      fieldValueEmbeddedInEnvelope: null,
      evidenceArtifactRetrievalAuthority: null
    }
  ],
  projectionFingerprintSha256: null,
  sourceSetFingerprintSha256: null,
  wildcardAllowed: null,
  wholeRecordAllowed: null,
  implicitFieldExpansionAllowed: null,
  fieldValuesEmbeddedInEnvelope: null,
  requestedAuthorizedMinimumNecessaryIntersectionRequired: null,
  forbiddenGenericDataClasses: null
} satisfies TransportShape;

const controlledHandoffPrivacyPreviewTransportShape = {
  affirmativeHumanAction: null,
  acknowledgementCode: null,
  acknowledgementTextVersion: null,
  originatingWorkspaceId: null,
  recipientProviderId: null,
  recipientProviderWorkspaceId: null,
  selection: providerSelectionVersionReferenceTransportShape,
  purposeFingerprintSha256: null,
  projectionFingerprintSha256: null,
  sourceSetFingerprintSha256: null,
  previewFingerprintSha256: null,
  reviewedAt: null
} satisfies TransportShape;

const controlledHandoffAuthorizeTransportShape = {
  schemaVersion: null,
  recipient: {
    providerId: null,
    providerWorkspaceId: null,
    role: null
  },
  purpose: {
    code: null,
    contextReference: null,
    instructionReference: null,
    purposeFingerprintSha256: null,
    unrestrictedPurposeAllowed: null
  },
  authorizedProjection: controlledHandoffProjectionTransportShape,
  sourceLineage: controlledHandoffSourceLineageTransportShape,
  privacyPreviewAcknowledgement: controlledHandoffPrivacyPreviewTransportShape,
  validFrom: null,
  validUntil: null,
  expectedCurrent: {
    kind: null,
    controlledHandoffId: null,
    version: null
  },
  idempotencyKey: null,
  commandFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

const controlledHandoffRevokeTransportShape = {
  schemaVersion: null,
  target: controlledHandoffVersionReferenceTransportShape,
  reasonCode: null,
  rationale: null,
  idempotencyKey: null,
  commandFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

const controlledHandoffValidationTransportShape = {
  envelope: {
    version: null
  },
  purpose: null,
  attempt: {
    recipientProviderId: null,
    recipientProviderWorkspaceId: null,
    purposeFingerprintSha256: null,
    projectionFingerprintSha256: null,
    sourceSetFingerprintSha256: null,
    artifactRetrievalRequested: null,
    attemptedAt: null,
    correlationId: null
  }
} satisfies TransportShape;

const governedAllocationTransportShape = {
  servicePackageId: null,
  expectedServicePackageVersion: null,
  expectedServicePackageFingerprintSha256: null,
  eligibilityEvaluationId: null,
  expectedEligibilityEvaluationVersion: null,
  expectedEligibilityFingerprintSha256: null,
  providerId: null,
  providerSupplyCapabilityId: null,
  expectedProviderSupplyCapabilityVersion: null,
  rationale: null,
  selection: {
    providerSelectionId: null,
    version: null,
    scopeVersion: null
  },
  selectionScope: selectionScopeTransportShape,
  handoffBinding: {
    mode: null,
    handoff: {
      controlledHandoffId: null,
      version: null
    },
    envelopeFingerprintSha256: null,
    purposeFingerprintSha256: null,
    projectionFingerprintSha256: null,
    sourceSetFingerprintSha256: null
  },
  idempotencyKey: null,
  correlationId: null
} satisfies TransportShape;

function handoffPrincipal(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): ControlledHandoffPrincipal {
  return {
    workspaceId: principal.workspaceId,
    actorId: principal.userId,
    actorKind: 'HUMAN_USER',
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    handoffAuthorityReference: envelope.authorityReference,
    handoffAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference
  };
}

function handoffAuthority(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): AuthorizeOrReplaceControlledHandoffCommandV1['trustedHumanAuthority'] {
  return {
    source: 'CORE_WORKSPACE_PRINCIPAL',
    originatingWorkspaceId: principal.workspaceId,
    authorizingActorId: principal.userId,
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    handoffAuthorityReference: envelope.authorityReference,
    handoffAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference,
    payloadIdentityAuthoritative: false
  };
}

function parseHandoffSelectionLineage(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['sourceLineage']['selectionLineage'] {
  const lineage = objectOf(value, field);
  const selectedProvider = objectOf(lineage.selectedProvider, `${field}.selectedProvider`);
  const validation = objectOf(
    lineage.currentSelectionValidation,
    `${field}.currentSelectionValidation`
  );
  return {
    selection: parseSelectionVersionReference(lineage.selection, `${field}.selection`),
    selectionScope: parseSelectionScope(lineage.selectionScope, `${field}.selectionScope`),
    selectionFingerprintSha256: sha256(
      lineage.selectionFingerprintSha256,
      `${field}.selectionFingerprintSha256`
    ),
    selectedProvider: {
      providerId: prefixedId<ProviderId>(
        selectedProvider.providerId,
        'provider_',
        `${field}.selectedProvider.providerId`
      ),
      providerWorkspaceId: workspaceUuid(
        selectedProvider.providerWorkspaceId,
        `${field}.selectedProvider.providerWorkspaceId`
      )
    },
    currentSelectionValidation: {
      purpose: requiredLiteral(
        validation.purpose,
        'CONTROLLED_HANDOFF_REVIEW',
        `${field}.currentSelectionValidation.purpose`
      ),
      decision: requiredLiteral(
        validation.decision,
        'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
        `${field}.currentSelectionValidation.decision`
      ),
      currentlyUsable: requiredLiteral(
        validation.currentlyUsable,
        true,
        `${field}.currentSelectionValidation.currentlyUsable`
      ),
      evaluatedAt: timestamp(
        validation.evaluatedAt,
        `${field}.currentSelectionValidation.evaluatedAt`
      ),
      validationPolicyVersion: requiredString(
        validation.validationPolicyVersion,
        `${field}.currentSelectionValidation.validationPolicyVersion`,
        200
      ),
      checkedAuthorityReferences: stringArray(
        validation.checkedAuthorityReferences,
        `${field}.currentSelectionValidation.checkedAuthorityReferences`
      )
    }
  };
}

function parseHandoffDirectExecutorAuthority(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['sourceLineage']['directExecutorAuthority'] {
  const authority = objectOf(value, field);
  const signer =
    authority.legallyRequiredDistinctSigner === undefined
      ? undefined
      : objectOf(authority.legallyRequiredDistinctSigner, `${field}.legallyRequiredDistinctSigner`);
  return {
    disclosureState: requiredLiteral(
      authority.disclosureState,
      'INDEPENDENT_EVIDENCE_REFERENCED',
      `${field}.disclosureState`
    ),
    directExecutorEstablished: requiredLiteral(
      authority.directExecutorEstablished,
      true,
      `${field}.directExecutorEstablished`
    ),
    finalExecutionProviderId: prefixedId<ProviderId>(
      authority.finalExecutionProviderId,
      'provider_',
      `${field}.finalExecutionProviderId`
    ),
    finalExecutionProviderWorkspaceId: workspaceUuid(
      authority.finalExecutionProviderWorkspaceId,
      `${field}.finalExecutionProviderWorkspaceId`
    ),
    authorityReference: requiredString(
      authority.authorityReference,
      `${field}.authorityReference`,
      200
    ),
    authorityVersion: versionValue(authority.authorityVersion, `${field}.authorityVersion`),
    evidenceReferences: stringArray(authority.evidenceReferences, `${field}.evidenceReferences`),
    checkedAt: timestamp(authority.checkedAt, `${field}.checkedAt`),
    hiddenIntermediaryAllowed: requiredLiteral(
      authority.hiddenIntermediaryAllowed,
      false,
      `${field}.hiddenIntermediaryAllowed`
    ),
    onwardRecipientAuthorization: requiredLiteral(
      authority.onwardRecipientAuthorization,
      'NONE',
      `${field}.onwardRecipientAuthorization`
    ),
    ...(signer
      ? {
          legallyRequiredDistinctSigner: {
            signerReference: requiredString(
              signer.signerReference,
              `${field}.legallyRequiredDistinctSigner.signerReference`,
              200
            ),
            legalBasisReference: requiredString(
              signer.legalBasisReference,
              `${field}.legallyRequiredDistinctSigner.legalBasisReference`,
              200
            ),
            transparentlyDisclosed: requiredLiteral(
              signer.transparentlyDisclosed,
              true,
              `${field}.legallyRequiredDistinctSigner.transparentlyDisclosed`
            ),
            receivesHandoffDataByDefault: requiredLiteral(
              signer.receivesHandoffDataByDefault,
              false,
              `${field}.legallyRequiredDistinctSigner.receivesHandoffDataByDefault`
            )
          }
        }
      : {})
  };
}

function parseHandoffSourceLineage(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['sourceLineage'] {
  const lineage = objectOf(value, field);
  return {
    selectionLineage: parseHandoffSelectionLineage(
      lineage.selectionLineage,
      `${field}.selectionLineage`
    ),
    currentSourceVersions: parsedArray(
      lineage.currentSourceVersions,
      `${field}.currentSourceVersions`,
      parseCurrentSourceVersion
    ),
    directExecutorAuthority: parseHandoffDirectExecutorAuthority(
      lineage.directExecutorAuthority,
      `${field}.directExecutorAuthority`
    ),
    currentAuthorityRevalidationRequiredBeforeAuthorize: requiredLiteral(
      lineage.currentAuthorityRevalidationRequiredBeforeAuthorize,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeAuthorize`
    ),
    currentAuthorityRevalidationRequiredBeforeConsumption: requiredLiteral(
      lineage.currentAuthorityRevalidationRequiredBeforeConsumption,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeConsumption`
    ),
    evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: requiredLiteral(
      lineage.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval,
      true,
      `${field}.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval`
    )
  };
}

function parseHandoffProjection(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['authorizedProjection'] {
  const projection = objectOf(value, field);
  return {
    schemaVersion: requiredLiteral(projection.schemaVersion, 1, `${field}.schemaVersion`),
    items: parsedArray(projection.items, `${field}.items`, (itemValue, itemField) => {
      const item = objectOf(itemValue, itemField);
      return {
        dataClass: requiredEnum(
          item.dataClass,
          [
            'ORIGINATING_WORKSPACE_REFERENCE',
            'PROVIDER_REFERENCE',
            'NEED_WORK_PACKAGE_REFERENCE',
            'APPLICANT_OWNER_OFFICIAL_DATA',
            'TRADEMARK_MATTER_MINIMUM_WORKING_DATA',
            'PROVIDER_EVIDENCE_REFERENCES',
            'PROFESSIONAL_INSTRUCTION_FIELDS'
          ] as const,
          `${itemField}.dataClass`
        ),
        fieldPath: requiredString(item.fieldPath, `${itemField}.fieldPath`, 500),
        sourceOwner: requiredEnum(
          item.sourceOwner,
          [
            'CORE',
            'LITE',
            'MARKREG',
            'MGSN',
            'EXECUTION',
            'KNOWLEDGE',
            'OTHER_CANONICAL_OWNER'
          ] as const,
          `${itemField}.sourceOwner`
        ),
        sourceReference: requiredString(item.sourceReference, `${itemField}.sourceReference`),
        sourceVersion: versionValue(item.sourceVersion, `${itemField}.sourceVersion`),
        sourceFingerprintSha256: sha256(
          item.sourceFingerprintSha256,
          `${itemField}.sourceFingerprintSha256`
        ),
        necessityReference: requiredString(
          item.necessityReference,
          `${itemField}.necessityReference`
        ),
        requested: requiredLiteral(item.requested, true, `${itemField}.requested`),
        authorizedBySourceOwner: requiredLiteral(
          item.authorizedBySourceOwner,
          true,
          `${itemField}.authorizedBySourceOwner`
        ),
        minimumNecessary: requiredLiteral(
          item.minimumNecessary,
          true,
          `${itemField}.minimumNecessary`
        ),
        fieldValueEmbeddedInEnvelope: requiredLiteral(
          item.fieldValueEmbeddedInEnvelope,
          false,
          `${itemField}.fieldValueEmbeddedInEnvelope`
        ),
        evidenceArtifactRetrievalAuthority: requiredEnum(
          item.evidenceArtifactRetrievalAuthority,
          ['NOT_APPLICABLE', 'SEPARATE_AUTHORITY_REQUIRED'] as const,
          `${itemField}.evidenceArtifactRetrievalAuthority`
        )
      };
    }),
    projectionFingerprintSha256: sha256(
      projection.projectionFingerprintSha256,
      `${field}.projectionFingerprintSha256`
    ),
    sourceSetFingerprintSha256: sha256(
      projection.sourceSetFingerprintSha256,
      `${field}.sourceSetFingerprintSha256`
    ),
    wildcardAllowed: requiredLiteral(projection.wildcardAllowed, false, `${field}.wildcardAllowed`),
    wholeRecordAllowed: requiredLiteral(
      projection.wholeRecordAllowed,
      false,
      `${field}.wholeRecordAllowed`
    ),
    implicitFieldExpansionAllowed: requiredLiteral(
      projection.implicitFieldExpansionAllowed,
      false,
      `${field}.implicitFieldExpansionAllowed`
    ),
    fieldValuesEmbeddedInEnvelope: requiredLiteral(
      projection.fieldValuesEmbeddedInEnvelope,
      false,
      `${field}.fieldValuesEmbeddedInEnvelope`
    ),
    requestedAuthorizedMinimumNecessaryIntersectionRequired: requiredLiteral(
      projection.requestedAuthorizedMinimumNecessaryIntersectionRequired,
      true,
      `${field}.requestedAuthorizedMinimumNecessaryIntersectionRequired`
    ),
    forbiddenGenericDataClasses: enumArray(
      projection.forbiddenGenericDataClasses,
      [
        'END_CLIENT_RELATIONSHIP_INFORMATION',
        'ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT',
        'PRIVATE_CRM_CONTEXT',
        'UNRELATED_COMMUNICATIONS',
        'UNRELATED_ASSETS_OR_MATTERS'
      ] as const,
      `${field}.forbiddenGenericDataClasses`
    )
  };
}

function parseHandoffRecipient(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['recipient'] {
  const recipient = objectOf(value, field);
  return {
    providerId: prefixedId<ProviderId>(recipient.providerId, 'provider_', `${field}.providerId`),
    providerWorkspaceId: workspaceUuid(
      recipient.providerWorkspaceId,
      `${field}.providerWorkspaceId`
    ),
    role: requiredLiteral(recipient.role, 'FINAL_EXECUTION_PROVIDER', `${field}.role`)
  };
}

function parseHandoffPurpose(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['purpose'] {
  const purpose = objectOf(value, field);
  return {
    code: requiredEnum(
      purpose.code,
      [
        'PROFESSIONAL_SERVICE_PREPARATION',
        'PROFESSIONAL_EVIDENCE_REVIEW',
        'JURISDICTIONAL_INSTRUCTION_REVIEW',
        'OTHER_CANONICAL_BOUNDED_PURPOSE'
      ] as const,
      `${field}.code`
    ),
    contextReference: requiredString(purpose.contextReference, `${field}.contextReference`),
    instructionReference: requiredString(
      purpose.instructionReference,
      `${field}.instructionReference`
    ),
    purposeFingerprintSha256: sha256(
      purpose.purposeFingerprintSha256,
      `${field}.purposeFingerprintSha256`
    ),
    unrestrictedPurposeAllowed: requiredLiteral(
      purpose.unrestrictedPurposeAllowed,
      false,
      `${field}.unrestrictedPurposeAllowed`
    )
  };
}

function parseHandoffPrivacyPreview(
  value: unknown,
  originatingWorkspaceId: string,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['privacyPreviewAcknowledgement'] {
  const preview = objectOf(value, field);
  requiredString(preview.originatingWorkspaceId, `${field}.originatingWorkspaceId`, 200);
  return {
    affirmativeHumanAction: requiredLiteral(
      preview.affirmativeHumanAction,
      true,
      `${field}.affirmativeHumanAction`
    ),
    acknowledgementCode: requiredLiteral(
      preview.acknowledgementCode,
      'CONTROLLED_PRIVACY_HANDOFF_V1',
      `${field}.acknowledgementCode`
    ),
    acknowledgementTextVersion: requiredString(
      preview.acknowledgementTextVersion,
      `${field}.acknowledgementTextVersion`,
      100
    ),
    originatingWorkspaceId,
    recipientProviderId: prefixedId<ProviderId>(
      preview.recipientProviderId,
      'provider_',
      `${field}.recipientProviderId`
    ),
    recipientProviderWorkspaceId: workspaceUuid(
      preview.recipientProviderWorkspaceId,
      `${field}.recipientProviderWorkspaceId`
    ),
    selection: parseSelectionVersionReference(preview.selection, `${field}.selection`),
    purposeFingerprintSha256: sha256(
      preview.purposeFingerprintSha256,
      `${field}.purposeFingerprintSha256`
    ),
    projectionFingerprintSha256: sha256(
      preview.projectionFingerprintSha256,
      `${field}.projectionFingerprintSha256`
    ),
    sourceSetFingerprintSha256: sha256(
      preview.sourceSetFingerprintSha256,
      `${field}.sourceSetFingerprintSha256`
    ),
    previewFingerprintSha256: sha256(
      preview.previewFingerprintSha256,
      `${field}.previewFingerprintSha256`
    ),
    reviewedAt: timestamp(preview.reviewedAt, `${field}.reviewedAt`)
  };
}

function parseHandoffExpectedCurrent(
  value: unknown,
  field: string
): AuthorizeOrReplaceControlledHandoffCommandV1['expectedCurrent'] {
  const expected = objectOf(value, field);
  const kind = requiredEnum(expected.kind, ['ABSENT', 'EXACT'] as const, `${field}.kind`);
  if (kind === 'ABSENT') {
    if (expected.controlledHandoffId !== undefined || expected.version !== undefined)
      throw new HttpError(
        400,
        'UNEXPECTED_GOVERNED_NETWORK_FIELD',
        'ABSENT Handoff expectedCurrent cannot carry an exact Handoff reference.'
      );
    return { kind };
  }
  return {
    kind,
    controlledHandoffId: prefixedId<ControlledHandoffId>(
      expected.controlledHandoffId,
      'controlled-handoff_',
      `${field}.controlledHandoffId`
    ),
    version: positiveInteger(expected.version, `${field}.version`)
  };
}

function parseControlledHandoffAuthorizeCommand(
  body: Body,
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1,
  request: JsonRequest
): AuthorizeOrReplaceControlledHandoffCommandV1 {
  return {
    schemaVersion: requiredLiteral(body.schemaVersion, 1, 'body.schemaVersion'),
    originatingWorkspaceId: principal.workspaceId,
    recipient: parseHandoffRecipient(body.recipient, 'body.recipient'),
    purpose: parseHandoffPurpose(body.purpose, 'body.purpose'),
    authorizedProjection: parseHandoffProjection(
      body.authorizedProjection,
      'body.authorizedProjection'
    ),
    sourceLineage: parseHandoffSourceLineage(body.sourceLineage, 'body.sourceLineage'),
    trustedHumanAuthority: handoffAuthority(principal, envelope),
    privacyPreviewAcknowledgement: parseHandoffPrivacyPreview(
      body.privacyPreviewAcknowledgement,
      principal.workspaceId,
      'body.privacyPreviewAcknowledgement'
    ),
    validFrom: timestamp(body.validFrom, 'body.validFrom'),
    validUntil: timestamp(body.validUntil, 'body.validUntil'),
    expectedCurrent: parseHandoffExpectedCurrent(body.expectedCurrent, 'body.expectedCurrent'),
    idempotencyKey: requireIdempotency(request, body),
    commandFingerprintSha256: sha256(
      body.commandFingerprintSha256,
      'body.commandFingerprintSha256'
    ),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

function parseControlledHandoffRevokeCommand(
  body: Body,
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1,
  request: JsonRequest
): RevokeControlledHandoffCommandV1 {
  const target = objectOf(body.target, 'body.target');
  const routeId = prefixedId<ControlledHandoffId>(
    request.params.controlledHandoffId,
    'controlled-handoff_',
    'controlledHandoffId'
  );
  if (target.controlledHandoffId !== undefined) {
    const bodyId = prefixedId<ControlledHandoffId>(
      target.controlledHandoffId,
      'controlled-handoff_',
      'body.target.controlledHandoffId'
    );
    if (bodyId !== routeId)
      throw new HttpError(
        400,
        'GOVERNED_NETWORK_TARGET_MISMATCH',
        'Handoff route target does not match the command target.'
      );
  }
  const rationale = optionalString(body.rationale, 'body.rationale', 500);
  return {
    schemaVersion: requiredLiteral(body.schemaVersion, 1, 'body.schemaVersion'),
    originatingWorkspaceId: principal.workspaceId,
    target: {
      controlledHandoffId: routeId,
      version: positiveInteger(target.version, 'body.target.version')
    },
    trustedHumanAuthority: handoffAuthority(principal, envelope),
    reasonCode: requiredEnum(
      body.reasonCode,
      ['HUMAN_WITHDRAWAL', 'PURPOSE_CANCELLED', 'SCOPE_CANCELLED', 'OTHER_BOUNDED_REASON'] as const,
      'body.reasonCode'
    ),
    ...(rationale ? { rationale } : {}),
    idempotencyKey: requireIdempotency(request, body),
    commandFingerprintSha256: sha256(
      body.commandFingerprintSha256,
      'body.commandFingerprintSha256'
    ),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

function parseControlledHandoffValidationInput(
  body: Body,
  routeHandoffId: unknown,
  originatingWorkspaceId: string
): Parameters<ControlledPrivacyHandoffService['validateCurrent']>[1] {
  const envelope = objectOf(body.envelope, 'body.envelope');
  const attempt = objectOf(body.attempt, 'body.attempt');
  const purpose = requiredEnum(
    body.purpose,
    ['HANDOFF_CONSUMPTION', 'PRIVACY_PREVIEW_REFRESH'] as const,
    'body.purpose'
  ) satisfies ControlledHandoffValidationPurpose;
  const parsedAttempt: ControlledHandoffConsumptionAttemptV1 = {
    originatingWorkspaceId,
    recipientProviderId: prefixedId<ProviderId>(
      attempt.recipientProviderId,
      'provider_',
      'body.attempt.recipientProviderId'
    ),
    recipientProviderWorkspaceId: workspaceUuid(
      attempt.recipientProviderWorkspaceId,
      'body.attempt.recipientProviderWorkspaceId'
    ),
    purposeFingerprintSha256: sha256(
      attempt.purposeFingerprintSha256,
      'body.attempt.purposeFingerprintSha256'
    ),
    projectionFingerprintSha256: sha256(
      attempt.projectionFingerprintSha256,
      'body.attempt.projectionFingerprintSha256'
    ),
    sourceSetFingerprintSha256: sha256(
      attempt.sourceSetFingerprintSha256,
      'body.attempt.sourceSetFingerprintSha256'
    ),
    artifactRetrievalRequested: requiredLiteral(
      attempt.artifactRetrievalRequested,
      false,
      'body.attempt.artifactRetrievalRequested'
    ),
    attemptedAt: timestamp(attempt.attemptedAt, 'body.attempt.attemptedAt'),
    correlationId: markOrbitId(attempt.correlationId, 'body.attempt.correlationId')
  };
  return {
    envelope: {
      controlledHandoffId: prefixedId<ControlledHandoffId>(
        routeHandoffId,
        'controlled-handoff_',
        'controlledHandoffId'
      ),
      version: positiveInteger(envelope.version, 'body.envelope.version')
    },
    purpose,
    attempt: parsedAttempt
  };
}

function parseGovernedAllocationCommand(
  body: Body,
  principal: WorkspacePrincipal,
  idempotencyKey: string
): GovernedAllocationCommand {
  const handoffBinding = objectOf(body.handoffBinding, 'body.handoffBinding');
  const mode = requiredEnum(
    handoffBinding.mode,
    ['NONE_EXPLICIT', 'EXACT'] as const,
    'body.handoffBinding.mode'
  );
  const parsedHandoffBinding: GovernedAllocationCommand['handoffBinding'] =
    mode === 'NONE_EXPLICIT'
      ? { mode }
      : (() => {
          const handoff = objectOf(handoffBinding.handoff, 'body.handoffBinding.handoff');
          return {
            mode,
            handoff: {
              controlledHandoffId: prefixedId<ControlledHandoffId>(
                handoff.controlledHandoffId,
                'controlled-handoff_',
                'body.handoffBinding.handoff.controlledHandoffId'
              ),
              version: positiveInteger(handoff.version, 'body.handoffBinding.handoff.version')
            },
            envelopeFingerprintSha256: sha256(
              handoffBinding.envelopeFingerprintSha256,
              'body.handoffBinding.envelopeFingerprintSha256'
            ),
            purposeFingerprintSha256: sha256(
              handoffBinding.purposeFingerprintSha256,
              'body.handoffBinding.purposeFingerprintSha256'
            ),
            projectionFingerprintSha256: sha256(
              handoffBinding.projectionFingerprintSha256,
              'body.handoffBinding.projectionFingerprintSha256'
            ),
            sourceSetFingerprintSha256: sha256(
              handoffBinding.sourceSetFingerprintSha256,
              'body.handoffBinding.sourceSetFingerprintSha256'
            )
          };
        })();
  return {
    workspaceId: principal.workspaceId,
    servicePackageId: prefixedId<ServicePackageId>(
      body.servicePackageId,
      'service-package_',
      'body.servicePackageId'
    ),
    expectedServicePackageVersion: positiveInteger(
      body.expectedServicePackageVersion,
      'body.expectedServicePackageVersion'
    ),
    expectedServicePackageFingerprintSha256: sha256(
      body.expectedServicePackageFingerprintSha256,
      'body.expectedServicePackageFingerprintSha256'
    ),
    eligibilityEvaluationId: prefixedId<EligibilityEvaluationId>(
      body.eligibilityEvaluationId,
      'eligibility-evaluation_',
      'body.eligibilityEvaluationId'
    ),
    expectedEligibilityEvaluationVersion: positiveInteger(
      body.expectedEligibilityEvaluationVersion,
      'body.expectedEligibilityEvaluationVersion'
    ),
    expectedEligibilityFingerprintSha256: sha256(
      body.expectedEligibilityFingerprintSha256,
      'body.expectedEligibilityFingerprintSha256'
    ),
    providerId: prefixedId<ProviderId>(body.providerId, 'provider_', 'body.providerId'),
    providerSupplyCapabilityId: prefixedId<ProviderSupplyCapabilityId>(
      body.providerSupplyCapabilityId,
      'provider-supply-capability_',
      'body.providerSupplyCapabilityId'
    ),
    expectedProviderSupplyCapabilityVersion: positiveInteger(
      body.expectedProviderSupplyCapabilityVersion,
      'body.expectedProviderSupplyCapabilityVersion'
    ),
    rationale: requiredString(body.rationale, 'body.rationale', 1000),
    idempotencyKey,
    correlationId: markOrbitId(body.correlationId, 'body.correlationId'),
    actorId: principal.userId,
    selection: parseSelectionVersionReference(body.selection, 'body.selection'),
    selectionScope: parseSelectionScope(body.selectionScope, 'body.selectionScope'),
    handoffBinding: parsedHandoffBinding
  };
}

function mapDomainError(error: unknown): never {
  if (error instanceof ControlledHandoffError || error instanceof GovernedAllocationError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createMgsnGovernedNetworkHttpRoutes(
  options: MgsnGovernedNetworkHttpOptions = {}
): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const services = () => {
    if (!options.services)
      throw new HttpError(
        503,
        'MGSN_GOVERNED_NETWORK_RUNTIME_UNCONFIGURED',
        'MGSN governed-network runtime is not configured.',
        true
      );
    return options.services;
  };
  const trustedPrincipalFor = (request: JsonRequest): WorkspacePrincipal =>
    trustedWorkspacePrincipalFor(request, secret);
  const operation = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      return mapDomainError(error);
    }
  };

  const discoveryOptions = {
    ...(secret ? { internalServiceSecret: secret } : {}),
    ...(options.services?.providerDiscovery ? { service: options.services.providerDiscovery } : {})
  };

  const selectionOptions = {
    ...(secret ? { internalServiceSecret: secret } : {}),
    ...(options.services?.providerSelection ? { service: options.services.providerSelection } : {})
  };

  return [
    ...createMgsnProviderDiscoveryHttpRoutes(discoveryOptions),
    ...createMgsnProviderSelectionHttpRoutes(selectionOptions),
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, controlledHandoffAuthorizeTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');
        const expectedCurrent =
          body.expectedCurrent === undefined
            ? undefined
            : objectOf(body.expectedCurrent, 'expectedCurrent');
        if (
          expectedCurrent?.kind === 'ABSENT' &&
          (expectedCurrent.controlledHandoffId !== undefined ||
            expectedCurrent.version !== undefined)
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'ABSENT Handoff expectedCurrent cannot carry an exact Handoff reference.'
          );
        const command = parseControlledHandoffAuthorizeCommand(body, principal, envelope, request);
        const result = await operation(() =>
          services().controlledHandoff.authorizeOrReplace(
            handoffPrincipal(principal, envelope),
            command
          )
        );
        return json(result.mutation === 'AUTHORIZED' ? 201 : 200, { controlledHandoff: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs/:controlledHandoffId/revoke',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, controlledHandoffRevokeTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');
        const command = parseControlledHandoffRevokeCommand(body, principal, envelope, request);
        const result = await operation(() =>
          services().controlledHandoff.revoke(handoffPrincipal(principal, envelope), command)
        );
        return json(200, { controlledHandoff: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs/:controlledHandoffId/validate-current',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, controlledHandoffValidationTransportShape, 'body');
        const purpose = body.purpose as ControlledHandoffValidationPurpose;
        if (!['HANDOFF_CONSUMPTION', 'PRIVACY_PREVIEW_REFRESH'].includes(purpose))
          throw new HttpError(
            400,
            'INVALID_GOVERNED_NETWORK_REQUEST',
            'Handoff validation purpose is not available on the Workplace producer.'
          );
        const attempt = objectOf(body.attempt, 'attempt');
        if (attempt.artifactRetrievalRequested !== false)
          throw new HttpError(
            403,
            'ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
            'Generic governed-network transport cannot request evidence artifacts.'
          );
        const input = parseControlledHandoffValidationInput(
          body,
          request.params.controlledHandoffId,
          principal.workspaceId
        );
        const result = await operation(() =>
          services().controlledHandoff.validateCurrent(
            { workspaceId: principal.workspaceId },
            input
          )
        );
        return json(200, { controlledHandoffValidation: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/allocations',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, governedAllocationTransportShape, 'body');
        const idempotencyKey = requireIdempotency(request, body);
        const handoffBinding =
          body.handoffBinding === undefined
            ? undefined
            : objectOf(body.handoffBinding, 'handoffBinding');
        if (
          handoffBinding?.mode === 'NONE_EXPLICIT' &&
          Object.keys(handoffBinding).some((field) => field !== 'mode')
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'NONE_EXPLICIT Handoff binding cannot carry an exact Handoff reference or fingerprints.'
          );
        const command = parseGovernedAllocationCommand(body, principal, idempotencyKey);
        const result = await operation(() => services().governedAllocation.allocate(command));
        return json(201, { governedAllocation: result });
      }
    }
  ];
}
