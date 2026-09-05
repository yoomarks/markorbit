import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ProviderDiscoveryRequestReferenceV1 } from '@markorbit/contracts/provider-discovery';
import type {
  AuthorizeOrReplaceControlledHandoffCommandV1,
  ControlledHandoffConsumptionAttemptV1,
  ControlledHandoffId,
  ControlledHandoffValidationPurpose,
  RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  CreateOrReplaceProviderSelectionCommandV1,
  ProviderSelectionId,
  ProviderSelectionValidationPurpose,
  RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ControlledHandoffError,
  type ControlledHandoffPrincipal,
  type ControlledPrivacyHandoffService
} from './controlled-privacy-handoff.js';
import { GovernedAllocationError, type GovernedAllocationService } from './governed-allocation.js';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { ProviderDiscoveryError } from './provider-discovery.js';
import {
  ProviderSelectionError,
  type ProviderSelectionPrincipal,
  type ProviderSelectionService
} from './provider-selection.js';

export const MGSN_GOVERNED_HUMAN_ACTION_HEADER =
  'x-markorbit-governed-network-human-action' as const;

export type MgsnGovernedHumanActionKind = 'PROVIDER_SELECTION' | 'CONTROLLED_HANDOFF';

/**
 * Internal transport evidence only. This envelope is not a bearer capability and is unusable
 * without the existing internal-service secret plus an exact trusted Workspace Principal.
 * Browser/Gateway code must construct it from a separately reviewed explicit human action and must
 * never forward a browser-supplied value verbatim.
 */
export interface MgsnGovernedHumanActionEnvelopeV1 {
  schemaVersion: 1;
  kind: MgsnGovernedHumanActionKind;
  actorKind: 'HUMAN_USER';
  workspaceId: string;
  userId: string;
  membershipId: string;
  principalReference: string;
  authorityReference: string;
  authorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
  payloadIdentityAuthoritative: false;
}

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

type Body = Record<string, unknown>;

const forbiddenTopLevelAuthorityFields = new Set([
  'workspaceId',
  'actorId',
  'userId',
  'membershipId',
  'principal',
  'principalReference',
  'workspaceMembershipReference',
  'requesterWorkspaceId',
  'originatingWorkspaceId',
  'trustedHumanAuthority',
  'selectionAuthorityReference',
  'handoffAuthorityReference',
  'authorityReference',
  'authorityVersion',
  'authenticatedAt',
  'affirmativeHumanActionEvidenceReference'
]);

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function objectOf(value: unknown, field: string): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', `${field} must be an object.`);
  return value as Body;
}

interface TransportShape {
  readonly [key: string]: null | TransportShape | readonly [TransportShape];
}

function assertExactTransportShape(value: unknown, shape: TransportShape, field: string): void {
  const object = objectOf(value, field);
  const allowed = new Set(Object.keys(shape));
  const unexpected = Object.keys(object).find((key) => !allowed.has(key));
  if (unexpected)
    throw new HttpError(
      400,
      'UNEXPECTED_GOVERNED_NETWORK_FIELD',
      `${field}.${unexpected} is not permitted by the governed-network transport contract.`
    );
  for (const [key, nested] of Object.entries(shape)) {
    const child = object[key];
    if (nested === null || child === undefined) continue;
    if (Array.isArray(nested)) {
      if (!Array.isArray(child))
        throw new HttpError(
          400,
          'INVALID_GOVERNED_NETWORK_REQUEST',
          `${field}.${key} must be an array.`
        );
      for (const [index, item] of child.entries())
        assertExactTransportShape(item, nested[0] as TransportShape, `${field}.${key}[${index}]`);
      continue;
    }
    assertExactTransportShape(child, nested as TransportShape, `${field}.${key}`);
  }
}

const providerSelectionVersionReferenceTransportShape = {
  providerSelectionId: null,
  version: null,
  scopeVersion: null
} satisfies TransportShape;

const controlledHandoffVersionReferenceTransportShape = {
  controlledHandoffId: null,
  version: null
} satisfies TransportShape;

const discoveryRequestTransportShape = {
  schemaVersion: null,
  providerDiscoveryRequestId: null,
  need: {
    reference: null,
    version: null,
    fingerprintSha256: null,
    jurisdiction: null,
    serviceType: null
  },
  purpose: null,
  audience: {
    kind: null,
    relationshipAuthorityReference: null
  },
  contextReference: null,
  requestedDataClasses: null,
  requestedFields: null,
  requestedAt: null,
  requestFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

const selectionScopeTransportShape = {
  owner: null,
  reference: null,
  version: null,
  fingerprintSha256: null
} satisfies TransportShape;

const currentSourceVersionTransportShape = {
  owner: null,
  sourceType: null,
  sourceId: null,
  version: null,
  fingerprintSha256: null,
  effectiveFrom: null,
  effectiveUntil: null,
  checkedAt: null,
  authorityState: null
} satisfies TransportShape;

const providerSelectionSourceLineageTransportShape = {
  discoveryRequest: {
    providerDiscoveryRequestId: null,
    requesterWorkspaceId: null,
    requestFingerprintSha256: null,
    needReference: null,
    needVersion: null,
    needFingerprintSha256: null,
    purpose: null,
    contextReference: null
  },
  discoveryResult: {
    resultFingerprintSha256: null,
    evaluatedAt: null
  },
  discoveryCandidate: {
    providerDiscoveryCandidateId: null,
    candidateFingerprintSha256: null,
    generatedAt: null,
    evaluationPolicyVersion: null
  },
  provider: {
    providerId: null,
    providerWorkspaceId: null
  },
  providerSupplyCapability: {
    id: null,
    version: null,
    fingerprintSha256: null
  },
  visibilityAuthorizationAtReview: {
    networkParticipationId: null,
    participationVersion: null,
    visibilityPolicyVersion: null,
    evaluatedAt: null,
    currentAuthorityRevalidationRequiredBeforeServe: null
  },
  historicalSourceVersions: [currentSourceVersionTransportShape],
  directExecutorDisclosureAtReview: {
    state: null,
    evidenceReferences: null
  },
  currentAuthorityRevalidationRequiredBeforeSelectionCommit: null,
  currentAuthorityRevalidationRequiredBeforeDownstreamUse: null
} satisfies TransportShape;

const providerSelectionAcknowledgementTransportShape = {
  affirmativeHumanAction: null,
  acknowledgementCode: null,
  acknowledgementTextVersion: null,
  reviewedCandidateId: null,
  reviewedCandidateFingerprintSha256: null,
  reviewedScopeFingerprintSha256: null,
  reviewedAt: null,
  reasonCode: null,
  rationale: null,
  containsCustomerDocuments: null,
  containsRawEvidenceArtifacts: null,
  containsEndClientRelationshipInformation: null,
  containsApplicantOwnerOfficialData: null,
  containsCommercialMarginOrProfit: null
} satisfies TransportShape;

const providerSelectionCreateTransportShape = {
  schemaVersion: null,
  scope: selectionScopeTransportShape,
  sourceLineage: providerSelectionSourceLineageTransportShape,
  acknowledgement: providerSelectionAcknowledgementTransportShape,
  expectedCurrent: {
    kind: null,
    expectedScopeVersion: null,
    providerSelectionId: null,
    version: null
  },
  idempotencyKey: null,
  commandFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

const providerSelectionRevokeTransportShape = {
  schemaVersion: null,
  scope: selectionScopeTransportShape,
  target: providerSelectionVersionReferenceTransportShape,
  reasonCode: null,
  rationale: null,
  idempotencyKey: null,
  commandFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

const providerSelectionValidationTransportShape = {
  scope: selectionScopeTransportShape,
  purpose: null,
  checkedAt: null
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

function rejectTopLevelAuthority(body: Body): void {
  const field = Object.keys(body).find((candidate) =>
    forbiddenTopLevelAuthorityFields.has(candidate)
  );
  if (field)
    throw new HttpError(
      400,
      'SPOOFED_GOVERNED_NETWORK_AUTHORITY',
      `${field} cannot be supplied as governed-network authority.`
    );
}

function requireIdempotency(request: JsonRequest, body: Body): string {
  const key = request.headers['idempotency-key']?.trim();
  if (!key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required for governed-network mutations.'
    );
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_MISMATCH',
      'Body idempotencyKey must match Idempotency-Key.'
    );
  return key;
}

function validVersion(value: unknown): value is number | string {
  return (
    (typeof value === 'number' && Number.isInteger(value) && value > 0) ||
    (typeof value === 'string' && value.trim().length > 0)
  );
}

function parseHumanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  expectedKind: MgsnGovernedHumanActionKind
): MgsnGovernedHumanActionEnvelopeV1 {
  const encoded = request.headers[MGSN_GOVERNED_HUMAN_ACTION_HEADER];
  if (!encoded)
    throw new HttpError(
      403,
      'GOVERNED_HUMAN_ACTION_REQUIRED',
      `A reviewed ${expectedKind} human-action authority is required.`
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority is invalid.'
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority is invalid.'
    );
  const envelope = parsed as Partial<MgsnGovernedHumanActionEnvelopeV1>;
  const allowedHumanActionFields = new Set([
    'schemaVersion',
    'kind',
    'actorKind',
    'workspaceId',
    'userId',
    'membershipId',
    'principalReference',
    'authorityReference',
    'authorityVersion',
    'authenticatedAt',
    'affirmativeHumanActionEvidenceReference',
    'payloadIdentityAuthoritative'
  ]);
  if (Object.keys(envelope).some((field) => !allowedHumanActionFields.has(field)))
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority contains unsupported fields.'
    );
  const strings = [
    envelope.workspaceId,
    envelope.userId,
    envelope.membershipId,
    envelope.principalReference,
    envelope.authorityReference,
    envelope.authenticatedAt,
    envelope.affirmativeHumanActionEvidenceReference
  ];
  if (
    envelope.schemaVersion !== 1 ||
    envelope.kind !== expectedKind ||
    envelope.actorKind !== 'HUMAN_USER' ||
    envelope.payloadIdentityAuthoritative !== false ||
    strings.some((value) => typeof value !== 'string' || !value.trim()) ||
    !validVersion(envelope.authorityVersion) ||
    !Number.isFinite(Date.parse(envelope.authenticatedAt!)) ||
    envelope.workspaceId!.toLowerCase() !== principal.workspaceId.toLowerCase() ||
    envelope.userId!.toLowerCase() !== principal.userId.toLowerCase() ||
    envelope.membershipId!.toLowerCase() !== principal.membershipId.toLowerCase()
  )
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority does not match the trusted Workspace Principal.'
    );
  return structuredClone(envelope as MgsnGovernedHumanActionEnvelopeV1);
}

function selectionPrincipal(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): ProviderSelectionPrincipal {
  return {
    workspaceId: principal.workspaceId,
    actorId: principal.userId,
    actorKind: 'HUMAN_USER',
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    selectionAuthorityReference: envelope.authorityReference,
    selectionAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference
  };
}

function selectionAuthority(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): CreateOrReplaceProviderSelectionCommandV1['trustedHumanAuthority'] {
  return {
    source: 'CORE_WORKSPACE_PRINCIPAL',
    requesterWorkspaceId: principal.workspaceId,
    selectingActorId: principal.userId,
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    selectionAuthorityReference: envelope.authorityReference,
    selectionAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference,
    payloadIdentityAuthoritative: false
  };
}

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

function mapDomainError(error: unknown): never {
  if (
    error instanceof ProviderDiscoveryError ||
    error instanceof ProviderSelectionError ||
    error instanceof ControlledHandoffError ||
    error instanceof GovernedAllocationError
  )
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
  const trustedPrincipalFor = (request: JsonRequest): WorkspacePrincipal => {
    if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
      throw new HttpError(
        401,
        'UNTRUSTED_INTERNAL_CALLER',
        'Trusted internal authorization is required.'
      );
    try {
      return parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
    } catch {
      throw new HttpError(
        401,
        'INVALID_INTERNAL_PRINCIPAL',
        'A trusted Workspace Principal is required.'
      );
    }
  };
  const operation = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      return mapDomainError(error);
    }
  };

  return [
    {
      method: 'POST',
      path: '/v1/governed-network/discovery/evaluate',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, discoveryRequestTransportShape, 'body');
        const audience =
          body.audience === undefined ? undefined : objectOf(body.audience, 'audience');
        if (
          audience?.kind === 'BOUNDED_NETWORK' &&
          audience.relationshipAuthorityReference !== undefined
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'body.audience.relationshipAuthorityReference is not permitted for BOUNDED_NETWORK.'
          );
        const discoveryRequest = {
          ...body,
          requesterWorkspaceId: principal.workspaceId
        } as unknown as ProviderDiscoveryRequestReferenceV1;
        const result = await operation(() =>
          services().providerDiscovery.evaluate(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            discoveryRequest
          )
        );
        return json(200, { providerDiscovery: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/selections',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, providerSelectionCreateTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');
        const expectedCurrent =
          body.expectedCurrent === undefined
            ? undefined
            : objectOf(body.expectedCurrent, 'expectedCurrent');
        if (
          expectedCurrent?.kind === 'ABSENT' &&
          (expectedCurrent.providerSelectionId !== undefined ||
            expectedCurrent.version !== undefined)
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'ABSENT Selection expectedCurrent cannot carry an exact Selection reference.'
          );
        const sourceLineage = objectOf(body.sourceLineage, 'sourceLineage');
        const discoveryRequest = objectOf(
          sourceLineage.discoveryRequest,
          'sourceLineage.discoveryRequest'
        );
        const command = {
          ...body,
          requesterWorkspaceId: principal.workspaceId,
          sourceLineage: {
            ...sourceLineage,
            discoveryRequest: {
              ...discoveryRequest,
              requesterWorkspaceId: principal.workspaceId
            }
          },
          trustedHumanAuthority: selectionAuthority(principal, envelope),
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as CreateOrReplaceProviderSelectionCommandV1;
        const result = await operation(() =>
          services().providerSelection.createOrReplace(
            selectionPrincipal(principal, envelope),
            command
          )
        );
        return json(result.mutation === 'CREATED' ? 201 : 200, { providerSelection: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/selections/:providerSelectionId/revoke',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, providerSelectionRevokeTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');
        const target = objectOf(body.target, 'target');
        if (
          target.providerSelectionId !== undefined &&
          target.providerSelectionId !== request.params.providerSelectionId
        )
          throw new HttpError(
            400,
            'GOVERNED_NETWORK_TARGET_MISMATCH',
            'Selection route target does not match the command target.'
          );
        const command = {
          ...body,
          requesterWorkspaceId: principal.workspaceId,
          target: {
            ...target,
            providerSelectionId: request.params.providerSelectionId! as ProviderSelectionId
          },
          trustedHumanAuthority: selectionAuthority(principal, envelope),
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as RevokeProviderSelectionCommandV1;
        const result = await operation(() =>
          services().providerSelection.revoke(selectionPrincipal(principal, envelope), command)
        );
        return json(200, { providerSelection: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/selections/:providerSelectionId/validate-current',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, providerSelectionValidationTransportShape, 'body');
        const purpose = body.purpose as ProviderSelectionValidationPurpose;
        if (!['CONTROLLED_HANDOFF_REVIEW', 'ALLOCATION_PREREQUISITE_REVIEW'].includes(purpose))
          throw new HttpError(
            400,
            'INVALID_GOVERNED_NETWORK_REQUEST',
            'Selection validation purpose is not available on the Workplace producer.'
          );
        const result = await operation(() =>
          services().providerSelection.validateCurrent(
            { workspaceId: principal.workspaceId },
            {
              scope: body.scope as CreateOrReplaceProviderSelectionCommandV1['scope'],
              providerSelectionId: request.params.providerSelectionId! as ProviderSelectionId,
              purpose,
              ...(typeof body.checkedAt === 'string' ? { checkedAt: body.checkedAt } : {})
            }
          )
        );
        return json(200, { providerSelectionValidation: result });
      }
    },
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
        const preview = objectOf(
          body.privacyPreviewAcknowledgement,
          'privacyPreviewAcknowledgement'
        );
        const command = {
          ...body,
          originatingWorkspaceId: principal.workspaceId,
          trustedHumanAuthority: handoffAuthority(principal, envelope),
          privacyPreviewAcknowledgement: {
            ...preview,
            originatingWorkspaceId: principal.workspaceId
          },
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as AuthorizeOrReplaceControlledHandoffCommandV1;
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
        const target = objectOf(body.target, 'target');
        if (
          target.controlledHandoffId !== undefined &&
          target.controlledHandoffId !== request.params.controlledHandoffId
        )
          throw new HttpError(
            400,
            'GOVERNED_NETWORK_TARGET_MISMATCH',
            'Handoff route target does not match the command target.'
          );
        const command = {
          ...body,
          originatingWorkspaceId: principal.workspaceId,
          target: {
            ...target,
            controlledHandoffId: request.params.controlledHandoffId! as ControlledHandoffId
          },
          trustedHumanAuthority: handoffAuthority(principal, envelope),
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as RevokeControlledHandoffCommandV1;
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
        const envelope = objectOf(body.envelope, 'envelope');
        const attempt = objectOf(body.attempt, 'attempt');
        if (attempt.artifactRetrievalRequested !== false)
          throw new HttpError(
            403,
            'ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
            'Generic governed-network transport cannot request evidence artifacts.'
          );
        const validationAttempt = {
          ...attempt,
          originatingWorkspaceId: principal.workspaceId
        } as unknown as ControlledHandoffConsumptionAttemptV1;
        const result = await operation(() =>
          services().controlledHandoff.validateCurrent(
            { workspaceId: principal.workspaceId },
            {
              envelope: {
                controlledHandoffId: request.params.controlledHandoffId! as ControlledHandoffId,
                version: Number(envelope.version)
              },
              purpose,
              attempt: validationAttempt
            }
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
        const result = await operation(() =>
          services().governedAllocation.allocate({
            ...body,
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            idempotencyKey
          } as Parameters<GovernedAllocationService['allocate']>[0])
        );
        return json(201, { governedAllocation: result });
      }
    }
  ];
}
