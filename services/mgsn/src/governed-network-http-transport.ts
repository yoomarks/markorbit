import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  AuthorizeOrReplaceControlledHandoffCommandV1,
  ControlledHandoffAuthorizedProjectionItemV1,
  ControlledHandoffConsumptionAttemptV1,
  ControlledHandoffDirectExecutorAuthorityV1,
  ControlledHandoffId,
  ControlledHandoffPrivacyPreviewAcknowledgementV1,
  ControlledHandoffPurposeV1,
  ControlledHandoffSelectionLineageV1,
  ControlledHandoffSourceLineageV1,
  ControlledHandoffTrustedHumanAuthorityV1,
  ControlledHandoffValidationPurpose,
  RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  DiscoveryCurrentSourceVersionV1,
  ProviderDiscoveryCandidateId,
  ProviderDiscoveryRequestId,
  ProviderDiscoveryRequestReferenceV1
} from '@markorbit/contracts/provider-discovery';
import type {
  EligibilityEvaluationId,
  ProviderId,
  ProviderSupplyCapabilityId,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type {
  CreateOrReplaceProviderSelectionCommandV1,
  ProviderSelectionHumanAcknowledgementV1,
  ProviderSelectionId,
  ProviderSelectionScopeReferenceV1,
  ProviderSelectionSourceLineageV1,
  ProviderSelectionTrustedHumanAuthorityV1,
  ProviderSelectionValidationPurpose,
  ProviderSelectionVersionReferenceV1,
  RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';
import { HttpError } from '@markorbit/service-kit';
import type { GovernedAllocationCommand, GovernedAllocationHandoffBinding } from './governed-allocation.js';

const sha256Pattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const markOrbitIdPattern = /^[^_\s]+_[^\s]+$/;

type RecordValue = Record<string, unknown>;

type BrandedId<TPrefix extends string> = `${TPrefix}_${string}`;

function invalid(field: string, message: string): never {
  throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', `${field} ${message}`);
}

function unexpected(field: string, key: string): never {
  throw new HttpError(
    400,
    'UNEXPECTED_GOVERNED_NETWORK_FIELD',
    `${field}.${key} is not permitted by the governed-network transport contract.`
  );
}

function record(
  value: unknown,
  field: string,
  required: readonly string[],
  optional: readonly string[] = []
): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(field, 'must be an object.');
  const result = value as RecordValue;
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(result)) if (!allowed.has(key)) unexpected(field, key);
  for (const key of required) if (!(key in result)) invalid(`${field}.${key}`, 'is required.');
  return result;
}

function text(value: unknown, field: string, max = 1000): string {
  if (typeof value !== 'string') return invalid(field, 'must be a string.');
  const result = value.trim();
  if (!result || result.length > max) return invalid(field, `must be non-empty and at most ${max} characters.`);
  return result;
}

function optionalText(value: unknown, field: string, max = 1000): string | undefined {
  return value === undefined ? undefined : text(value, field, max);
}

function literal<T extends string | number | boolean>(value: unknown, expected: T, field: string): T {
  if (value !== expected) return invalid(field, `must equal ${JSON.stringify(expected)}.`);
  return expected;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value))
    return invalid(field, `must be one of ${allowed.join(', ')}.`);
  return value as T[number];
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) return invalid(field, 'must be a positive integer.');
  return Number(value);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) return invalid(field, 'must be a non-negative integer.');
  return Number(value);
}

function version(value: unknown, field: string): number | string {
  if (typeof value === 'number') return positiveInteger(value, field);
  return text(value, field, 200);
}

function sha256(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!sha256Pattern.test(result)) return invalid(field, 'must be a lowercase SHA-256 fingerprint.');
  return result;
}

function optionalSha256(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : sha256(value, field);
}

function instant(value: unknown, field: string): string {
  const result = text(value, field, 100);
  if (!Number.isFinite(Date.parse(result))) return invalid(field, 'must be an ISO timestamp.');
  return new Date(result).toISOString();
}

function optionalInstant(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : instant(value, field);
}

function workspaceId(value: unknown, field: string): string {
  const result = text(value, field, 100).toLowerCase();
  if (!uuidPattern.test(result)) return invalid(field, 'must be a Core Workspace UUID.');
  return result;
}

function markOrbitId(value: unknown, field: string): MarkOrbitId {
  const result = text(value, field, 250);
  if (!markOrbitIdPattern.test(result)) return invalid(field, 'must be a MarkOrbit identifier.');
  return result as MarkOrbitId;
}

function brandedId<TPrefix extends string>(value: unknown, prefix: TPrefix, field: string): BrandedId<TPrefix> {
  const result = text(value, field, 250);
  if (!result.startsWith(`${prefix}_`) || result.length <= prefix.length + 1)
    return invalid(field, `must be a ${prefix}_ identifier.`);
  return result as BrandedId<TPrefix>;
}

function stringArray(value: unknown, field: string, allowEmpty = true): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
    return invalid(field, allowEmpty ? 'must be an array.' : 'must be a non-empty array.');
  return value.map((item, index) => text(item, `${field}[${index}]`, 500));
}

function parseSelectionScope(value: unknown, field: string): ProviderSelectionScopeReferenceV1 {
  const body = record(value, field, ['owner', 'reference', 'version', 'fingerprintSha256']);
  return {
    owner: enumValue(
      body.owner,
      ['CORE', 'LITE', 'MARKREG', 'OPERATIONS', 'OTHER_CANONICAL_CONSUMER'] as const,
      `${field}.owner`
    ),
    reference: text(body.reference, `${field}.reference`),
    version: version(body.version, `${field}.version`),
    fingerprintSha256: sha256(body.fingerprintSha256, `${field}.fingerprintSha256`)
  };
}

function parseSelectionReference(value: unknown, field: string): ProviderSelectionVersionReferenceV1 {
  const body = record(value, field, ['providerSelectionId', 'version', 'scopeVersion']);
  return {
    providerSelectionId: brandedId(body.providerSelectionId, 'provider-selection', `${field}.providerSelectionId`) as ProviderSelectionId,
    version: positiveInteger(body.version, `${field}.version`),
    scopeVersion: positiveInteger(body.scopeVersion, `${field}.scopeVersion`)
  };
}

function parseCurrentSourceVersion(value: unknown, field: string): DiscoveryCurrentSourceVersionV1 {
  const body = record(
    value,
    field,
    ['owner', 'sourceType', 'sourceId', 'version', 'checkedAt', 'authorityState'],
    ['fingerprintSha256', 'effectiveFrom', 'effectiveUntil']
  );
  const fingerprintSha256 = optionalSha256(body.fingerprintSha256, `${field}.fingerprintSha256`);
  const effectiveFrom = optionalInstant(body.effectiveFrom, `${field}.effectiveFrom`);
  const effectiveUntil = optionalInstant(body.effectiveUntil, `${field}.effectiveUntil`);
  return {
    owner: enumValue(
      body.owner,
      ['CORE', 'MGSN', 'CAPABILITY_ENGINE', 'OTHER_CANONICAL_OWNER'] as const,
      `${field}.owner`
    ),
    sourceType: text(body.sourceType, `${field}.sourceType`, 200),
    sourceId: text(body.sourceId, `${field}.sourceId`, 250),
    version: version(body.version, `${field}.version`),
    ...(fingerprintSha256 ? { fingerprintSha256 } : {}),
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveUntil ? { effectiveUntil } : {}),
    checkedAt: instant(body.checkedAt, `${field}.checkedAt`),
    authorityState: literal(body.authorityState, 'CURRENT', `${field}.authorityState`)
  };
}

function parseSelectionSourceLineage(value: unknown, field: string): ProviderSelectionSourceLineageV1 {
  const body = record(value, field, [
    'discoveryRequest',
    'discoveryResult',
    'discoveryCandidate',
    'provider',
    'providerSupplyCapability',
    'visibilityAuthorizationAtReview',
    'historicalSourceVersions',
    'directExecutorDisclosureAtReview',
    'currentAuthorityRevalidationRequiredBeforeSelectionCommit',
    'currentAuthorityRevalidationRequiredBeforeDownstreamUse'
  ]);
  const discoveryRequest = record(body.discoveryRequest, `${field}.discoveryRequest`, [
    'providerDiscoveryRequestId',
    'requesterWorkspaceId',
    'requestFingerprintSha256',
    'needReference',
    'needVersion',
    'needFingerprintSha256',
    'purpose',
    'contextReference'
  ]);
  const discoveryResult = record(body.discoveryResult, `${field}.discoveryResult`, [
    'resultFingerprintSha256',
    'evaluatedAt'
  ]);
  const discoveryCandidate = record(body.discoveryCandidate, `${field}.discoveryCandidate`, [
    'providerDiscoveryCandidateId',
    'candidateFingerprintSha256',
    'generatedAt',
    'evaluationPolicyVersion'
  ]);
  const provider = record(body.provider, `${field}.provider`, ['providerId', 'providerWorkspaceId']);
  const supply = record(body.providerSupplyCapability, `${field}.providerSupplyCapability`, [
    'id',
    'version',
    'fingerprintSha256'
  ]);
  const visibility = record(body.visibilityAuthorizationAtReview, `${field}.visibilityAuthorizationAtReview`, [
    'networkParticipationId',
    'participationVersion',
    'visibilityPolicyVersion',
    'evaluatedAt',
    'currentAuthorityRevalidationRequiredBeforeServe'
  ]);
  if (!Array.isArray(body.historicalSourceVersions))
    return invalid(`${field}.historicalSourceVersions`, 'must be an array.');
  const directExecutor = record(body.directExecutorDisclosureAtReview, `${field}.directExecutorDisclosureAtReview`, [
    'state',
    'evidenceReferences'
  ]);
  return {
    discoveryRequest: {
      providerDiscoveryRequestId: brandedId(
        discoveryRequest.providerDiscoveryRequestId,
        'provider-discovery-request',
        `${field}.discoveryRequest.providerDiscoveryRequestId`
      ) as ProviderDiscoveryRequestId,
      requesterWorkspaceId: workspaceId(
        discoveryRequest.requesterWorkspaceId,
        `${field}.discoveryRequest.requesterWorkspaceId`
      ),
      requestFingerprintSha256: sha256(
        discoveryRequest.requestFingerprintSha256,
        `${field}.discoveryRequest.requestFingerprintSha256`
      ),
      needReference: text(discoveryRequest.needReference, `${field}.discoveryRequest.needReference`),
      needVersion: version(discoveryRequest.needVersion, `${field}.discoveryRequest.needVersion`),
      needFingerprintSha256: sha256(
        discoveryRequest.needFingerprintSha256,
        `${field}.discoveryRequest.needFingerprintSha256`
      ),
      purpose: literal(discoveryRequest.purpose, 'PROVIDER_DISCOVERY', `${field}.discoveryRequest.purpose`),
      contextReference: text(discoveryRequest.contextReference, `${field}.discoveryRequest.contextReference`)
    },
    discoveryResult: {
      resultFingerprintSha256: sha256(discoveryResult.resultFingerprintSha256, `${field}.discoveryResult.resultFingerprintSha256`),
      evaluatedAt: instant(discoveryResult.evaluatedAt, `${field}.discoveryResult.evaluatedAt`)
    },
    discoveryCandidate: {
      providerDiscoveryCandidateId: brandedId(
        discoveryCandidate.providerDiscoveryCandidateId,
        'provider-discovery-candidate',
        `${field}.discoveryCandidate.providerDiscoveryCandidateId`
      ) as ProviderDiscoveryCandidateId,
      candidateFingerprintSha256: sha256(
        discoveryCandidate.candidateFingerprintSha256,
        `${field}.discoveryCandidate.candidateFingerprintSha256`
      ),
      generatedAt: instant(discoveryCandidate.generatedAt, `${field}.discoveryCandidate.generatedAt`),
      evaluationPolicyVersion: text(discoveryCandidate.evaluationPolicyVersion, `${field}.discoveryCandidate.evaluationPolicyVersion`, 200)
    },
    provider: {
      providerId: brandedId(provider.providerId, 'provider', `${field}.provider.providerId`) as ProviderId,
      providerWorkspaceId: workspaceId(provider.providerWorkspaceId, `${field}.provider.providerWorkspaceId`)
    },
    providerSupplyCapability: {
      id: brandedId(supply.id, 'provider-supply-capability', `${field}.providerSupplyCapability.id`) as ProviderSupplyCapabilityId,
      version: positiveInteger(supply.version, `${field}.providerSupplyCapability.version`),
      fingerprintSha256: sha256(supply.fingerprintSha256, `${field}.providerSupplyCapability.fingerprintSha256`)
    },
    visibilityAuthorizationAtReview: {
      networkParticipationId: brandedId(
        visibility.networkParticipationId,
        'network-participation',
        `${field}.visibilityAuthorizationAtReview.networkParticipationId`
      ),
      participationVersion: positiveInteger(visibility.participationVersion, `${field}.visibilityAuthorizationAtReview.participationVersion`),
      visibilityPolicyVersion: positiveInteger(visibility.visibilityPolicyVersion, `${field}.visibilityAuthorizationAtReview.visibilityPolicyVersion`),
      evaluatedAt: instant(visibility.evaluatedAt, `${field}.visibilityAuthorizationAtReview.evaluatedAt`),
      currentAuthorityRevalidationRequiredBeforeServe: literal(
        visibility.currentAuthorityRevalidationRequiredBeforeServe,
        true,
        `${field}.visibilityAuthorizationAtReview.currentAuthorityRevalidationRequiredBeforeServe`
      )
    },
    historicalSourceVersions: body.historicalSourceVersions.map((item, index) =>
      parseCurrentSourceVersion(item, `${field}.historicalSourceVersions[${index}]`)
    ),
    directExecutorDisclosureAtReview: {
      state: enumValue(
        directExecutor.state,
        ['UNKNOWN', 'UNPROVEN', 'INDEPENDENT_EVIDENCE_REFERENCED'] as const,
        `${field}.directExecutorDisclosureAtReview.state`
      ),
      evidenceReferences: stringArray(
        directExecutor.evidenceReferences,
        `${field}.directExecutorDisclosureAtReview.evidenceReferences`
      )
    },
    currentAuthorityRevalidationRequiredBeforeSelectionCommit: literal(
      body.currentAuthorityRevalidationRequiredBeforeSelectionCommit,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeSelectionCommit`
    ),
    currentAuthorityRevalidationRequiredBeforeDownstreamUse: literal(
      body.currentAuthorityRevalidationRequiredBeforeDownstreamUse,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeDownstreamUse`
    )
  };
}

function parseSelectionAcknowledgement(value: unknown, field: string): ProviderSelectionHumanAcknowledgementV1 {
  const body = record(
    value,
    field,
    [
      'affirmativeHumanAction',
      'acknowledgementCode',
      'acknowledgementTextVersion',
      'reviewedCandidateId',
      'reviewedCandidateFingerprintSha256',
      'reviewedScopeFingerprintSha256',
      'reviewedAt',
      'reasonCode',
      'containsCustomerDocuments',
      'containsRawEvidenceArtifacts',
      'containsEndClientRelationshipInformation',
      'containsApplicantOwnerOfficialData',
      'containsCommercialMarginOrProfit'
    ],
    ['rationale']
  );
  const rationale = optionalText(body.rationale, `${field}.rationale`, 500);
  return {
    affirmativeHumanAction: literal(body.affirmativeHumanAction, true, `${field}.affirmativeHumanAction`),
    acknowledgementCode: literal(body.acknowledgementCode, 'HUMAN_PROVIDER_SELECTION_V1', `${field}.acknowledgementCode`),
    acknowledgementTextVersion: text(body.acknowledgementTextVersion, `${field}.acknowledgementTextVersion`, 100),
    reviewedCandidateId: brandedId(body.reviewedCandidateId, 'provider-discovery-candidate', `${field}.reviewedCandidateId`) as ProviderDiscoveryCandidateId,
    reviewedCandidateFingerprintSha256: sha256(body.reviewedCandidateFingerprintSha256, `${field}.reviewedCandidateFingerprintSha256`),
    reviewedScopeFingerprintSha256: sha256(body.reviewedScopeFingerprintSha256, `${field}.reviewedScopeFingerprintSha256`),
    reviewedAt: instant(body.reviewedAt, `${field}.reviewedAt`),
    reasonCode: enumValue(
      body.reasonCode,
      ['FIT_FOR_REVIEWED_NEED', 'JURISDICTION_AND_SERVICE_MATCH', 'EVIDENCE_AND_LIMITATIONS_REVIEWED', 'OTHER_BOUNDED_REASON'] as const,
      `${field}.reasonCode`
    ),
    ...(rationale ? { rationale } : {}),
    containsCustomerDocuments: literal(body.containsCustomerDocuments, false, `${field}.containsCustomerDocuments`),
    containsRawEvidenceArtifacts: literal(body.containsRawEvidenceArtifacts, false, `${field}.containsRawEvidenceArtifacts`),
    containsEndClientRelationshipInformation: literal(body.containsEndClientRelationshipInformation, false, `${field}.containsEndClientRelationshipInformation`),
    containsApplicantOwnerOfficialData: literal(body.containsApplicantOwnerOfficialData, false, `${field}.containsApplicantOwnerOfficialData`),
    containsCommercialMarginOrProfit: literal(body.containsCommercialMarginOrProfit, false, `${field}.containsCommercialMarginOrProfit`)
  };
}

export function parseProviderDiscoveryTransport(
  value: unknown,
  trustedWorkspaceId: string
): ProviderDiscoveryRequestReferenceV1 {
  const body = record(value, 'body', [
    'schemaVersion',
    'providerDiscoveryRequestId',
    'need',
    'purpose',
    'audience',
    'contextReference',
    'requestedDataClasses',
    'requestedFields',
    'requestedAt',
    'requestFingerprintSha256',
    'correlationId'
  ]);
  const need = record(body.need, 'body.need', [
    'reference',
    'version',
    'fingerprintSha256',
    'jurisdiction',
    'serviceType'
  ]);
  const audience = record(body.audience, 'body.audience', ['kind'], ['relationshipAuthorityReference']);
  const audienceKind = enumValue(audience.kind, ['TRUSTED_RELATIONSHIP', 'BOUNDED_NETWORK'] as const, 'body.audience.kind');
  const parsedAudience =
    audienceKind === 'TRUSTED_RELATIONSHIP'
      ? {
          kind: audienceKind,
          relationshipAuthorityReference: text(
            audience.relationshipAuthorityReference,
            'body.audience.relationshipAuthorityReference'
          )
        }
      : (() => {
          if (audience.relationshipAuthorityReference !== undefined)
            unexpected('body.audience', 'relationshipAuthorityReference');
          return { kind: audienceKind } as const;
        })();
  return {
    schemaVersion: literal(body.schemaVersion, 1, 'body.schemaVersion'),
    providerDiscoveryRequestId: brandedId(
      body.providerDiscoveryRequestId,
      'provider-discovery-request',
      'body.providerDiscoveryRequestId'
    ) as ProviderDiscoveryRequestId,
    requesterWorkspaceId: workspaceId(trustedWorkspaceId, 'trustedWorkspaceId'),
    need: {
      reference: text(need.reference, 'body.need.reference'),
      version: version(need.version, 'body.need.version'),
      fingerprintSha256: sha256(need.fingerprintSha256, 'body.need.fingerprintSha256'),
      jurisdiction: text(need.jurisdiction, 'body.need.jurisdiction', 100),
      serviceType: text(need.serviceType, 'body.need.serviceType', 200)
    },
    purpose: literal(body.purpose, 'PROVIDER_DISCOVERY', 'body.purpose'),
    audience: parsedAudience,
    contextReference: text(body.contextReference, 'body.contextReference'),
    requestedDataClasses: stringArray(body.requestedDataClasses, 'body.requestedDataClasses', false) as ProviderDiscoveryRequestReferenceV1['requestedDataClasses'],
    requestedFields: stringArray(body.requestedFields, 'body.requestedFields', false) as ProviderDiscoveryRequestReferenceV1['requestedFields'],
    requestedAt: instant(body.requestedAt, 'body.requestedAt'),
    requestFingerprintSha256: sha256(body.requestFingerprintSha256, 'body.requestFingerprintSha256'),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

export function parseProviderSelectionCreateTransport(input: {
  value: unknown;
  trustedWorkspaceId: string;
  trustedAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>;
  idempotencyKey: string;
}): CreateOrReplaceProviderSelectionCommandV1 {
  const body = record(input.value, 'body', [
    'schemaVersion',
    'scope',
    'sourceLineage',
    'acknowledgement',
    'expectedCurrent',
    'commandFingerprintSha256',
    'correlationId'
  ], ['idempotencyKey']);
  const expected = record(
    body.expectedCurrent,
    'body.expectedCurrent',
    ['kind', 'expectedScopeVersion'],
    ['providerSelectionId', 'version']
  );
  const kind = enumValue(expected.kind, ['ABSENT', 'EXACT'] as const, 'body.expectedCurrent.kind');
  const expectedCurrent =
    kind === 'ABSENT'
      ? (() => {
          if (expected.providerSelectionId !== undefined) unexpected('body.expectedCurrent', 'providerSelectionId');
          if (expected.version !== undefined) unexpected('body.expectedCurrent', 'version');
          return {
            kind,
            expectedScopeVersion: nonNegativeInteger(expected.expectedScopeVersion, 'body.expectedCurrent.expectedScopeVersion')
          } as const;
        })()
      : {
          kind,
          providerSelectionId: brandedId(
            expected.providerSelectionId,
            'provider-selection',
            'body.expectedCurrent.providerSelectionId'
          ) as ProviderSelectionId,
          version: positiveInteger(expected.version, 'body.expectedCurrent.version'),
          expectedScopeVersion: positiveInteger(expected.expectedScopeVersion, 'body.expectedCurrent.expectedScopeVersion')
        } as const;
  const lineage = parseSelectionSourceLineage(body.sourceLineage, 'body.sourceLineage');
  return {
    schemaVersion: literal(body.schemaVersion, 1, 'body.schemaVersion'),
    requesterWorkspaceId: workspaceId(input.trustedWorkspaceId, 'trustedWorkspaceId'),
    scope: parseSelectionScope(body.scope, 'body.scope'),
    sourceLineage: {
      ...lineage,
      discoveryRequest: {
        ...lineage.discoveryRequest,
        requesterWorkspaceId: workspaceId(input.trustedWorkspaceId, 'trustedWorkspaceId')
      }
    },
    trustedHumanAuthority: input.trustedAuthority,
    acknowledgement: parseSelectionAcknowledgement(body.acknowledgement, 'body.acknowledgement'),
    expectedCurrent,
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 500),
    commandFingerprintSha256: sha256(body.commandFingerprintSha256, 'body.commandFingerprintSha256'),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

export function parseProviderSelectionRevokeTransport(input: {
  value: unknown;
  routeProviderSelectionId: string;
  trustedWorkspaceId: string;
  trustedAuthority: Readonly<ProviderSelectionTrustedHumanAuthorityV1>;
  idempotencyKey: string;
}): RevokeProviderSelectionCommandV1 {
  const body = record(
    input.value,
    'body',
    ['schemaVersion', 'scope', 'target', 'reasonCode', 'commandFingerprintSha256', 'correlationId'],
    ['rationale', 'idempotencyKey']
  );
  const targetBody = record(body.target, 'body.target', ['version', 'scopeVersion'], ['providerSelectionId']);
  const routeId = brandedId(input.routeProviderSelectionId, 'provider-selection', 'route.providerSelectionId') as ProviderSelectionId;
  if (targetBody.providerSelectionId !== undefined) {
    const payloadId = brandedId(targetBody.providerSelectionId, 'provider-selection', 'body.target.providerSelectionId');
    if (payloadId !== routeId)
      throw new HttpError(400, 'GOVERNED_NETWORK_TARGET_MISMATCH', 'Selection route target does not match the command target.');
  }
  const rationale = optionalText(body.rationale, 'body.rationale', 500);
  return {
    schemaVersion: literal(body.schemaVersion, 1, 'body.schemaVersion'),
    requesterWorkspaceId: workspaceId(input.trustedWorkspaceId, 'trustedWorkspaceId'),
    scope: parseSelectionScope(body.scope, 'body.scope'),
    target: {
      providerSelectionId: routeId,
      version: positiveInteger(targetBody.version, 'body.target.version'),
      scopeVersion: positiveInteger(targetBody.scopeVersion, 'body.target.scopeVersion')
    },
    trustedHumanAuthority: input.trustedAuthority,
    reasonCode: enumValue(body.reasonCode, ['HUMAN_WITHDRAWAL', 'SCOPE_CANCELLED', 'OTHER_BOUNDED_REASON'] as const, 'body.reasonCode'),
    ...(rationale ? { rationale } : {}),
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 500),
    commandFingerprintSha256: sha256(body.commandFingerprintSha256, 'body.commandFingerprintSha256'),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

export function parseProviderSelectionValidationTransport(
  value: unknown,
  routeProviderSelectionId: string
): {
  scope: ProviderSelectionScopeReferenceV1;
  providerSelectionId: ProviderSelectionId;
  purpose: ProviderSelectionValidationPurpose;
  checkedAt?: string;
} {
  const body = record(value, 'body', ['scope', 'purpose'], ['checkedAt']);
  const checkedAt = optionalInstant(body.checkedAt, 'body.checkedAt');
  return {
    scope: parseSelectionScope(body.scope, 'body.scope'),
    providerSelectionId: brandedId(routeProviderSelectionId, 'provider-selection', 'route.providerSelectionId') as ProviderSelectionId,
    purpose: enumValue(
      body.purpose,
      ['CONTROLLED_HANDOFF_REVIEW', 'ALLOCATION_PREREQUISITE_REVIEW'] as const,
      'body.purpose'
    ),
    ...(checkedAt ? { checkedAt } : {})
  };
}

function parseHandoffPurpose(value: unknown, field: string): ControlledHandoffPurposeV1 {
  const body = record(value, field, [
    'code',
    'contextReference',
    'instructionReference',
    'purposeFingerprintSha256',
    'unrestrictedPurposeAllowed'
  ]);
  return {
    code: enumValue(
      body.code,
      ['PROFESSIONAL_SERVICE_PREPARATION', 'PROFESSIONAL_EVIDENCE_REVIEW', 'JURISDICTIONAL_INSTRUCTION_REVIEW', 'OTHER_CANONICAL_BOUNDED_PURPOSE'] as const,
      `${field}.code`
    ),
    contextReference: text(body.contextReference, `${field}.contextReference`),
    instructionReference: text(body.instructionReference, `${field}.instructionReference`),
    purposeFingerprintSha256: sha256(body.purposeFingerprintSha256, `${field}.purposeFingerprintSha256`),
    unrestrictedPurposeAllowed: literal(body.unrestrictedPurposeAllowed, false, `${field}.unrestrictedPurposeAllowed`)
  };
}

function parseProjectionItem(value: unknown, field: string): ControlledHandoffAuthorizedProjectionItemV1 {
  const body = record(value, field, [
    'dataClass',
    'fieldPath',
    'sourceOwner',
    'sourceReference',
    'sourceVersion',
    'sourceFingerprintSha256',
    'necessityReference',
    'requested',
    'authorizedBySourceOwner',
    'minimumNecessary',
    'fieldValueEmbeddedInEnvelope',
    'evidenceArtifactRetrievalAuthority'
  ]);
  return {
    dataClass: enumValue(
      body.dataClass,
      ['ORIGINATING_WORKSPACE_REFERENCE', 'PROVIDER_REFERENCE', 'NEED_WORK_PACKAGE_REFERENCE', 'APPLICANT_OWNER_OFFICIAL_DATA', 'TRADEMARK_MATTER_MINIMUM_WORKING_DATA', 'PROVIDER_EVIDENCE_REFERENCES', 'PROFESSIONAL_INSTRUCTION_FIELDS'] as const,
      `${field}.dataClass`
    ),
    fieldPath: text(body.fieldPath, `${field}.fieldPath`),
    sourceOwner: enumValue(
      body.sourceOwner,
      ['CORE', 'LITE', 'MARKREG', 'MGSN', 'EXECUTION', 'KNOWLEDGE', 'OTHER_CANONICAL_OWNER'] as const,
      `${field}.sourceOwner`
    ),
    sourceReference: text(body.sourceReference, `${field}.sourceReference`),
    sourceVersion: version(body.sourceVersion, `${field}.sourceVersion`),
    sourceFingerprintSha256: sha256(body.sourceFingerprintSha256, `${field}.sourceFingerprintSha256`),
    necessityReference: text(body.necessityReference, `${field}.necessityReference`),
    requested: literal(body.requested, true, `${field}.requested`),
    authorizedBySourceOwner: literal(body.authorizedBySourceOwner, true, `${field}.authorizedBySourceOwner`),
    minimumNecessary: literal(body.minimumNecessary, true, `${field}.minimumNecessary`),
    fieldValueEmbeddedInEnvelope: literal(body.fieldValueEmbeddedInEnvelope, false, `${field}.fieldValueEmbeddedInEnvelope`),
    evidenceArtifactRetrievalAuthority: enumValue(
      body.evidenceArtifactRetrievalAuthority,
      ['NOT_APPLICABLE', 'SEPARATE_AUTHORITY_REQUIRED'] as const,
      `${field}.evidenceArtifactRetrievalAuthority`
    )
  };
}

function parseAuthorizedProjection(value: unknown, field: string): AuthorizeOrReplaceControlledHandoffCommandV1['authorizedProjection'] {
  const body = record(value, field, [
    'schemaVersion',
    'items',
    'projectionFingerprintSha256',
    'sourceSetFingerprintSha256',
    'wildcardAllowed',
    'wholeRecordAllowed',
    'implicitFieldExpansionAllowed',
    'fieldValuesEmbeddedInEnvelope',
    'requestedAuthorizedMinimumNecessaryIntersectionRequired',
    'forbiddenGenericDataClasses'
  ]);
  if (!Array.isArray(body.items)) return invalid(`${field}.items`, 'must be an array.');
  const forbidden = stringArray(body.forbiddenGenericDataClasses, `${field}.forbiddenGenericDataClasses`).map((item, index) =>
    enumValue(
      item,
      ['END_CLIENT_RELATIONSHIP_INFORMATION', 'ORIGINATING_WORKSPACE_PRICING_MARGIN_PROFIT', 'PRIVATE_CRM_CONTEXT', 'UNRELATED_COMMUNICATIONS', 'UNRELATED_ASSETS_OR_MATTERS'] as const,
      `${field}.forbiddenGenericDataClasses[${index}]`
    )
  );
  return {
    schemaVersion: literal(body.schemaVersion, 1, `${field}.schemaVersion`),
    items: body.items.map((item, index) => parseProjectionItem(item, `${field}.items[${index}]`)),
    projectionFingerprintSha256: sha256(body.projectionFingerprintSha256, `${field}.projectionFingerprintSha256`),
    sourceSetFingerprintSha256: sha256(body.sourceSetFingerprintSha256, `${field}.sourceSetFingerprintSha256`),
    wildcardAllowed: literal(body.wildcardAllowed, false, `${field}.wildcardAllowed`),
    wholeRecordAllowed: literal(body.wholeRecordAllowed, false, `${field}.wholeRecordAllowed`),
    implicitFieldExpansionAllowed: literal(body.implicitFieldExpansionAllowed, false, `${field}.implicitFieldExpansionAllowed`),
    fieldValuesEmbeddedInEnvelope: literal(body.fieldValuesEmbeddedInEnvelope, false, `${field}.fieldValuesEmbeddedInEnvelope`),
    requestedAuthorizedMinimumNecessaryIntersectionRequired: literal(
      body.requestedAuthorizedMinimumNecessaryIntersectionRequired,
      true,
      `${field}.requestedAuthorizedMinimumNecessaryIntersectionRequired`
    ),
    forbiddenGenericDataClasses: forbidden
  };
}

function parseHandoffSelectionLineage(value: unknown, field: string): ControlledHandoffSelectionLineageV1 {
  const body = record(value, field, [
    'selection',
    'selectionScope',
    'selectionFingerprintSha256',
    'selectedProvider',
    'currentSelectionValidation'
  ]);
  const selectedProvider = record(body.selectedProvider, `${field}.selectedProvider`, ['providerId', 'providerWorkspaceId']);
  const validation = record(body.currentSelectionValidation, `${field}.currentSelectionValidation`, [
    'purpose',
    'decision',
    'currentlyUsable',
    'evaluatedAt',
    'validationPolicyVersion',
    'checkedAuthorityReferences'
  ]);
  return {
    selection: parseSelectionReference(body.selection, `${field}.selection`),
    selectionScope: parseSelectionScope(body.selectionScope, `${field}.selectionScope`),
    selectionFingerprintSha256: sha256(body.selectionFingerprintSha256, `${field}.selectionFingerprintSha256`),
    selectedProvider: {
      providerId: brandedId(selectedProvider.providerId, 'provider', `${field}.selectedProvider.providerId`) as ProviderId,
      providerWorkspaceId: workspaceId(selectedProvider.providerWorkspaceId, `${field}.selectedProvider.providerWorkspaceId`)
    },
    currentSelectionValidation: {
      purpose: literal(validation.purpose, 'CONTROLLED_HANDOFF_REVIEW', `${field}.currentSelectionValidation.purpose`),
      decision: literal(validation.decision, 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW', `${field}.currentSelectionValidation.decision`),
      currentlyUsable: literal(validation.currentlyUsable, true, `${field}.currentSelectionValidation.currentlyUsable`),
      evaluatedAt: instant(validation.evaluatedAt, `${field}.currentSelectionValidation.evaluatedAt`),
      validationPolicyVersion: text(validation.validationPolicyVersion, `${field}.currentSelectionValidation.validationPolicyVersion`, 200),
      checkedAuthorityReferences: stringArray(validation.checkedAuthorityReferences, `${field}.currentSelectionValidation.checkedAuthorityReferences`)
    }
  };
}

function parseDirectExecutorAuthority(value: unknown, field: string): ControlledHandoffDirectExecutorAuthorityV1 {
  const body = record(
    value,
    field,
    [
      'disclosureState',
      'directExecutorEstablished',
      'finalExecutionProviderId',
      'finalExecutionProviderWorkspaceId',
      'authorityReference',
      'authorityVersion',
      'evidenceReferences',
      'checkedAt',
      'hiddenIntermediaryAllowed',
      'onwardRecipientAuthorization'
    ],
    ['legallyRequiredDistinctSigner']
  );
  let signer: ControlledHandoffDirectExecutorAuthorityV1['legallyRequiredDistinctSigner'];
  if (body.legallyRequiredDistinctSigner !== undefined) {
    const parsed = record(body.legallyRequiredDistinctSigner, `${field}.legallyRequiredDistinctSigner`, [
      'signerReference',
      'legalBasisReference',
      'transparentlyDisclosed',
      'receivesHandoffDataByDefault'
    ]);
    signer = {
      signerReference: text(parsed.signerReference, `${field}.legallyRequiredDistinctSigner.signerReference`),
      legalBasisReference: text(parsed.legalBasisReference, `${field}.legallyRequiredDistinctSigner.legalBasisReference`),
      transparentlyDisclosed: literal(parsed.transparentlyDisclosed, true, `${field}.legallyRequiredDistinctSigner.transparentlyDisclosed`),
      receivesHandoffDataByDefault: literal(parsed.receivesHandoffDataByDefault, false, `${field}.legallyRequiredDistinctSigner.receivesHandoffDataByDefault`)
    };
  }
  return {
    disclosureState: literal(body.disclosureState, 'INDEPENDENT_EVIDENCE_REFERENCED', `${field}.disclosureState`),
    directExecutorEstablished: literal(body.directExecutorEstablished, true, `${field}.directExecutorEstablished`),
    finalExecutionProviderId: brandedId(body.finalExecutionProviderId, 'provider', `${field}.finalExecutionProviderId`) as ProviderId,
    finalExecutionProviderWorkspaceId: workspaceId(body.finalExecutionProviderWorkspaceId, `${field}.finalExecutionProviderWorkspaceId`),
    authorityReference: text(body.authorityReference, `${field}.authorityReference`),
    authorityVersion: version(body.authorityVersion, `${field}.authorityVersion`),
    evidenceReferences: stringArray(body.evidenceReferences, `${field}.evidenceReferences`),
    checkedAt: instant(body.checkedAt, `${field}.checkedAt`),
    hiddenIntermediaryAllowed: literal(body.hiddenIntermediaryAllowed, false, `${field}.hiddenIntermediaryAllowed`),
    onwardRecipientAuthorization: literal(body.onwardRecipientAuthorization, 'NONE', `${field}.onwardRecipientAuthorization`),
    ...(signer ? { legallyRequiredDistinctSigner: signer } : {})
  };
}

function parseHandoffSourceLineage(value: unknown, field: string): ControlledHandoffSourceLineageV1 {
  const body = record(value, field, [
    'selectionLineage',
    'currentSourceVersions',
    'directExecutorAuthority',
    'currentAuthorityRevalidationRequiredBeforeAuthorize',
    'currentAuthorityRevalidationRequiredBeforeConsumption',
    'evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval'
  ]);
  if (!Array.isArray(body.currentSourceVersions)) return invalid(`${field}.currentSourceVersions`, 'must be an array.');
  return {
    selectionLineage: parseHandoffSelectionLineage(body.selectionLineage, `${field}.selectionLineage`),
    currentSourceVersions: body.currentSourceVersions.map((item, index) =>
      parseCurrentSourceVersion(item, `${field}.currentSourceVersions[${index}]`)
    ),
    directExecutorAuthority: parseDirectExecutorAuthority(body.directExecutorAuthority, `${field}.directExecutorAuthority`),
    currentAuthorityRevalidationRequiredBeforeAuthorize: literal(
      body.currentAuthorityRevalidationRequiredBeforeAuthorize,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeAuthorize`
    ),
    currentAuthorityRevalidationRequiredBeforeConsumption: literal(
      body.currentAuthorityRevalidationRequiredBeforeConsumption,
      true,
      `${field}.currentAuthorityRevalidationRequiredBeforeConsumption`
    ),
    evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval: literal(
      body.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval,
      true,
      `${field}.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval`
    )
  };
}

function parsePrivacyPreview(
  value: unknown,
  field: string,
  trustedWorkspaceId: string
): ControlledHandoffPrivacyPreviewAcknowledgementV1 {
  const body = record(value, field, [
    'affirmativeHumanAction',
    'acknowledgementCode',
    'acknowledgementTextVersion',
    'recipientProviderId',
    'recipientProviderWorkspaceId',
    'selection',
    'purposeFingerprintSha256',
    'projectionFingerprintSha256',
    'sourceSetFingerprintSha256',
    'previewFingerprintSha256',
    'reviewedAt'
  ], ['originatingWorkspaceId']);
  if (body.originatingWorkspaceId !== undefined)
    unexpected(field, 'originatingWorkspaceId');
  return {
    affirmativeHumanAction: literal(body.affirmativeHumanAction, true, `${field}.affirmativeHumanAction`),
    acknowledgementCode: literal(body.acknowledgementCode, 'CONTROLLED_PRIVACY_HANDOFF_V1', `${field}.acknowledgementCode`),
    acknowledgementTextVersion: text(body.acknowledgementTextVersion, `${field}.acknowledgementTextVersion`, 100),
    originatingWorkspaceId: workspaceId(trustedWorkspaceId, 'trustedWorkspaceId'),
    recipientProviderId: brandedId(body.recipientProviderId, 'provider', `${field}.recipientProviderId`) as ProviderId,
    recipientProviderWorkspaceId: workspaceId(body.recipientProviderWorkspaceId, `${field}.recipientProviderWorkspaceId`),
    selection: parseSelectionReference(body.selection, `${field}.selection`),
    purposeFingerprintSha256: sha256(body.purposeFingerprintSha256, `${field}.purposeFingerprintSha256`),
    projectionFingerprintSha256: sha256(body.projectionFingerprintSha256, `${field}.projectionFingerprintSha256`),
    sourceSetFingerprintSha256: sha256(body.sourceSetFingerprintSha256, `${field}.sourceSetFingerprintSha256`),
    previewFingerprintSha256: sha256(body.previewFingerprintSha256, `${field}.previewFingerprintSha256`),
    reviewedAt: instant(body.reviewedAt, `${field}.reviewedAt`)
  };
}

export function parseControlledHandoffAuthorizeTransport(input: {
  value: unknown;
  trustedWorkspaceId: string;
  trustedAuthority: Readonly<ControlledHandoffTrustedHumanAuthorityV1>;
  idempotencyKey: string;
}): AuthorizeOrReplaceControlledHandoffCommandV1 {
  const body = record(input.value, 'body', [
    'schemaVersion',
    'recipient',
    'purpose',
    'authorizedProjection',
    'sourceLineage',
    'privacyPreviewAcknowledgement',
    'validFrom',
    'validUntil',
    'expectedCurrent',
    'commandFingerprintSha256',
    'correlationId'
  ], ['idempotencyKey']);
  const recipient = record(body.recipient, 'body.recipient', ['providerId', 'providerWorkspaceId', 'role']);
  const expected = record(body.expectedCurrent, 'body.expectedCurrent', ['kind'], ['controlledHandoffId', 'version']);
  const kind = enumValue(expected.kind, ['ABSENT', 'EXACT'] as const, 'body.expectedCurrent.kind');
  const expectedCurrent =
    kind === 'ABSENT'
      ? (() => {
          if (expected.controlledHandoffId !== undefined) unexpected('body.expectedCurrent', 'controlledHandoffId');
          if (expected.version !== undefined) unexpected('body.expectedCurrent', 'version');
          return { kind } as const;
        })()
      : {
          kind,
          controlledHandoffId: brandedId(expected.controlledHandoffId, 'controlled-handoff', 'body.expectedCurrent.controlledHandoffId') as ControlledHandoffId,
          version: positiveInteger(expected.version, 'body.expectedCurrent.version')
        } as const;
  return {
    schemaVersion: literal(body.schemaVersion, 1, 'body.schemaVersion'),
    originatingWorkspaceId: workspaceId(input.trustedWorkspaceId, 'trustedWorkspaceId'),
    recipient: {
      providerId: brandedId(recipient.providerId, 'provider', 'body.recipient.providerId') as ProviderId,
      providerWorkspaceId: workspaceId(recipient.providerWorkspaceId, 'body.recipient.providerWorkspaceId'),
      role: literal(recipient.role, 'FINAL_EXECUTION_PROVIDER', 'body.recipient.role')
    },
    purpose: parseHandoffPurpose(body.purpose, 'body.purpose'),
    authorizedProjection: parseAuthorizedProjection(body.authorizedProjection, 'body.authorizedProjection'),
    sourceLineage: parseHandoffSourceLineage(body.sourceLineage, 'body.sourceLineage'),
    trustedHumanAuthority: input.trustedAuthority,
    privacyPreviewAcknowledgement: parsePrivacyPreview(
      body.privacyPreviewAcknowledgement,
      'body.privacyPreviewAcknowledgement',
      input.trustedWorkspaceId
    ),
    validFrom: instant(body.validFrom, 'body.validFrom'),
    validUntil: instant(body.validUntil, 'body.validUntil'),
    expectedCurrent,
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 500),
    commandFingerprintSha256: sha256(body.commandFingerprintSha256, 'body.commandFingerprintSha256'),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

export function parseControlledHandoffRevokeTransport(input: {
  value: unknown;
  routeControlledHandoffId: string;
  trustedWorkspaceId: string;
  trustedAuthority: Readonly<ControlledHandoffTrustedHumanAuthorityV1>;
  idempotencyKey: string;
}): RevokeControlledHandoffCommandV1 {
  const body = record(
    input.value,
    'body',
    ['schemaVersion', 'target', 'reasonCode', 'commandFingerprintSha256', 'correlationId'],
    ['rationale', 'idempotencyKey']
  );
  const target = record(body.target, 'body.target', ['version'], ['controlledHandoffId']);
  const routeId = brandedId(input.routeControlledHandoffId, 'controlled-handoff', 'route.controlledHandoffId') as ControlledHandoffId;
  if (target.controlledHandoffId !== undefined) {
    const payloadId = brandedId(target.controlledHandoffId, 'controlled-handoff', 'body.target.controlledHandoffId');
    if (payloadId !== routeId)
      throw new HttpError(400, 'GOVERNED_NETWORK_TARGET_MISMATCH', 'Handoff route target does not match the command target.');
  }
  const rationale = optionalText(body.rationale, 'body.rationale', 500);
  return {
    schemaVersion: literal(body.schemaVersion, 1, 'body.schemaVersion'),
    originatingWorkspaceId: workspaceId(input.trustedWorkspaceId, 'trustedWorkspaceId'),
    target: {
      controlledHandoffId: routeId,
      version: positiveInteger(target.version, 'body.target.version')
    },
    trustedHumanAuthority: input.trustedAuthority,
    reasonCode: enumValue(
      body.reasonCode,
      ['HUMAN_WITHDRAWAL', 'PURPOSE_CANCELLED', 'SCOPE_CANCELLED', 'OTHER_BOUNDED_REASON'] as const,
      'body.reasonCode'
    ),
    ...(rationale ? { rationale } : {}),
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 500),
    commandFingerprintSha256: sha256(body.commandFingerprintSha256, 'body.commandFingerprintSha256'),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId')
  };
}

export function parseControlledHandoffValidationTransport(
  value: unknown,
  routeControlledHandoffId: string,
  trustedWorkspaceId: string
): {
  envelope: { controlledHandoffId: ControlledHandoffId; version: number };
  purpose: ControlledHandoffValidationPurpose;
  attempt: ControlledHandoffConsumptionAttemptV1;
} {
  const body = record(value, 'body', ['envelope', 'purpose', 'attempt']);
  const envelope = record(body.envelope, 'body.envelope', ['version']);
  const attempt = record(body.attempt, 'body.attempt', [
    'recipientProviderId',
    'recipientProviderWorkspaceId',
    'purposeFingerprintSha256',
    'projectionFingerprintSha256',
    'sourceSetFingerprintSha256',
    'artifactRetrievalRequested',
    'attemptedAt',
    'correlationId'
  ]);
  if (attempt.artifactRetrievalRequested !== false)
    throw new HttpError(
      403,
      'ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
      'Generic governed-network transport cannot request evidence artifacts.'
    );
  return {
    envelope: {
      controlledHandoffId: brandedId(routeControlledHandoffId, 'controlled-handoff', 'route.controlledHandoffId') as ControlledHandoffId,
      version: positiveInteger(envelope.version, 'body.envelope.version')
    },
    purpose: enumValue(body.purpose, ['HANDOFF_CONSUMPTION', 'PRIVACY_PREVIEW_REFRESH'] as const, 'body.purpose'),
    attempt: {
      originatingWorkspaceId: workspaceId(trustedWorkspaceId, 'trustedWorkspaceId'),
      recipientProviderId: brandedId(attempt.recipientProviderId, 'provider', 'body.attempt.recipientProviderId') as ProviderId,
      recipientProviderWorkspaceId: workspaceId(attempt.recipientProviderWorkspaceId, 'body.attempt.recipientProviderWorkspaceId'),
      purposeFingerprintSha256: sha256(attempt.purposeFingerprintSha256, 'body.attempt.purposeFingerprintSha256'),
      projectionFingerprintSha256: sha256(attempt.projectionFingerprintSha256, 'body.attempt.projectionFingerprintSha256'),
      sourceSetFingerprintSha256: sha256(attempt.sourceSetFingerprintSha256, 'body.attempt.sourceSetFingerprintSha256'),
      artifactRetrievalRequested: false,
      attemptedAt: instant(attempt.attemptedAt, 'body.attempt.attemptedAt'),
      correlationId: markOrbitId(attempt.correlationId, 'body.attempt.correlationId')
    }
  };
}

function parseHandoffBinding(value: unknown, field: string): GovernedAllocationHandoffBinding {
  const body = record(
    value,
    field,
    ['mode'],
    ['handoff', 'envelopeFingerprintSha256', 'purposeFingerprintSha256', 'projectionFingerprintSha256', 'sourceSetFingerprintSha256']
  );
  const mode = enumValue(body.mode, ['NONE_EXPLICIT', 'EXACT'] as const, `${field}.mode`);
  if (mode === 'NONE_EXPLICIT') {
    for (const key of ['handoff', 'envelopeFingerprintSha256', 'purposeFingerprintSha256', 'projectionFingerprintSha256', 'sourceSetFingerprintSha256'])
      if (body[key] !== undefined) unexpected(field, key);
    return { mode };
  }
  const handoff = record(body.handoff, `${field}.handoff`, ['controlledHandoffId', 'version']);
  return {
    mode,
    handoff: {
      controlledHandoffId: brandedId(handoff.controlledHandoffId, 'controlled-handoff', `${field}.handoff.controlledHandoffId`) as ControlledHandoffId,
      version: positiveInteger(handoff.version, `${field}.handoff.version`)
    },
    envelopeFingerprintSha256: sha256(body.envelopeFingerprintSha256, `${field}.envelopeFingerprintSha256`),
    purposeFingerprintSha256: sha256(body.purposeFingerprintSha256, `${field}.purposeFingerprintSha256`),
    projectionFingerprintSha256: sha256(body.projectionFingerprintSha256, `${field}.projectionFingerprintSha256`),
    sourceSetFingerprintSha256: sha256(body.sourceSetFingerprintSha256, `${field}.sourceSetFingerprintSha256`)
  };
}

export function parseGovernedAllocationTransport(input: {
  value: unknown;
  trustedWorkspaceId: string;
  trustedActorId: string;
  idempotencyKey: string;
}): GovernedAllocationCommand {
  const body = record(input.value, 'body', [
    'servicePackageId',
    'expectedServicePackageVersion',
    'expectedServicePackageFingerprintSha256',
    'eligibilityEvaluationId',
    'expectedEligibilityEvaluationVersion',
    'expectedEligibilityFingerprintSha256',
    'providerId',
    'providerSupplyCapabilityId',
    'expectedProviderSupplyCapabilityVersion',
    'rationale',
    'selection',
    'selectionScope',
    'handoffBinding',
    'correlationId'
  ], ['idempotencyKey']);
  return {
    workspaceId: workspaceId(input.trustedWorkspaceId, 'trustedWorkspaceId'),
    actorId: text(input.trustedActorId, 'trustedActorId', 250),
    servicePackageId: brandedId(body.servicePackageId, 'service-package', 'body.servicePackageId') as ServicePackageId,
    expectedServicePackageVersion: positiveInteger(body.expectedServicePackageVersion, 'body.expectedServicePackageVersion'),
    expectedServicePackageFingerprintSha256: sha256(body.expectedServicePackageFingerprintSha256, 'body.expectedServicePackageFingerprintSha256'),
    eligibilityEvaluationId: brandedId(body.eligibilityEvaluationId, 'eligibility-evaluation', 'body.eligibilityEvaluationId') as EligibilityEvaluationId,
    expectedEligibilityEvaluationVersion: positiveInteger(body.expectedEligibilityEvaluationVersion, 'body.expectedEligibilityEvaluationVersion'),
    expectedEligibilityFingerprintSha256: sha256(body.expectedEligibilityFingerprintSha256, 'body.expectedEligibilityFingerprintSha256'),
    providerId: brandedId(body.providerId, 'provider', 'body.providerId') as ProviderId,
    providerSupplyCapabilityId: brandedId(body.providerSupplyCapabilityId, 'provider-supply-capability', 'body.providerSupplyCapabilityId') as ProviderSupplyCapabilityId,
    expectedProviderSupplyCapabilityVersion: positiveInteger(body.expectedProviderSupplyCapabilityVersion, 'body.expectedProviderSupplyCapabilityVersion'),
    rationale: text(body.rationale, 'body.rationale', 1000),
    idempotencyKey: text(input.idempotencyKey, 'idempotencyKey', 500),
    correlationId: markOrbitId(body.correlationId, 'body.correlationId'),
    selection: parseSelectionReference(body.selection, 'body.selection'),
    selectionScope: parseSelectionScope(body.selectionScope, 'body.selectionScope'),
    handoffBinding: parseHandoffBinding(body.handoffBinding, 'body.handoffBinding')
  };
}
