import { createHash } from 'node:crypto';
import {
  noProviderDiscoveryAuthorityConsequences,
  type AuthorizedProviderProjectionFieldV1,
  type CurrentDiscoveryEvidenceReferenceV1,
  type DiscoveryLimitationV1,
  type DiscoverySourceAuthorityState,
  type DiscoveryCurrentSourceVersionV1,
  type ProviderDiscoveryCandidateV1,
  type ProviderDiscoveryRequestReferenceV1,
  type ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import {
  networkVisibilityFieldsByDataClass,
  type NetworkParticipationSnapshotV1,
  type NetworkVisibilityAuthorityState,
  type NetworkVisibilityDataClass,
  type NetworkVisibilityField
} from '@markorbit/contracts/network-participation';
import type {
  ProviderId,
  ProviderOperationalStatus,
  ProviderSupplyCapabilityId,
  ProviderSupplyCapabilityStatus
} from '@markorbit/contracts/provider-execution';
import {
  evaluateNetworkVisibility,
  type CurrentTrustedRelationshipAuthority,
  type RequestedNetworkVisibilityProjection
} from './network-participation.js';
import type { ProviderSupplyVerificationState } from './provider-registry.js';

export const PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION = 'mgsn-provider-discovery-v1';
export const PROVIDER_DISCOVERY_DEFAULT_SOURCE_LIMIT = 100;

export interface ProviderDiscoveryPrincipal {
  workspaceId: string;
  actorId: string;
}

/** Bounded normalized owner truth. Raw capacity, availability and source JSON are absent. */
export interface ProviderDiscoverySource {
  provider: Readonly<{
    providerId: ProviderId;
    providerWorkspaceId: string;
    displayName: string;
    operationalStatus: ProviderOperationalStatus;
    version: number;
    fingerprintSha256: string;
    updatedAt: string;
  }>;
  supply: Readonly<{
    providerSupplyCapabilityId: ProviderSupplyCapabilityId;
    providerId: ProviderId;
    providerWorkspaceId: string;
    version: number;
    status: ProviderSupplyCapabilityStatus;
    jurisdictions: readonly string[];
    serviceTypes: readonly string[];
    effectiveFrom: string;
    effectiveUntil?: string;
    verificationState: ProviderSupplyVerificationState;
    evidenceReferences: readonly string[];
    fingerprintSha256: string;
    hasOperationalAvailability: boolean;
  }>;
  participation: Readonly<NetworkParticipationSnapshotV1>;
  visibilityAuthorityState: NetworkVisibilityAuthorityState;
  participationFingerprintSha256?: string;
  visibilityPolicyFingerprintSha256?: string;
}

export interface ProviderDiscoverySourceBatch {
  sources: readonly Readonly<ProviderDiscoverySource>[];
  /** False means the neutral runtime bound was exhausted and absence cannot be asserted. */
  complete: boolean;
}

export interface ProviderDiscoverySourceRepository {
  queryCurrentSources(input: {
    serviceType: string;
    jurisdiction: string;
    effectiveAt: string;
    limit: number;
  }): Promise<ProviderDiscoverySourceBatch>;
}

export interface ProviderDiscoveryTrustedRelationshipAuthoritySource {
  getCurrentRelationshipAuthority(input: {
    requesterWorkspaceId: string;
    trustedActorId: string;
    providerId: ProviderId;
    providerWorkspaceId: string;
    relationshipAuthorityReference: string;
    checkedAt: string;
  }): Promise<CurrentTrustedRelationshipAuthority | undefined>;
}

export type ProviderDiscoveryErrorCode = 'INVALID_INPUT' | 'REQUESTER_WORKSPACE_MISMATCH';

export class ProviderDiscoveryError extends Error {
  constructor(
    public readonly code: ProviderDiscoveryErrorCode,
    message: string,
    public readonly status: 404 | 422
  ) {
    super(message);
    this.name = 'ProviderDiscoveryError';
  }
}

const sha256Pattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dataClasses = new Set<string>(Object.keys(networkVisibilityFieldsByDataClass));
const allFields = new Set<string>(Object.values(networkVisibilityFieldsByDataClass).flat());

export function providerDiscoveryStableSerialize(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => providerDiscoveryStableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${providerDiscoveryStableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function providerDiscoveryFingerprint(value: unknown): string {
  return createHash('sha256').update(providerDiscoveryStableSerialize(value)).digest('hex');
}

function cleanText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      `${field} must be a non-empty value no longer than ${maximum} characters.`,
      422
    );
  return value.trim();
}

function cleanWorkspaceId(value: unknown, field: string): string {
  const workspaceId = cleanText(value, field, 100).toLowerCase();
  if (!uuidPattern.test(workspaceId))
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      `${field} must be a Core Workspace UUID.`,
      422
    );
  return workspaceId;
}

function exactInstant(value: unknown, field: string): string {
  const text = cleanText(value, field, 100);
  if (!Number.isFinite(Date.parse(text)))
    throw new ProviderDiscoveryError('INVALID_INPUT', `${field} must be an ISO timestamp.`, 422);
  return new Date(text).toISOString();
}

function exactSha256(value: unknown, field: string): string {
  const text = cleanText(value, field, 64);
  if (!sha256Pattern.test(text))
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 value.`,
      422
    );
  return text;
}

function requestedProjection(
  request: Readonly<ProviderDiscoveryRequestReferenceV1>
): RequestedNetworkVisibilityProjection[] {
  if (
    !Array.isArray(request.requestedDataClasses) ||
    request.requestedDataClasses.length === 0 ||
    request.requestedDataClasses.some(
      (dataClass: unknown) => typeof dataClass !== 'string' || !dataClasses.has(dataClass)
    ) ||
    new Set(request.requestedDataClasses).size !== request.requestedDataClasses.length
  )
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      'requestedDataClasses must contain unique canonical V1 data classes.',
      422
    );
  if (
    !Array.isArray(request.requestedFields) ||
    request.requestedFields.length === 0 ||
    request.requestedFields.some(
      (field: unknown) => typeof field !== 'string' || !allFields.has(field)
    ) ||
    new Set(request.requestedFields).size !== request.requestedFields.length
  )
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      'requestedFields must contain unique canonical V1 fields.',
      422
    );

  const requestedDataClasses =
    request.requestedDataClasses as readonly NetworkVisibilityDataClass[];
  const requestedFields = request.requestedFields as readonly NetworkVisibilityField[];
  const projection = requestedDataClasses.map((dataClass) => ({
    dataClass,
    fields: requestedFields.filter((field) =>
      (networkVisibilityFieldsByDataClass[dataClass] as readonly string[]).includes(field)
    )
  }));
  if (projection.some((item) => item.fields.length === 0))
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      'Every requested data class requires at least one explicit field.',
      422
    );
  if (requestedFields.some((field) => !projection.some((item) => item.fields.includes(field))))
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      'Every requested field must belong to a requested data class.',
      422
    );
  if (
    !projection.some(
      (item) => item.dataClass === 'PROVIDER_REFERENCE' && item.fields.includes('providerId')
    )
  )
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      'Provider Discovery candidates require the explicit PROVIDER_REFERENCE providerId field.',
      422
    );
  return projection;
}

function validateRequest(
  principal: Readonly<ProviderDiscoveryPrincipal>,
  request: Readonly<ProviderDiscoveryRequestReferenceV1>
): {
  trustedWorkspaceId: string;
  trustedActorId: string;
  evaluatedAt: string;
  projection: RequestedNetworkVisibilityProjection[];
} {
  if (request.schemaVersion !== 1)
    throw new ProviderDiscoveryError('INVALID_INPUT', 'schemaVersion must be 1.', 422);
  const trustedWorkspaceId = cleanWorkspaceId(principal.workspaceId, 'principal.workspaceId');
  const requesterWorkspaceId = cleanWorkspaceId(
    request.requesterWorkspaceId,
    'request.requesterWorkspaceId'
  );
  const trustedActorId = cleanText(principal.actorId, 'principal.actorId', 200);
  if (trustedWorkspaceId !== requesterWorkspaceId)
    throw new ProviderDiscoveryError(
      'REQUESTER_WORKSPACE_MISMATCH',
      'Provider Discovery request was not found for the trusted Workspace.',
      404
    );
  cleanText(request.providerDiscoveryRequestId, 'providerDiscoveryRequestId', 200);
  cleanText(request.need.reference, 'need.reference');
  cleanText(request.need.jurisdiction, 'need.jurisdiction', 100);
  cleanText(request.need.serviceType, 'need.serviceType', 200);
  cleanText(request.contextReference, 'contextReference');
  cleanText(request.correlationId, 'correlationId', 200);
  exactSha256(request.need.fingerprintSha256, 'need.fingerprintSha256');
  exactSha256(request.requestFingerprintSha256, 'requestFingerprintSha256');
  if (
    (typeof request.need.version !== 'string' &&
      (!Number.isInteger(request.need.version) || request.need.version < 1)) ||
    (typeof request.need.version === 'string' && !request.need.version.trim())
  )
    throw new ProviderDiscoveryError('INVALID_INPUT', 'need.version is invalid.', 422);
  if (request.purpose !== 'PROVIDER_DISCOVERY')
    throw new ProviderDiscoveryError(
      'INVALID_INPUT',
      'Provider Discovery requires the explicit PROVIDER_DISCOVERY purpose.',
      422
    );
  if (
    request.audience.kind !== 'BOUNDED_NETWORK' &&
    request.audience.kind !== 'TRUSTED_RELATIONSHIP'
  )
    throw new ProviderDiscoveryError('INVALID_INPUT', 'audience is invalid.', 422);
  if (request.audience.kind === 'TRUSTED_RELATIONSHIP')
    cleanText(request.audience.relationshipAuthorityReference, 'relationshipAuthorityReference');
  return {
    trustedWorkspaceId,
    trustedActorId,
    evaluatedAt: exactInstant(request.requestedAt, 'requestedAt'),
    projection: requestedProjection(request)
  };
}

function isCurrentSource(source: Readonly<ProviderDiscoverySource>): boolean {
  return (
    Number.isInteger(source.provider.version) &&
    source.provider.version > 0 &&
    sha256Pattern.test(source.provider.fingerprintSha256) &&
    Number.isFinite(Date.parse(source.provider.updatedAt)) &&
    Number.isInteger(source.supply.version) &&
    source.supply.version > 0 &&
    sha256Pattern.test(source.supply.fingerprintSha256) &&
    source.supply.providerId === source.provider.providerId &&
    source.supply.providerWorkspaceId.toLowerCase() ===
      source.provider.providerWorkspaceId.toLowerCase() &&
    source.participation.providerId === source.provider.providerId &&
    source.participation.workspaceId.toLowerCase() ===
      source.provider.providerWorkspaceId.toLowerCase()
  );
}

function suitable(
  source: Readonly<ProviderDiscoverySource>,
  request: Readonly<ProviderDiscoveryRequestReferenceV1>,
  evaluatedAt: string
): boolean {
  const from = Date.parse(source.supply.effectiveFrom);
  const until = source.supply.effectiveUntil ? Date.parse(source.supply.effectiveUntil) : undefined;
  const instant = Date.parse(evaluatedAt);
  return (
    source.provider.operationalStatus === 'ACTIVE' &&
    source.supply.status === 'ACTIVE' &&
    source.supply.verificationState === 'VERIFIED_FOR_SUPPLY' &&
    source.supply.hasOperationalAvailability &&
    source.supply.serviceTypes.includes(request.need.serviceType) &&
    source.supply.jurisdictions.includes(request.need.jurisdiction) &&
    Number.isFinite(from) &&
    (until === undefined || Number.isFinite(until)) &&
    instant >= from &&
    (until === undefined || instant < until)
  );
}

function sourceVersions(
  source: Readonly<ProviderDiscoverySource>,
  evaluatedAt: string
): DiscoveryCurrentSourceVersionV1[] {
  const participation = source.participation;
  if (
    participation.networkParticipationId === null ||
    participation.participationVersion === null ||
    participation.visibilityPolicy.version === null ||
    !source.participationFingerprintSha256 ||
    !source.visibilityPolicyFingerprintSha256
  )
    return [];
  return [
    {
      owner: 'MGSN',
      sourceType: 'PROVIDER',
      sourceId: source.provider.providerId,
      version: source.provider.version,
      fingerprintSha256: source.provider.fingerprintSha256,
      checkedAt: evaluatedAt,
      authorityState: 'CURRENT'
    },
    {
      owner: 'MGSN',
      sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
      sourceId: source.supply.providerSupplyCapabilityId,
      version: source.supply.version,
      fingerprintSha256: source.supply.fingerprintSha256,
      effectiveFrom: source.supply.effectiveFrom,
      ...(source.supply.effectiveUntil ? { effectiveUntil: source.supply.effectiveUntil } : {}),
      checkedAt: evaluatedAt,
      authorityState: 'CURRENT'
    },
    {
      owner: 'MGSN',
      sourceType: 'NETWORK_PARTICIPATION',
      sourceId: participation.networkParticipationId,
      version: participation.participationVersion,
      fingerprintSha256: source.participationFingerprintSha256,
      checkedAt: evaluatedAt,
      authorityState: 'CURRENT'
    },
    {
      owner: 'MGSN',
      sourceType: 'NETWORK_VISIBILITY_POLICY',
      sourceId: participation.networkParticipationId,
      version: participation.visibilityPolicy.version,
      fingerprintSha256: source.visibilityPolicyFingerprintSha256,
      checkedAt: evaluatedAt,
      authorityState: 'CURRENT'
    }
  ];
}

function projectionFields(
  source: Readonly<ProviderDiscoverySource>,
  authorized: readonly Readonly<{
    dataClass: NetworkVisibilityDataClass;
    fields: readonly NetworkVisibilityField[];
  }>[]
): AuthorizedProviderProjectionFieldV1[] {
  const fields: AuthorizedProviderProjectionFieldV1[] = [];
  for (const grant of authorized)
    for (const field of grant.fields) {
      if (grant.dataClass === 'ORGANIZATION_IDENTITY' && field === 'displayName')
        fields.push({ dataClass: grant.dataClass, field, value: source.provider.displayName });
      else if (grant.dataClass === 'PROVIDER_REFERENCE' && field === 'providerId')
        fields.push({ dataClass: grant.dataClass, field, value: source.provider.providerId });
      else if (grant.dataClass === 'PROVIDER_REFERENCE' && field === 'displayName')
        fields.push({ dataClass: grant.dataClass, field, value: source.provider.displayName });
      else if (grant.dataClass === 'SUPPLY_PROFILE' && field === 'serviceTypes')
        fields.push({ dataClass: grant.dataClass, field, value: [...source.supply.serviceTypes] });
      else if (grant.dataClass === 'SERVICE_JURISDICTIONS' && field === 'jurisdictions')
        fields.push({ dataClass: grant.dataClass, field, value: [...source.supply.jurisdictions] });
      else if (grant.dataClass === 'PROVIDER_EVIDENCE_REFERENCE' && field === 'evidenceReferences')
        fields.push({
          dataClass: grant.dataClass,
          field,
          value: [...new Set(source.supply.evidenceReferences)].sort()
        });
    }
  return fields;
}

function evidenceIsAuthorized(fields: readonly AuthorizedProviderProjectionFieldV1[]): boolean {
  return fields.some(
    (field) =>
      field.dataClass === 'PROVIDER_EVIDENCE_REFERENCE' && field.field === 'evidenceReferences'
  );
}

function evidence(
  source: Readonly<ProviderDiscoverySource>,
  evaluatedAt: string,
  authorized: boolean
): {
  visibilityEvidence: CurrentDiscoveryEvidenceReferenceV1[];
  suitabilityEvidence: CurrentDiscoveryEvidenceReferenceV1[];
} {
  const participation = source.participation;
  if (
    !authorized ||
    participation.networkParticipationId === null ||
    participation.visibilityPolicy.version === null ||
    !source.visibilityPolicyFingerprintSha256
  )
    return { visibilityEvidence: [], suitabilityEvidence: [] };
  return {
    visibilityEvidence: [
      {
        evidenceReference: `mgsn-network-visibility:${participation.networkParticipationId}:v${participation.visibilityPolicy.version}`,
        kind: 'PARTICIPATION_VISIBILITY',
        source: {
          owner: 'MGSN',
          sourceType: 'NETWORK_VISIBILITY_POLICY',
          sourceId: participation.networkParticipationId,
          version: participation.visibilityPolicy.version,
          fingerprintSha256: source.visibilityPolicyFingerprintSha256,
          checkedAt: evaluatedAt,
          authorityState: 'CURRENT'
        },
        authorityClass: 'MGSN_OPERATIONAL',
        artifactAccessAuthorized: false
      }
    ],
    suitabilityEvidence: [
      {
        evidenceReference: `mgsn-provider-supply:${source.supply.providerSupplyCapabilityId}:v${source.supply.version}`,
        kind: 'SUPPLY_SUITABILITY',
        source: {
          owner: 'MGSN',
          sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
          sourceId: source.supply.providerSupplyCapabilityId,
          version: source.supply.version,
          fingerprintSha256: source.supply.fingerprintSha256,
          effectiveFrom: source.supply.effectiveFrom,
          ...(source.supply.effectiveUntil ? { effectiveUntil: source.supply.effectiveUntil } : {}),
          checkedAt: evaluatedAt,
          authorityState: 'CURRENT'
        },
        authorityClass: 'MGSN_OPERATIONAL',
        artifactAccessAuthorized: false
      }
    ]
  };
}

function limitations(hasEvidence: boolean): DiscoveryLimitationV1[] {
  return [
    {
      code: 'CURRENT_VISIBILITY_REVALIDATION_REQUIRED',
      explanation: 'Current visibility authority must be revalidated before serving this candidate.'
    },
    {
      code: 'DIRECT_EXECUTOR_NOT_ESTABLISHED',
      explanation: 'Current direct-executor responsibility proof is not established.'
    },
    ...(hasEvidence
      ? [
          {
            code: 'EVIDENCE_ARTIFACT_RETRIEVAL_NOT_AUTHORIZED' as const,
            explanation: 'Evidence references do not authorize access to underlying artifacts.'
          }
        ]
      : []),
    {
      code: 'NO_BOUNDED_AVAILABILITY_SIGNAL',
      explanation:
        'Raw capacity and availability are private and no availability signal is exposed.'
    }
  ];
}

function authorityUnavailableResult(
  request: Readonly<ProviderDiscoveryRequestReferenceV1>,
  evaluatedAt: string,
  authorityState: Exclude<DiscoverySourceAuthorityState, 'CURRENT'> = 'UNAVAILABLE'
): ProviderDiscoveryResultV1 {
  const base = {
    schemaVersion: 1 as const,
    request,
    evaluatedAt,
    authorityConsequences: noProviderDiscoveryAuthorityConsequences,
    status: 'AUTHORITY_UNAVAILABLE' as const,
    candidates: [] as const,
    authorityState,
    publicMessage: 'Provider discovery is unavailable until current authority can be verified.'
  };
  return {
    ...base,
    resultFingerprintSha256: providerDiscoveryFingerprint({
      requestFingerprintSha256: request.requestFingerprintSha256,
      evaluatedAt,
      status: base.status,
      authorityState
    })
  };
}

export class ProviderDiscoveryService {
  constructor(
    private readonly repository: ProviderDiscoverySourceRepository,
    private readonly relationshipAuthority?: ProviderDiscoveryTrustedRelationshipAuthoritySource,
    private readonly sourceLimit = PROVIDER_DISCOVERY_DEFAULT_SOURCE_LIMIT
  ) {}

  async evaluate(
    principal: Readonly<ProviderDiscoveryPrincipal>,
    request: Readonly<ProviderDiscoveryRequestReferenceV1>
  ): Promise<ProviderDiscoveryResultV1> {
    const validated = validateRequest(principal, request);
    if (!Number.isInteger(this.sourceLimit) || this.sourceLimit < 1)
      throw new ProviderDiscoveryError('INVALID_INPUT', 'sourceLimit must be positive.', 422);

    let batch: ProviderDiscoverySourceBatch;
    try {
      batch = await this.repository.queryCurrentSources({
        serviceType: request.need.serviceType,
        jurisdiction: request.need.jurisdiction,
        effectiveAt: validated.evaluatedAt,
        limit: this.sourceLimit
      });
    } catch {
      return authorityUnavailableResult(request, validated.evaluatedAt);
    }
    if (!batch.complete) return authorityUnavailableResult(request, validated.evaluatedAt);

    const ordered = [...batch.sources].sort(
      (left, right) =>
        left.provider.providerId.localeCompare(right.provider.providerId) ||
        left.supply.providerSupplyCapabilityId.localeCompare(
          right.supply.providerSupplyCapabilityId
        )
    );
    if (
      ordered.some(
        (source) => !isCurrentSource(source) || source.visibilityAuthorityState === 'UNAVAILABLE'
      )
    )
      return authorityUnavailableResult(request, validated.evaluatedAt);

    const candidates: ProviderDiscoveryCandidateV1[] = [];
    for (const source of ordered) {
      if (!suitable(source, request, validated.evaluatedAt)) continue;
      let currentRelationshipAuthority: CurrentTrustedRelationshipAuthority | undefined;
      if (request.audience.kind === 'TRUSTED_RELATIONSHIP' && this.relationshipAuthority)
        try {
          currentRelationshipAuthority =
            await this.relationshipAuthority.getCurrentRelationshipAuthority({
              requesterWorkspaceId: validated.trustedWorkspaceId,
              trustedActorId: validated.trustedActorId,
              providerId: source.provider.providerId,
              providerWorkspaceId: source.provider.providerWorkspaceId,
              relationshipAuthorityReference: request.audience.relationshipAuthorityReference,
              checkedAt: validated.evaluatedAt
            });
        } catch {
          return authorityUnavailableResult(request, validated.evaluatedAt);
        }

      const exposure = evaluateNetworkVisibility({
        participation: source.participation,
        authorityState: source.visibilityAuthorityState,
        purpose: request.purpose,
        audience: request.audience,
        requestedProjection: validated.projection,
        ...(currentRelationshipAuthority ? { currentRelationshipAuthority } : {}),
        checkedAt: validated.evaluatedAt
      });
      if (exposure.authorityCheck.decision !== 'ALLOW') continue;
      if (
        source.participation.networkParticipationId === null ||
        source.participation.participationVersion === null ||
        source.participation.visibilityPolicy.version === null
      )
        return authorityUnavailableResult(request, validated.evaluatedAt);

      const fields = projectionFields(source, exposure.authorizedProjection.fields);
      const hasEvidence = evidenceIsAuthorized(fields);
      const candidateEvidence = evidence(source, validated.evaluatedAt, hasEvidence);
      const versions = sourceVersions(source, validated.evaluatedAt);
      if (versions.length !== 4) return authorityUnavailableResult(request, validated.evaluatedAt);
      const identityFingerprint = providerDiscoveryFingerprint({
        requestFingerprintSha256: request.requestFingerprintSha256,
        providerId: source.provider.providerId,
        providerWorkspaceId: source.provider.providerWorkspaceId,
        providerVersion: source.provider.version,
        providerFingerprintSha256: source.provider.fingerprintSha256,
        providerSupplyCapabilityId: source.supply.providerSupplyCapabilityId,
        supplyVersion: source.supply.version,
        supplyFingerprintSha256: source.supply.fingerprintSha256,
        participationId: source.participation.networkParticipationId,
        participationVersion: source.participation.participationVersion,
        visibilityPolicyVersion: source.participation.visibilityPolicy.version,
        evaluationPolicyVersion: PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION,
        evaluatedAt: validated.evaluatedAt
      });
      const providerDiscoveryCandidateId: ProviderDiscoveryCandidateV1['providerDiscoveryCandidateId'] = `provider-discovery-candidate_${identityFingerprint}`;
      const withoutFingerprint = {
        schemaVersion: 1 as const,
        providerDiscoveryCandidateId,
        request,
        providerId: source.provider.providerId,
        providerWorkspaceId: source.provider.providerWorkspaceId,
        providerSupplyCapability: {
          id: source.supply.providerSupplyCapabilityId,
          version: source.supply.version,
          fingerprintSha256: source.supply.fingerprintSha256
        },
        authorizedProjection: { schemaVersion: 1 as const, fields },
        visibilityAuthorization: {
          networkParticipationId: source.participation.networkParticipationId,
          participationVersion: source.participation.participationVersion,
          visibilityPolicyVersion: source.participation.visibilityPolicy.version,
          evaluatedAt: validated.evaluatedAt,
          currentAuthorityRevalidationRequiredBeforeServe: true as const
        },
        ...candidateEvidence,
        directExecutorDisclosure: {
          state: 'UNKNOWN' as const,
          evidenceReferences: [] as const,
          requiresIndependentCurrentVerification: true as const
        },
        sourceVersions: versions,
        evaluationPolicyVersion: PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION,
        explanation: {
          summary:
            'Current visibility and supply evidence permit this Provider to be shown as a candidate for the reviewed Need.',
          matchedConstraints: [
            `jurisdiction:${request.need.jurisdiction}`,
            `serviceType:${request.need.serviceType}`
          ],
          evidenceReferences: [
            ...candidateEvidence.visibilityEvidence,
            ...candidateEvidence.suitabilityEvidence
          ].map((item) => item.evidenceReference),
          limitations: limitations(hasEvidence)
        },
        generatedAt: validated.evaluatedAt,
        authorityConsequences: noProviderDiscoveryAuthorityConsequences
      };
      candidates.push({
        ...withoutFingerprint,
        candidateFingerprintSha256: providerDiscoveryFingerprint(withoutFingerprint)
      });
    }

    if (candidates.length === 0) {
      const base = {
        schemaVersion: 1 as const,
        request,
        evaluatedAt: validated.evaluatedAt,
        authorityConsequences: noProviderDiscoveryAuthorityConsequences,
        status: 'NO_AUTHORIZED_CANDIDATES' as const,
        candidates: [] as const,
        publicMessage: 'No Provider candidates are currently available for this request.'
      };
      return {
        ...base,
        resultFingerprintSha256: providerDiscoveryFingerprint({
          requestFingerprintSha256: request.requestFingerprintSha256,
          evaluatedAt: validated.evaluatedAt,
          status: base.status
        })
      };
    }

    const candidateTuple = candidates as [
      ProviderDiscoveryCandidateV1,
      ...ProviderDiscoveryCandidateV1[]
    ];
    return {
      schemaVersion: 1,
      request,
      evaluatedAt: validated.evaluatedAt,
      resultFingerprintSha256: providerDiscoveryFingerprint({
        requestFingerprintSha256: request.requestFingerprintSha256,
        evaluatedAt: validated.evaluatedAt,
        status: 'CANDIDATES',
        candidates: candidateTuple.map((candidate) => ({
          providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
          candidateFingerprintSha256: candidate.candidateFingerprintSha256
        }))
      }),
      authorityConsequences: noProviderDiscoveryAuthorityConsequences,
      status: 'CANDIDATES',
      candidates: candidateTuple
    };
  }
}
