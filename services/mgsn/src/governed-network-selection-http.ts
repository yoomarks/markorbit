import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  ProviderDiscoveryCandidateId,
  ProviderDiscoveryRequestId
} from '@markorbit/contracts/provider-discovery';
import type {
  CreateOrReplaceProviderSelectionCommandV1,
  ProviderSelectionId,
  ProviderSelectionValidationPurpose,
  RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';
import type {
  ProviderId,
  ProviderSupplyCapabilityId
} from '@markorbit/contracts/provider-execution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  assertExactTransportShape,
  bodyOf,
  markOrbitId,
  nonNegativeInteger,
  objectOf,
  optionalString,
  optionalTimestamp,
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
  ProviderSelectionError,
  type ProviderSelectionPrincipal,
  type ProviderSelectionService
} from './provider-selection.js';
import {
  observeMgsnSemanticOperationV1,
  type MgsnSemanticTelemetrySinkV1
} from './semantic-observability.js';

export interface MgsnProviderSelectionHttpOptions {
  internalServiceSecret?: string;
  service?: Pick<ProviderSelectionService, 'createOrReplace' | 'revoke' | 'validateCurrent'>;
  semanticTelemetrySink?: MgsnSemanticTelemetrySinkV1;
}

export const providerSelectionVersionReferenceTransportShape = {
  providerSelectionId: null,
  version: null,
  scopeVersion: null
} satisfies TransportShape;

export const selectionScopeTransportShape = {
  owner: null,
  reference: null,
  version: null,
  fingerprintSha256: null
} satisfies TransportShape;

export const currentSourceVersionTransportShape = {
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

export function parseSelectionScope(
  value: unknown,
  field: string
): CreateOrReplaceProviderSelectionCommandV1['scope'] {
  const scope = objectOf(value, field);
  return {
    owner: requiredEnum(
      scope.owner,
      ['CORE', 'LITE', 'MARKREG', 'OPERATIONS', 'OTHER_CANONICAL_CONSUMER'] as const,
      `${field}.owner`
    ),
    reference: requiredString(scope.reference, `${field}.reference`),
    version: versionValue(scope.version, `${field}.version`),
    fingerprintSha256: sha256(scope.fingerprintSha256, `${field}.fingerprintSha256`)
  };
}

export function parseSelectionVersionReference(
  value: unknown,
  field: string
): Readonly<{ providerSelectionId: ProviderSelectionId; version: number; scopeVersion: number }> {
  const reference = objectOf(value, field);
  return {
    providerSelectionId: prefixedId<ProviderSelectionId>(
      reference.providerSelectionId,
      'provider-selection_',
      `${field}.providerSelectionId`
    ),
    version: positiveInteger(reference.version, `${field}.version`),
    scopeVersion: positiveInteger(reference.scopeVersion, `${field}.scopeVersion`)
  };
}

export function parseCurrentSourceVersion(
  value: unknown,
  field: string
): CreateOrReplaceProviderSelectionCommandV1['sourceLineage']['historicalSourceVersions'][number] {
  const source = objectOf(value, field);
  const fingerprintSha256 = sha256(source.fingerprintSha256, `${field}.fingerprintSha256`);
  const effectiveFrom = optionalTimestamp(source.effectiveFrom, `${field}.effectiveFrom`);
  const effectiveUntil = optionalTimestamp(source.effectiveUntil, `${field}.effectiveUntil`);
  return {
    owner: requiredEnum(
      source.owner,
      ['CORE', 'MGSN', 'CAPABILITY_ENGINE', 'OTHER_CANONICAL_OWNER'] as const,
      `${field}.owner`
    ),
    sourceType: requiredString(source.sourceType, `${field}.sourceType`, 100),
    sourceId: requiredString(source.sourceId, `${field}.sourceId`, 200),
    version: versionValue(source.version, `${field}.version`),
    fingerprintSha256,
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveUntil ? { effectiveUntil } : {}),
    checkedAt: timestamp(source.checkedAt, `${field}.checkedAt`),
    authorityState: requiredLiteral(source.authorityState, 'CURRENT', `${field}.authorityState`)
  };
}

function parseSelectionSourceLineage(
  value: unknown,
  requesterWorkspaceId: string,
  field: string
): CreateOrReplaceProviderSelectionCommandV1['sourceLineage'] {
  const lineage = objectOf(value, field);
  const discoveryRequest = objectOf(lineage.discoveryRequest, `${field}.discoveryRequest`);
  requiredString(
    discoveryRequest.requesterWorkspaceId,
    `${field}.discoveryRequest.requesterWorkspaceId`,
    200
  );
  const discoveryResult = objectOf(lineage.discoveryResult, `${field}.discoveryResult`);
  const candidate = objectOf(lineage.discoveryCandidate, `${field}.discoveryCandidate`);
  const provider = objectOf(lineage.provider, `${field}.provider`);
  const supply = objectOf(lineage.providerSupplyCapability, `${field}.providerSupplyCapability`);
  const visibility = objectOf(
    lineage.visibilityAuthorizationAtReview,
    `${field}.visibilityAuthorizationAtReview`
  );
  const directExecutor = objectOf(
    lineage.directExecutorDisclosureAtReview,
    `${field}.directExecutorDisclosureAtReview`
  );
  return {
    discoveryRequest: {
      providerDiscoveryRequestId: prefixedId<ProviderDiscoveryRequestId>(
        discoveryRequest.providerDiscoveryRequestId,
        'provider-discovery-request_',
        `${field}.discoveryRequest.providerDiscoveryRequestId`
      ),
      requesterWorkspaceId,
      requestFingerprintSha256: sha256(
        discoveryRequest.requestFingerprintSha256,
        `${field}.discoveryRequest.requestFingerprintSha256`
      ),
      needReference: requiredString(
        discoveryRequest.needReference,
        `${field}.discoveryRequest.needReference`
      ),
      needVersion: versionValue(
        discoveryRequest.needVersion,
        `${field}.discoveryRequest.needVersion`
      ),
      needFingerprintSha256: sha256(
        discoveryRequest.needFingerprintSha256,
        `${field}.discoveryRequest.needFingerprintSha256`
      ),
      purpose: requiredString(discoveryRequest.purpose, `${field}.discoveryRequest.purpose`, 100),
      contextReference: requiredString(
        discoveryRequest.contextReference,
        `${field}.discoveryRequest.contextReference`
      )
    },
    discoveryResult: {
      resultFingerprintSha256: sha256(
        discoveryResult.resultFingerprintSha256,
        `${field}.discoveryResult.resultFingerprintSha256`
      ),
      evaluatedAt: timestamp(discoveryResult.evaluatedAt, `${field}.discoveryResult.evaluatedAt`)
    },
    discoveryCandidate: {
      providerDiscoveryCandidateId: prefixedId<ProviderDiscoveryCandidateId>(
        candidate.providerDiscoveryCandidateId,
        'provider-discovery-candidate_',
        `${field}.discoveryCandidate.providerDiscoveryCandidateId`
      ),
      candidateFingerprintSha256: sha256(
        candidate.candidateFingerprintSha256,
        `${field}.discoveryCandidate.candidateFingerprintSha256`
      ),
      generatedAt: timestamp(candidate.generatedAt, `${field}.discoveryCandidate.generatedAt`),
      evaluationPolicyVersion: requiredString(
        candidate.evaluationPolicyVersion,
        `${field}.discoveryCandidate.evaluationPolicyVersion`,
        200
      )
    },
    provider: {
      providerId: prefixedId<ProviderId>(
        provider.providerId,
        'provider_',
        `${field}.provider.providerId`
      ),
      providerWorkspaceId: workspaceUuid(
        provider.providerWorkspaceId,
        `${field}.provider.providerWorkspaceId`
      )
    },
    providerSupplyCapability: {
      id: prefixedId<ProviderSupplyCapabilityId>(
        supply.id,
        'provider-supply-capability_',
        `${field}.providerSupplyCapability.id`
      ),
      version: positiveInteger(supply.version, `${field}.providerSupplyCapability.version`),
      fingerprintSha256: sha256(
        supply.fingerprintSha256,
        `${field}.providerSupplyCapability.fingerprintSha256`
      )
    },
    visibilityAuthorizationAtReview: {
      networkParticipationId: prefixedId<
        CreateOrReplaceProviderSelectionCommandV1['sourceLineage']['visibilityAuthorizationAtReview']['networkParticipationId']
      >(
        visibility.networkParticipationId,
        'network-participation_',
        `${field}.visibilityAuthorizationAtReview.networkParticipationId`
      ),
      participationVersion: positiveInteger(
        visibility.participationVersion,
        `${field}.visibilityAuthorizationAtReview.participationVersion`
      ),
      visibilityPolicyVersion: positiveInteger(
        visibility.visibilityPolicyVersion,
        `${field}.visibilityAuthorizationAtReview.visibilityPolicyVersion`
      ),
      evaluatedAt: timestamp(
        visibility.evaluatedAt,
        `${field}.visibilityAuthorizationAtReview.evaluatedAt`
      ),
      currentAuthorityRevalidationRequiredBeforeServe: requiredLiteral(
        visibility.currentAuthorityRevalidationRequiredBeforeServe,
        true,
        `${field}.visibilityAuthorizationAtReview.currentAuthorityRevalidationRequiredBeforeServe`
      )
    },
    historicalSourceVersions: parsedArray(
      lineage.historicalSourceVersions,
      `${field}.historicalSourceVersions`,
      parseCurrentSourceVersion
    ),
    directExecutorDisclosureAtReview: {
      state: requiredEnum(
        directExecutor.state,
        ['UNKNOWN', 'UNPROVEN', 'INDEPENDENT_EVIDENCE_REFERENCED'] as const,
        `${field}.directExecutorDisclosureAtReview.state`
      ),
      evidenceReferences: stringArray(
        directExecutor.evidenceReferences,
        `${field}.directExecutorDisclosureAtReview.evidenceReferences`
      )
    },
    currentAuthorityRevalidationRequiredBeforeSelectionCommit: requiredLiteral(
      lineage.currentAuthorityRevalidationRequiredBeforeSelectionCommit,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeSelectionCommit`
    ),
    currentAuthorityRevalidationRequiredBeforeDownstreamUse: requiredLiteral(
      lineage.currentAuthorityRevalidationRequiredBeforeDownstreamUse,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeDownstreamUse`
    )
  };
}

function parseSelectionAcknowledgement(
  value: unknown,
  field: string
): CreateOrReplaceProviderSelectionCommandV1['acknowledgement'] {
  const acknowledgement = objectOf(value, field);
  const rationale = optionalString(acknowledgement.rationale, `${field}.rationale`, 500);
  return {
    affirmativeHumanAction: requiredLiteral(
      acknowledgement.affirmativeHumanAction,
      true,
      `${field}.affirmativeHumanAction`
    ),
    acknowledgementCode: requiredLiteral(
      acknowledgement.acknowledgementCode,
      'HUMAN_PROVIDER_SELECTION_V1',
      `${field}.acknowledgementCode`
    ),
    acknowledgementTextVersion: requiredString(
      acknowledgement.acknowledgementTextVersion,
      `${field}.acknowledgementTextVersion`,
      100
    ),
    reviewedCandidateId: prefixedId<ProviderDiscoveryCandidateId>(
      acknowledgement.reviewedCandidateId,
      'provider-discovery-candidate_',
      `${field}.reviewedCandidateId`
    ),
    reviewedCandidateFingerprintSha256: sha256(
      acknowledgement.reviewedCandidateFingerprintSha256,
      `${field}.reviewedCandidateFingerprintSha256`
    ),
    reviewedScopeFingerprintSha256: sha256(
      acknowledgement.reviewedScopeFingerprintSha256,
      `${field}.reviewedScopeFingerprintSha256`
    ),
    reviewedAt: timestamp(acknowledgement.reviewedAt, `${field}.reviewedAt`),
    reasonCode: requiredEnum(
      acknowledgement.reasonCode,
      [
        'FIT_FOR_REVIEWED_NEED',
        'JURISDICTION_AND_SERVICE_MATCH',
        'EVIDENCE_AND_LIMITATIONS_REVIEWED',
        'OTHER_BOUNDED_REASON'
      ] as const,
      `${field}.reasonCode`
    ),
    ...(rationale ? { rationale } : {}),
    containsCustomerDocuments: requiredLiteral(
      acknowledgement.containsCustomerDocuments,
      false,
      `${field}.containsCustomerDocuments`
    ),
    containsRawEvidenceArtifacts: requiredLiteral(
      acknowledgement.containsRawEvidenceArtifacts,
      false,
      `${field}.containsRawEvidenceArtifacts`
    ),
    containsEndClientRelationshipInformation: requiredLiteral(
      acknowledgement.containsEndClientRelationshipInformation,
      false,
      `${field}.containsEndClientRelationshipInformation`
    ),
    containsApplicantOwnerOfficialData: requiredLiteral(
      acknowledgement.containsApplicantOwnerOfficialData,
      false,
      `${field}.containsApplicantOwnerOfficialData`
    ),
    containsCommercialMarginOrProfit: requiredLiteral(
      acknowledgement.containsCommercialMarginOrProfit,
      false,
      `${field}.containsCommercialMarginOrProfit`
    )
  };
}

function parseSelectionExpectedCurrent(
  value: unknown,
  field: string
): CreateOrReplaceProviderSelectionCommandV1['expectedCurrent'] {
  const expected = objectOf(value, field);
  const kind = requiredEnum(expected.kind, ['ABSENT', 'EXACT'] as const, `${field}.kind`);
  const expectedScopeVersion = nonNegativeInteger(
    expected.expectedScopeVersion,
    `${field}.expectedScopeVersion`
  );
  if (kind === 'ABSENT') {
    if (expected.providerSelectionId !== undefined || expected.version !== undefined)
      throw new HttpError(
        400,
        'UNEXPECTED_GOVERNED_NETWORK_FIELD',
        'ABSENT Selection expectedCurrent cannot carry an exact Selection reference.'
      );
    return { kind, expectedScopeVersion };
  }
  return {
    kind,
    providerSelectionId: prefixedId<ProviderSelectionId>(
      expected.providerSelectionId,
      'provider-selection_',
      `${field}.providerSelectionId`
    ),
    version: positiveInteger(expected.version, `${field}.version`),
    expectedScopeVersion
  };
}

function parseProviderSelectionCreateCommand(
  body: Body,
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1,
  request: JsonRequest
): CreateOrReplaceProviderSelectionCommandV1 {
  return {
    schemaVersion: requiredLiteral(body.schemaVersion, 1, 'body.schemaVersion'),
    requesterWorkspaceId: principal.workspaceId,
    scope: parseSelectionScope(body.scope, 'body.scope'),
    sourceLineage: parseSelectionSourceLineage(
      body.sourceLineage,
      principal.workspaceId,
      'body.sourceLineage'
    ),
    trustedHumanAuthority: selectionAuthority(principal, envelope),
    acknowledgement: parseSelectionAcknowledgement(body.acknowledgement, 'body.acknowledgement'),
    expectedCurrent: parseSelectionExpectedCurrent(body.expectedCurrent, 'body.expectedCurrent'),
    idempotencyKey: requireIdempotency(request, body),
    commandFingerprintSha256: sha256(
      body.commandFingerprintSha256,
      'body.commandFingerprintSha256'
    ),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

function parseProviderSelectionRevokeCommand(
  body: Body,
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1,
  request: JsonRequest
): RevokeProviderSelectionCommandV1 {
  const target = objectOf(body.target, 'body.target');
  const routeId = prefixedId<ProviderSelectionId>(
    request.params.providerSelectionId,
    'provider-selection_',
    'providerSelectionId'
  );
  if (target.providerSelectionId !== undefined) {
    const bodyId = prefixedId<ProviderSelectionId>(
      target.providerSelectionId,
      'provider-selection_',
      'body.target.providerSelectionId'
    );
    if (bodyId !== routeId)
      throw new HttpError(
        400,
        'GOVERNED_NETWORK_TARGET_MISMATCH',
        'Selection route target does not match the command target.'
      );
  }
  const rationale = optionalString(body.rationale, 'body.rationale', 500);
  return {
    schemaVersion: requiredLiteral(body.schemaVersion, 1, 'body.schemaVersion'),
    requesterWorkspaceId: principal.workspaceId,
    scope: parseSelectionScope(body.scope, 'body.scope'),
    target: {
      providerSelectionId: routeId,
      version: positiveInteger(target.version, 'body.target.version'),
      scopeVersion: positiveInteger(target.scopeVersion, 'body.target.scopeVersion')
    },
    trustedHumanAuthority: selectionAuthority(principal, envelope),
    reasonCode: requiredEnum(
      body.reasonCode,
      ['HUMAN_WITHDRAWAL', 'SCOPE_CANCELLED', 'OTHER_BOUNDED_REASON'] as const,
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

function parseProviderSelectionValidationInput(
  body: Body,
  routeSelectionId: unknown
): Parameters<ProviderSelectionService['validateCurrent']>[1] {
  const purpose = requiredEnum(
    body.purpose,
    ['CONTROLLED_HANDOFF_REVIEW', 'ALLOCATION_PREREQUISITE_REVIEW'] as const,
    'body.purpose'
  ) satisfies ProviderSelectionValidationPurpose;
  const checkedAt = optionalTimestamp(body.checkedAt, 'body.checkedAt');
  return {
    scope: parseSelectionScope(body.scope, 'body.scope'),
    providerSelectionId: prefixedId<ProviderSelectionId>(
      routeSelectionId,
      'provider-selection_',
      'providerSelectionId'
    ),
    purpose,
    ...(checkedAt ? { checkedAt } : {})
  };
}

function mapSelectionError(error: unknown): never {
  if (error instanceof ProviderSelectionError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createMgsnProviderSelectionHttpRoutes(
  options: MgsnProviderSelectionHttpOptions = {}
): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const service = () => {
    if (!options.service)
      throw new HttpError(
        503,
        'MGSN_GOVERNED_NETWORK_RUNTIME_UNCONFIGURED',
        'MGSN governed-network runtime is not configured.',
        true
      );
    return options.service;
  };
  const trustedPrincipalFor = (request: JsonRequest): WorkspacePrincipal =>
    trustedWorkspacePrincipalFor(request, secret);
  const operation = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      return mapSelectionError(error);
    }
  };

  return [
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
        const command = parseProviderSelectionCreateCommand(body, principal, envelope, request);
        const result = await operation(() =>
          observeMgsnSemanticOperationV1(
            options.semanticTelemetrySink,
            'PROVIDER_SELECTION_CREATE_OR_REPLACE',
            () => service().createOrReplace(selectionPrincipal(principal, envelope), command),
            (value) => ({
              outcomeClass: 'SUCCESS',
              resultCode: value.mutation === 'CREATED' ? 'CREATED' : 'REPLACED',
              replayed: value.replayed
            })
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
        const command = parseProviderSelectionRevokeCommand(body, principal, envelope, request);
        const result = await operation(() =>
          observeMgsnSemanticOperationV1(
            options.semanticTelemetrySink,
            'PROVIDER_SELECTION_REVOKE',
            () => service().revoke(selectionPrincipal(principal, envelope), command),
            (value) => ({
              outcomeClass: 'SUCCESS',
              resultCode: 'REVOKED',
              replayed: value.replayed
            })
          )
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
        const input = parseProviderSelectionValidationInput(
          body,
          request.params.providerSelectionId
        );
        const result = await operation(() =>
          observeMgsnSemanticOperationV1(
            options.semanticTelemetrySink,
            'PROVIDER_SELECTION_VALIDATE_CURRENT',
            () => service().validateCurrent({ workspaceId: principal.workspaceId }, input),
            (value) =>
              value.currentlyUsable
                ? { outcomeClass: 'SUCCESS', resultCode: 'CURRENTLY_USABLE' }
                : value.denialReason === 'AUTHORITY_UNAVAILABLE'
                  ? { outcomeClass: 'UNAVAILABLE', resultCode: 'AUTHORITY_UNAVAILABLE' }
                  : { outcomeClass: 'DENIED', resultCode: 'VALIDATION_DENIED' }
          )
        );
        return json(200, { providerSelectionValidation: result });
      }
    }
  ];
}
