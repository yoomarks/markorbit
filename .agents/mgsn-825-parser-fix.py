from pathlib import Path
import re

source_path = Path('services/mgsn/src/governed-network-http.ts')
text = source_path.read_text()

old = "import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';"
new = "import {\n  parseInternalWorkspacePrincipal,\n  type MarkOrbitId,\n  type WorkspacePrincipal\n} from '@markorbit/contracts';"
if text.count(old) != 1:
    raise SystemExit('unexpected core contracts import')
text = text.replace(old, new, 1)

old = "import type { ProviderDiscoveryRequestReferenceV1 } from '@markorbit/contracts/provider-discovery';"
new = "import type {\n  ProviderDiscoveryCandidateId,\n  ProviderDiscoveryRequestId,\n  ProviderDiscoveryRequestReferenceV1\n} from '@markorbit/contracts/provider-discovery';"
if text.count(old) != 1:
    raise SystemExit('unexpected provider discovery import')
text = text.replace(old, new, 1)

old = "} from '@markorbit/contracts/provider-selection';\nimport { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';"
new = "} from '@markorbit/contracts/provider-selection';\nimport type {\n  EligibilityEvaluationId,\n  ProviderId,\n  ProviderSupplyCapabilityId,\n  ServicePackageId\n} from '@markorbit/contracts/provider-execution';\nimport { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';"
if text.count(old) != 1:
    raise SystemExit('unexpected provider selection import boundary')
text = text.replace(old, new, 1)

old = "import { GovernedAllocationError, type GovernedAllocationService } from './governed-allocation.js';"
new = "import {\n  GovernedAllocationError,\n  type GovernedAllocationCommand,\n  type GovernedAllocationService\n} from './governed-allocation.js';"
if text.count(old) != 1:
    raise SystemExit('unexpected governed allocation import')
text = text.replace(old, new, 1)

old_human = re.search(
    r"function parseHumanActionEnvelope\([\s\S]*?\n}\n\nfunction selectionPrincipal",
    text,
)
if not old_human:
    raise SystemExit('parseHumanActionEnvelope not found')
new_human = r'''function parseHumanActionEnvelope(
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
  const envelope = parsed as Record<string, unknown>;
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
  const textField = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim())
      throw new HttpError(
        403,
        'INVALID_GOVERNED_HUMAN_ACTION',
        'Governed-network human-action authority is invalid.'
      );
    return value.trim();
  };
  const workspaceId = textField(envelope.workspaceId);
  const userId = textField(envelope.userId);
  const membershipId = textField(envelope.membershipId);
  const principalReference = textField(envelope.principalReference);
  const authorityReference = textField(envelope.authorityReference);
  const authenticatedAt = textField(envelope.authenticatedAt);
  const affirmativeHumanActionEvidenceReference = textField(
    envelope.affirmativeHumanActionEvidenceReference
  );
  const authorityVersion = envelope.authorityVersion;
  if (
    envelope.schemaVersion !== 1 ||
    envelope.kind !== expectedKind ||
    envelope.actorKind !== 'HUMAN_USER' ||
    envelope.payloadIdentityAuthoritative !== false ||
    !validVersion(authorityVersion) ||
    !Number.isFinite(Date.parse(authenticatedAt)) ||
    workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase() ||
    userId.toLowerCase() !== principal.userId.toLowerCase() ||
    membershipId.toLowerCase() !== principal.membershipId.toLowerCase()
  )
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority does not match the trusted Workspace Principal.'
    );
  return {
    schemaVersion: 1,
    kind: expectedKind,
    actorKind: 'HUMAN_USER',
    workspaceId,
    userId,
    membershipId,
    principalReference,
    authorityReference,
    authorityVersion,
    authenticatedAt,
    affirmativeHumanActionEvidenceReference,
    payloadIdentityAuthoritative: false
  };
}

function selectionPrincipal'''
text = text[: old_human.start()] + new_human + text[old_human.end() :]

parser_block = r'''
const governedSha256Pattern = /^[0-9a-f]{64}$/;
const governedWorkspaceUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidGovernedValue(field: string, expectation: string): never {
  throw new HttpError(
    400,
    'INVALID_GOVERNED_NETWORK_REQUEST',
    `${field} ${expectation}`
  );
}

function requiredString(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalidGovernedValue(field, 'must be a string.');
  const text = value.trim();
  if (!text || text.length > maximum)
    return invalidGovernedValue(
      field,
      `must be non-empty and no longer than ${maximum} characters.`
    );
  return text;
}

function optionalString(value: unknown, field: string, maximum = 500): string | undefined {
  return value === undefined ? undefined : requiredString(value, field, maximum);
}

function requiredLiteral<const T extends string | number | boolean>(
  value: unknown,
  expected: T,
  field: string
): T {
  if (value !== expected)
    return invalidGovernedValue(field, `must equal ${JSON.stringify(expected)}.`);
  return expected;
}

function requiredEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] {
  if (typeof value !== 'string' || !allowed.some((candidate) => candidate === value))
    return invalidGovernedValue(field, `must be one of ${allowed.join(', ')}.`);
  return value as T[number];
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    return invalidGovernedValue(field, 'must be a positive integer.');
  return Number(value);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0)
    return invalidGovernedValue(field, 'must be a non-negative integer.');
  return Number(value);
}

function versionValue(value: unknown, field: string): number | string {
  if (typeof value === 'number') return positiveInteger(value, field);
  return requiredString(value, field, 200);
}

function timestamp(value: unknown, field: string): string {
  const text = requiredString(value, field, 100);
  if (!Number.isFinite(Date.parse(text))) return invalidGovernedValue(field, 'must be an ISO timestamp.');
  return text;
}

function optionalTimestamp(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : timestamp(value, field);
}

function sha256(value: unknown, field: string): string {
  const text = requiredString(value, field, 64);
  if (!governedSha256Pattern.test(text))
    return invalidGovernedValue(field, 'must be a lowercase SHA-256 value.');
  return text;
}

function workspaceUuid(value: unknown, field: string): string {
  const text = requiredString(value, field, 100).toLowerCase();
  if (!governedWorkspaceUuidPattern.test(text))
    return invalidGovernedValue(field, 'must be a Core Workspace UUID.');
  return text;
}

function prefixedId<T extends string>(value: unknown, prefix: string, field: string): T {
  const text = requiredString(value, field, 200);
  if (!text.startsWith(prefix) || text.length === prefix.length)
    return invalidGovernedValue(field, `must start with ${prefix}.`);
  return text as T;
}

function markOrbitId(value: unknown, field: string): MarkOrbitId {
  const text = requiredString(value, field, 200);
  const separator = text.indexOf('_');
  if (separator < 1 || separator === text.length - 1)
    return invalidGovernedValue(field, 'must be a MarkOrbit reference with an underscore separator.');
  return text as MarkOrbitId;
}

function arrayValue(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) return invalidGovernedValue(field, 'must be an array.');
  if (value.length > 1000) return invalidGovernedValue(field, 'contains too many entries.');
  return value;
}

function parsedArray<T>(
  value: unknown,
  field: string,
  parser: (item: unknown, itemField: string) => T
): T[] {
  return arrayValue(value, field).map((item, index) => parser(item, `${field}[${index}]`));
}

function stringArray(value: unknown, field: string): string[] {
  return parsedArray(value, field, (item, itemField) => requiredString(item, itemField, 500));
}

function enumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number][] {
  return parsedArray(value, field, (item, itemField) => requiredEnum(item, allowed, itemField));
}

function parseSelectionScope(
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

function parseSelectionVersionReference(
  value: unknown,
  field: string
): CreateOrReplaceProviderSelectionCommandV1['expectedCurrent'] extends infer _T
  ? Readonly<{ providerSelectionId: ProviderSelectionId; version: number; scopeVersion: number }>
  : never {
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

function parseCurrentSourceVersion(
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

function parseDiscoveryAudience(
  value: unknown,
  field: string
): ProviderDiscoveryRequestReferenceV1['audience'] {
  const audience = objectOf(value, field);
  const kind = requiredEnum(
    audience.kind,
    ['TRUSTED_RELATIONSHIP', 'BOUNDED_NETWORK'] as const,
    `${field}.kind`
  );
  if (kind === 'BOUNDED_NETWORK') {
    if (audience.relationshipAuthorityReference !== undefined)
      throw new HttpError(
        400,
        'UNEXPECTED_GOVERNED_NETWORK_FIELD',
        `${field}.relationshipAuthorityReference is not permitted for BOUNDED_NETWORK.`
      );
    return { kind };
  }
  return {
    kind,
    relationshipAuthorityReference: requiredString(
      audience.relationshipAuthorityReference,
      `${field}.relationshipAuthorityReference`,
      200
    )
  };
}

function parseDiscoveryRequest(
  body: Body,
  requesterWorkspaceId: string
): ProviderDiscoveryRequestReferenceV1 {
  const need = objectOf(body.need, 'body.need');
  return {
    schemaVersion: requiredLiteral(body.schemaVersion, 1, 'body.schemaVersion'),
    providerDiscoveryRequestId: prefixedId<ProviderDiscoveryRequestId>(
      body.providerDiscoveryRequestId,
      'provider-discovery-request_',
      'body.providerDiscoveryRequestId'
    ),
    requesterWorkspaceId,
    need: {
      reference: requiredString(need.reference, 'body.need.reference'),
      version: versionValue(need.version, 'body.need.version'),
      fingerprintSha256: sha256(need.fingerprintSha256, 'body.need.fingerprintSha256'),
      jurisdiction: requiredString(need.jurisdiction, 'body.need.jurisdiction', 100),
      serviceType: requiredString(need.serviceType, 'body.need.serviceType', 200)
    },
    purpose: requiredLiteral(body.purpose, 'PROVIDER_DISCOVERY', 'body.purpose'),
    audience: parseDiscoveryAudience(body.audience, 'body.audience'),
    contextReference: requiredString(body.contextReference, 'body.contextReference'),
    requestedDataClasses: enumArray(
      body.requestedDataClasses,
      [
        'ORGANIZATION_IDENTITY',
        'PROVIDER_REFERENCE',
        'SUPPLY_PROFILE',
        'SERVICE_JURISDICTIONS',
        'PROVIDER_EVIDENCE_REFERENCE'
      ] as const,
      'body.requestedDataClasses'
    ),
    requestedFields: enumArray(
      body.requestedFields,
      ['displayName', 'providerId', 'serviceTypes', 'jurisdictions', 'evidenceReferences'] as const,
      'body.requestedFields'
    ),
    requestedAt: timestamp(body.requestedAt, 'body.requestedAt'),
    requestFingerprintSha256: sha256(
      body.requestFingerprintSha256,
      'body.requestFingerprintSha256'
    ),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
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
    authorityReference: requiredString(authority.authorityReference, `${field}.authorityReference`, 200),
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
          ['CORE', 'LITE', 'MARKREG', 'MGSN', 'EXECUTION', 'KNOWLEDGE', 'OTHER_CANONICAL_OWNER'] as const,
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
    wildcardAllowed: requiredLiteral(
      projection.wildcardAllowed,
      false,
      `${field}.wildcardAllowed`
    ),
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
  const mode = requiredEnum(handoffBinding.mode, ['NONE_EXPLICIT', 'EXACT'] as const, 'body.handoffBinding.mode');
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
'''

marker = "\nfunction mapDomainError(error: unknown): never {"
if text.count(marker) != 1:
    raise SystemExit('mapDomainError marker missing')
text = text.replace(marker, parser_block + marker, 1)

# Route: Discovery now consumes only a fully parsed DTO.
pattern = re.compile(
    r"        const audience =[\s\S]*?        } as unknown as ProviderDiscoveryRequestReferenceV1;\n",
)
text, count = pattern.subn(
    "        const discoveryRequest = parseDiscoveryRequest(body, principal.workspaceId);\n",
    text,
    count=1,
)
if count != 1:
    raise SystemExit('discovery route replacement failed')

# Route: Selection create parser/builder after human-action and union-precedence checks.
pattern = re.compile(
    r"        const sourceLineage = objectOf\(body\.sourceLineage, 'sourceLineage'\);[\s\S]*?        } as unknown as CreateOrReplaceProviderSelectionCommandV1;\n",
)
text, count = pattern.subn(
    "        const command = parseProviderSelectionCreateCommand(body, principal, envelope, request);\n",
    text,
    count=1,
)
if count != 1:
    raise SystemExit('selection create route replacement failed')

pattern = re.compile(
    r"        const target = objectOf\(body\.target, 'target'\);[\s\S]*?        } as unknown as RevokeProviderSelectionCommandV1;\n",
)
text, count = pattern.subn(
    "        const command = parseProviderSelectionRevokeCommand(body, principal, envelope, request);\n",
    text,
    count=1,
)
if count != 1:
    raise SystemExit('selection revoke route replacement failed')

pattern = re.compile(
    r"        const purpose = body\.purpose as ProviderSelectionValidationPurpose;[\s\S]*?        const result = await operation\(\(\) =>\n          services\(\)\.providerSelection\.validateCurrent\(\n            \{ workspaceId: principal\.workspaceId \},\n            \{[\s\S]*?            \}\n          \)\n        \);",
)
replacement = """        const input = parseProviderSelectionValidationInput(\n          body,\n          request.params.providerSelectionId\n        );\n        const result = await operation(() =>\n          services().providerSelection.validateCurrent({ workspaceId: principal.workspaceId }, input)\n        );"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('selection validate route replacement failed')

pattern = re.compile(
    r"        const preview = objectOf\([\s\S]*?        } as unknown as AuthorizeOrReplaceControlledHandoffCommandV1;\n",
)
text, count = pattern.subn(
    "        const command = parseControlledHandoffAuthorizeCommand(body, principal, envelope, request);\n",
    text,
    count=1,
)
if count != 1:
    raise SystemExit('handoff authorize route replacement failed')

pattern = re.compile(
    r"        const target = objectOf\(body\.target, 'target'\);[\s\S]*?        } as unknown as RevokeControlledHandoffCommandV1;\n",
)
text, count = pattern.subn(
    "        const command = parseControlledHandoffRevokeCommand(body, principal, envelope, request);\n",
    text,
    count=1,
)
if count != 1:
    raise SystemExit('handoff revoke route replacement failed')

old = """        const envelope = objectOf(body.envelope, 'envelope');\n        const attempt = objectOf(body.attempt, 'attempt');"""
new = """        const attempt = objectOf(body.attempt, 'attempt');"""
if text.count(old) != 1:
    raise SystemExit('handoff validation precheck block missing')
text = text.replace(old, new, 1)

pattern = re.compile(
    r"        const validationAttempt = \{[\s\S]*?        const result = await operation\(\(\) =>\n          services\(\)\.controlledHandoff\.validateCurrent\(\n            \{ workspaceId: principal\.workspaceId \},\n            \{[\s\S]*?            \}\n          \)\n        \);",
)
replacement = """        const input = parseControlledHandoffValidationInput(\n          body,\n          request.params.controlledHandoffId,\n          principal.workspaceId\n        );\n        const result = await operation(() =>\n          services().controlledHandoff.validateCurrent({ workspaceId: principal.workspaceId }, input)\n        );"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('handoff validate route replacement failed')

pattern = re.compile(
    r"        const result = await operation\(\(\) =>\n          services\(\)\.governedAllocation\.allocate\(\{[\s\S]*?          } as Parameters<GovernedAllocationService\['allocate'\]>\[0\]\)\n        \);",
)
replacement = """        const command = parseGovernedAllocationCommand(body, principal, idempotencyKey);\n        const result = await operation(() => services().governedAllocation.allocate(command));"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('allocation route replacement failed')

source_path.write_text(text)

# Boundary tests now exercise complete valid transport DTOs and malformed scalar rejection.
test_path = Path('services/mgsn/tests/governed-network-http.test.ts')
test = test_path.read_text()
import_marker = "import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';\n"
fixture_imports = """import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';\nimport { controlledHandoffContractFixtureV1 } from '@markorbit/contracts/controlled-privacy-handoff';\nimport { providerDiscoveryContractFixtureV1 } from '@markorbit/contracts/provider-discovery';\nimport { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';\n"""
if test.count(import_marker) != 1:
    raise SystemExit('test import marker missing')
test = test.replace(import_marker, fixture_imports, 1)

helpers = r'''
function discoveryBody() {
  const body = structuredClone(providerDiscoveryContractFixtureV1.candidateResult.request) as any;
  delete body.requesterWorkspaceId;
  return body;
}

function selectionCreateBody() {
  const body = structuredClone(providerSelectionContractFixtureV1.createCommand) as any;
  delete body.requesterWorkspaceId;
  delete body.trustedHumanAuthority;
  delete body.idempotencyKey;
  body.sourceLineage.discoveryRequest.requesterWorkspaceId = 'ignored-lineage-input';
  return body;
}

function handoffAuthorizeBody() {
  const body = structuredClone(controlledHandoffContractFixtureV1.authorizeCommand) as any;
  delete body.originatingWorkspaceId;
  delete body.trustedHumanAuthority;
  delete body.idempotencyKey;
  body.privacyPreviewAcknowledgement.originatingWorkspaceId = 'ignored-preview-input';
  return body;
}

function governedAllocationBody() {
  return {
    servicePackageId: 'service-package_http-825',
    expectedServicePackageVersion: 1,
    expectedServicePackageFingerprintSha256: 'a'.repeat(64),
    eligibilityEvaluationId: 'eligibility-evaluation_http-825',
    expectedEligibilityEvaluationVersion: 1,
    expectedEligibilityFingerprintSha256: 'b'.repeat(64),
    providerId: 'provider_http-825',
    providerSupplyCapabilityId: 'provider-supply-capability_http-825',
    expectedProviderSupplyCapabilityVersion: 1,
    rationale: 'Allocate the exact reviewed Provider.',
    selection: { providerSelectionId: selectionId, version: 1, scopeVersion: 1 },
    selectionScope: {
      owner: 'LITE',
      reference: 'need:http-825',
      version: 1,
      fingerprintSha256: '1'.repeat(64)
    },
    handoffBinding: { mode: 'NONE_EXPLICIT' },
    correlationId: 'correlation_http_825_allocation'
  };
}
'''
marker = "\nbeforeEach(async () => {"
if test.count(marker) != 1:
    raise SystemExit('test helper insertion marker missing')
test = test.replace(marker, helpers + marker, 1)

old = "body: JSON.stringify({ schemaVersion: 1, providerDiscoveryRequestId: 'request_http-825' })"
if test.count(old) != 1:
    raise SystemExit('discovery success body missing')
test = test.replace(old, "body: JSON.stringify(discoveryBody())", 1)

selection_body_pattern = re.compile(
    r"      body: JSON\.stringify\(\{\n        schemaVersion: 1,\n        scope: \{[\s\S]*?        correlationId: 'correlation_http_825_selection'\n      \}\)"
)
test, count = selection_body_pattern.subn("      body: JSON.stringify(selectionCreateBody())", test, count=1)
if count != 1:
    raise SystemExit('selection success body replacement failed')

handoff_body_pattern = re.compile(
    r"      body: JSON\.stringify\(\{\n        schemaVersion: 1,\n        privacyPreviewAcknowledgement: \{ originatingWorkspaceId: 'ignored-preview-input' \},\n        commandFingerprintSha256: '3'\.repeat\(64\),\n        correlationId: 'correlation_http_825_handoff'\n      \}\)"
)
test, count = handoff_body_pattern.subn("      body: JSON.stringify(handoffAuthorizeBody())", test, count=1)
if count != 1:
    raise SystemExit('handoff success body replacement failed')

allocation_body_pattern = re.compile(
    r"      body: JSON\.stringify\(\{\n        servicePackageId: 'service-package_http-825',[\s\S]*?        handoffBinding: \{ mode: 'NONE_EXPLICIT' \}\n      \}\)"
)
test, count = allocation_body_pattern.subn("      body: JSON.stringify(governedAllocationBody())", test, count=1)
if count != 1:
    raise SystemExit('allocation success body replacement failed')

new_test = r'''

  it('rejects malformed scalar, timestamp and branded-id input before owner services', async () => {
    const discovery = discoveryBody();
    discovery.requestedAt = 'not-an-instant';
    const discoveryResponse = await fetch(`${base}/v1/governed-network/discovery/evaluate`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify(discovery)
    });
    expect(discoveryResponse.status).toBe(400);
    expect((await discoveryResponse.json()).code).toBe('INVALID_GOVERNED_NETWORK_REQUEST');
    expect(captured).toBeUndefined();

    const selection = selectionCreateBody();
    selection.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId = 'candidate_http-825';
    const selectionResponse = await fetch(`${base}/v1/governed-network/selections`, {
      method: 'POST',
      headers: {
        ...headers({ kind: 'PROVIDER_SELECTION', idempotencyKey: 'selection-invalid-brand' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify(selection)
    });
    expect(selectionResponse.status).toBe(400);
    expect((await selectionResponse.json()).code).toBe('INVALID_GOVERNED_NETWORK_REQUEST');
    expect(captured).toBeUndefined();

    const allocation = governedAllocationBody() as any;
    allocation.expectedServicePackageVersion = '1';
    const allocationResponse = await fetch(`${base}/v1/governed-network/allocations`, {
      method: 'POST',
      headers: {
        ...headers({ idempotencyKey: 'allocation-invalid-version' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify(allocation)
    });
    expect(allocationResponse.status).toBe(400);
    expect((await allocationResponse.json()).code).toBe('INVALID_GOVERNED_NETWORK_REQUEST');
    expect(captured).toBeUndefined();
  });
'''
end_marker = "\n});\n"
pos = test.rfind(end_marker)
if pos < 0:
    raise SystemExit('test suite end marker missing')
test = test[:pos] + new_test + test[pos:]
test_path.write_text(test)
