import type { DiscoveryCurrentSourceVersionV1 } from '@markorbit/contracts/provider-discovery';
import type { ProviderSelectionSourceLineageV1 } from '@markorbit/contracts/provider-selection';
import type { NetworkParticipationRepository } from './network-participation.js';
import {
  PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION,
  providerDiscoveryFingerprint
} from './provider-discovery.js';
import type {
  ProviderRegistryRepository,
  ProviderRegistryRecord,
  ProviderSupplyCapabilityRecord
} from './provider-registry.js';
import { isSupplyOperationallyEligibleAt } from './provider-registry.js';
import type { ProviderResponsibilityService } from './provider-responsibility.js';
import type {
  ProviderSelectionCurrentAuthoritySnapshot,
  ProviderSelectionCurrentAuthoritySource
} from './provider-selection.js';

export interface CoreCurrentWorkspaceAuthorityCheck {
  authorityAvailable: boolean;
  current: boolean;
  authorityReferences: readonly string[];
}

export interface CoreCurrentWorkspaceAuthoritySource {
  validateCurrent(input: {
    workspaceId: string;
    userId: string;
    membershipId: string;
  }): Promise<Readonly<CoreCurrentWorkspaceAuthorityCheck>>;
}

export type SelectionNetworkAuthoritySource = Pick<
  NetworkParticipationRepository,
  'findCurrentParticipation' | 'findLatestParticipation' | 'findCurrentVisibilityPolicy'
>;
export type SelectionProviderAuthoritySource = Pick<
  ProviderRegistryRepository,
  'findProviderById' | 'findSupplyCapability'
>;
export type SelectionResponsibilityAuthoritySource = Pick<
  ProviderResponsibilityService,
  'assessCurrent'
>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unavailableSnapshot = Object.freeze({
  authorityAvailable: false,
  requesterAuthorityCurrent: false,
  actorAuthorityCurrent: false,
  candidateCurrent: false,
  participationActive: false,
  visibilityAuthorized: false,
  trustedRelationshipRequired: false,
  trustedRelationshipCurrent: false,
  providerOperational: false,
  supplyCurrent: false,
  directExecutorEstablished: false,
  sourceVersionsMatch: false,
  checkedAuthorityReferences: []
}) satisfies Readonly<ProviderSelectionCurrentAuthoritySnapshot>;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function providerFingerprint(provider: Readonly<ProviderRegistryRecord>): string {
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

function sourceMatches(
  source: Readonly<DiscoveryCurrentSourceVersionV1> | undefined,
  expected: {
    sourceType: string;
    sourceId: string;
    version: number | string;
    fingerprintSha256: string;
    effectiveFrom?: string;
    effectiveUntil?: string;
  }
): boolean {
  if (
    !source ||
    source.owner !== 'MGSN' ||
    source.sourceType !== expected.sourceType ||
    source.sourceId !== expected.sourceId ||
    source.version !== expected.version ||
    source.fingerprintSha256 !== expected.fingerprintSha256
  )
    return false;
  if (source.effectiveFrom !== undefined && source.effectiveFrom !== expected.effectiveFrom)
    return false;
  if (source.effectiveUntil !== undefined && source.effectiveUntil !== expected.effectiveUntil)
    return false;
  return true;
}

function exactSource(
  sources: readonly Readonly<DiscoveryCurrentSourceVersionV1>[],
  type: string
): Readonly<DiscoveryCurrentSourceVersionV1> | undefined {
  const matches = sources.filter((source) => source.owner === 'MGSN' && source.sourceType === type);
  return matches.length === 1 ? matches[0] : undefined;
}

function hasCurrentVisibilityGrant(policy: {
  scope: 'PRIVATE' | 'TRUSTED' | 'BOUNDED_PUBLIC';
  grants: readonly Readonly<{
    scope: 'TRUSTED' | 'BOUNDED_PUBLIC';
    purpose: string;
    audience: Readonly<{ kind: string }>;
  }>[];
}): boolean {
  if (policy.scope === 'PRIVATE') return false;
  return policy.grants.some((grant) => {
    if (grant.purpose !== 'PROVIDER_DISCOVERY' || grant.scope !== policy.scope) return false;
    return policy.scope === 'TRUSTED'
      ? grant.audience.kind === 'TRUSTED_RELATIONSHIP'
      : grant.audience.kind === 'BOUNDED_NETWORK';
  });
}

function exactCandidateIdentity(input: {
  lineage: Readonly<ProviderSelectionSourceLineageV1>;
  provider: Readonly<ProviderRegistryRecord>;
  providerFingerprintSha256: string;
  supply: Readonly<ProviderSupplyCapabilityRecord>;
  participationId: string;
  participationVersion: number;
  visibilityPolicyVersion: number;
}): boolean {
  const { lineage } = input;
  if (
    lineage.discoveryRequest.purpose !== 'PROVIDER_DISCOVERY' ||
    lineage.discoveryCandidate.evaluationPolicyVersion !== PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION ||
    lineage.discoveryCandidate.generatedAt !== lineage.discoveryResult.evaluatedAt ||
    lineage.discoveryCandidate.generatedAt !== lineage.visibilityAuthorizationAtReview.evaluatedAt
  )
    return false;
  const identityFingerprint = providerDiscoveryFingerprint({
    requestFingerprintSha256: lineage.discoveryRequest.requestFingerprintSha256,
    providerId: input.provider.providerId,
    providerWorkspaceId: input.provider.providerWorkspaceId,
    providerVersion: input.provider.version,
    providerFingerprintSha256: input.providerFingerprintSha256,
    providerSupplyCapabilityId: input.supply.providerSupplyCapabilityId,
    supplyVersion: input.supply.version,
    supplyFingerprintSha256: input.supply.sourceFingerprintSha256,
    participationId: input.participationId,
    participationVersion: input.participationVersion,
    visibilityPolicyVersion: input.visibilityPolicyVersion,
    evaluationPolicyVersion: PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION,
    evaluatedAt: lineage.discoveryCandidate.generatedAt
  });
  return lineage.discoveryCandidate.providerDiscoveryCandidateId ===
    `provider-discovery-candidate_${identityFingerprint}`;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

/**
 * Current authority for durable Human Provider Selection.
 *
 * Only exact Core identity authority and current MGSN owner truth may establish a positive result.
 * Opaque historical principal references, missing Discovery request projection/audience data and
 * unsupported relationship/owner authority never become bearer capabilities or optimistic grants.
 */
export class MgsnProviderSelectionCurrentAuthoritySource
  implements ProviderSelectionCurrentAuthoritySource
{
  constructor(
    private readonly coreAuthority: CoreCurrentWorkspaceAuthoritySource,
    private readonly network: SelectionNetworkAuthoritySource,
    private readonly providers: SelectionProviderAuthoritySource,
    private readonly responsibility: SelectionResponsibilityAuthoritySource
  ) {}

  async evaluateCurrentAuthority(
    input: Parameters<ProviderSelectionCurrentAuthoritySource['evaluateCurrentAuthority']>[0]
  ): Promise<Readonly<ProviderSelectionCurrentAuthoritySnapshot>> {
    try {
      return await this.evaluate(input);
    } catch {
      return unavailableSnapshot;
    }
  }

  private async evaluate(
    input: Parameters<ProviderSelectionCurrentAuthoritySource['evaluateCurrentAuthority']>[0]
  ): Promise<Readonly<ProviderSelectionCurrentAuthoritySnapshot>> {
    const membershipId = input.trustedHumanAuthority.workspaceMembershipReference.trim();
    const workspaceId = input.requesterWorkspaceId.toLowerCase();
    const userId = input.selectingActorId.toLowerCase();
    if (
      !uuidPattern.test(workspaceId) ||
      !uuidPattern.test(userId) ||
      !uuidPattern.test(membershipId) ||
      input.trustedHumanAuthority.requesterWorkspaceId.toLowerCase() !== workspaceId ||
      input.sourceLineage.discoveryRequest.requesterWorkspaceId.toLowerCase() !== workspaceId
    ) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true
      };
    }

    const core = await this.coreAuthority.validateCurrent({ workspaceId, userId, membershipId });
    if (!core.authorityAvailable) return unavailableSnapshot;
    if (!core.current) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        checkedAuthorityReferences: unique(core.authorityReferences)
      };
    }

    const lineage = input.sourceLineage;
    const provider = await this.providers.findProviderById(lineage.provider.providerId);
    const providerOperational = Boolean(
      provider &&
      provider.providerWorkspaceId.toLowerCase() === lineage.provider.providerWorkspaceId.toLowerCase() &&
      provider.operationalStatus === 'ACTIVE'
    );
    const providerReferences = provider
      ? [`mgsn-provider:${provider.providerId}:v${provider.version}`]
      : [];
    if (!providerOperational || !provider) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        requesterAuthorityCurrent: true,
        actorAuthorityCurrent: true,
        checkedAuthorityReferences: unique([...core.authorityReferences, ...providerReferences])
      };
    }

    const supply = await this.providers.findSupplyCapability(lineage.providerSupplyCapability.id);
    const supplyCurrent = Boolean(
      supply &&
      supply.providerSupplyCapabilityId === lineage.providerSupplyCapability.id &&
      supply.provider.providerId === provider.providerId &&
      supply.provider.providerWorkspaceId.toLowerCase() === provider.providerWorkspaceId.toLowerCase() &&
      supply.version === lineage.providerSupplyCapability.version &&
      supply.sourceFingerprintSha256 === lineage.providerSupplyCapability.fingerprintSha256 &&
      supply.verificationState === 'VERIFIED_FOR_SUPPLY' &&
      isSupplyOperationallyEligibleAt(provider, supply, input.checkedAt)
    );
    const supplyReferences = supply
      ? [
          `mgsn-provider-supply:${supply.providerSupplyCapabilityId}:v${supply.version}:${supply.sourceFingerprintSha256}`
        ]
      : [];
    if (!supplyCurrent || !supply) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        requesterAuthorityCurrent: true,
        actorAuthorityCurrent: true,
        providerOperational: true,
        checkedAuthorityReferences: unique([
          ...core.authorityReferences,
          ...providerReferences,
          ...supplyReferences
        ])
      };
    }

    const historicalParticipation = await this.network.findLatestParticipation(
      lineage.visibilityAuthorizationAtReview.networkParticipationId
    );
    const currentParticipation = historicalParticipation
      ? await this.network.findCurrentParticipation(provider.providerWorkspaceId, provider.providerId)
      : undefined;
    const participationActive = Boolean(
      historicalParticipation &&
      historicalParticipation.providerId === provider.providerId &&
      historicalParticipation.workspaceId.toLowerCase() === provider.providerWorkspaceId.toLowerCase() &&
      currentParticipation?.networkParticipationId === historicalParticipation.networkParticipationId &&
      currentParticipation.version === lineage.visibilityAuthorizationAtReview.participationVersion &&
      currentParticipation.state === 'ACTIVE'
    );
    const participationReferences = currentParticipation
      ? [
          `mgsn-network-participation:${currentParticipation.networkParticipationId}:v${currentParticipation.version}`
        ]
      : [];
    if (!participationActive || !currentParticipation) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        requesterAuthorityCurrent: true,
        actorAuthorityCurrent: true,
        providerOperational: true,
        supplyCurrent: true,
        checkedAuthorityReferences: unique([
          ...core.authorityReferences,
          ...providerReferences,
          ...supplyReferences,
          ...participationReferences
        ])
      };
    }

    const policy = await this.network.findCurrentVisibilityPolicy(currentParticipation.networkParticipationId);
    const visibilityAuthorized = Boolean(
      policy &&
      policy.participationVersion === currentParticipation.version &&
      policy.version === lineage.visibilityAuthorizationAtReview.visibilityPolicyVersion &&
      hasCurrentVisibilityGrant(policy)
    );
    const trustedRelationshipRequired = policy?.scope === 'TRUSTED';
    const trustedRelationshipCurrent = trustedRelationshipRequired ? false : true;
    const policyReferences = policy
      ? [
          `mgsn-network-visibility:${policy.networkParticipationId}:v${policy.version}`,
          policy.authorizationReference
        ]
      : [];
    if (!visibilityAuthorized || !policy) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        requesterAuthorityCurrent: true,
        actorAuthorityCurrent: true,
        providerOperational: true,
        supplyCurrent: true,
        participationActive: true,
        trustedRelationshipRequired,
        trustedRelationshipCurrent,
        checkedAuthorityReferences: unique([
          ...core.authorityReferences,
          ...providerReferences,
          ...supplyReferences,
          ...participationReferences,
          ...policyReferences
        ])
      };
    }

    const currentProviderFingerprint = providerFingerprint(provider);
    const currentParticipationFingerprint = participationFingerprint(currentParticipation);
    const currentVisibilityFingerprint = visibilityFingerprint(policy);
    const sources = lineage.historicalSourceVersions;
    let assessment: Awaited<ReturnType<SelectionResponsibilityAuthoritySource['assessCurrent']>>['assessment'] = null;
    if (lineage.directExecutorDisclosureAtReview.state === 'INDEPENDENT_EVIDENCE_REFERENCED') {
      assessment = (await this.responsibility.assessCurrent(
        provider.providerId,
        provider.providerWorkspaceId,
        input.checkedAt
      )).assessment;
    }
    const responsibilityHistorical = exactSource(sources, 'PROVIDER_RESPONSIBILITY_PROFILE');
    const directExecutorEstablished = Boolean(
      lineage.directExecutorDisclosureAtReview.state === 'INDEPENDENT_EVIDENCE_REFERENCED' &&
      assessment?.directExecutorEstablished === true &&
      (assessment.state === 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' ||
        assessment.state === 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED') &&
      assessment.profileAuthorityState === 'CURRENT' &&
      assessment.finalExecutionProviderId === provider.providerId &&
      assessment.finalExecutionProviderWorkspaceId.toLowerCase() === provider.providerWorkspaceId.toLowerCase() &&
      responsibilityHistorical &&
      sourceMatches(responsibilityHistorical, {
        sourceType: 'PROVIDER_RESPONSIBILITY_PROFILE',
        sourceId: assessment.profile.providerResponsibilityProfileId,
        version: assessment.profile.version,
        fingerprintSha256: assessment.profile.profileFingerprintSha256
      }) &&
      sameStringSet(
        lineage.directExecutorDisclosureAtReview.evidenceReferences,
        assessment.evidenceReferences
      )
    );

    const providerSource = exactSource(sources, 'PROVIDER');
    const supplySource = exactSource(sources, 'PROVIDER_SUPPLY_CAPABILITY');
    const participationSource = exactSource(sources, 'NETWORK_PARTICIPATION');
    const visibilitySource = exactSource(sources, 'NETWORK_VISIBILITY_POLICY');
    const expectedSourceCount = directExecutorEstablished ? 5 : 4;
    const sourceVersionsMatch = Boolean(
      sources.length === expectedSourceCount &&
      sourceMatches(providerSource, {
        sourceType: 'PROVIDER',
        sourceId: provider.providerId,
        version: provider.version,
        fingerprintSha256: currentProviderFingerprint
      }) &&
      sourceMatches(supplySource, {
        sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
        sourceId: supply.providerSupplyCapabilityId,
        version: supply.version,
        fingerprintSha256: supply.sourceFingerprintSha256,
        effectiveFrom: supply.effectivePeriod.effectiveFrom,
        ...(supply.effectivePeriod.effectiveUntil
          ? { effectiveUntil: supply.effectivePeriod.effectiveUntil }
          : {})
      }) &&
      sourceMatches(participationSource, {
        sourceType: 'NETWORK_PARTICIPATION',
        sourceId: currentParticipation.networkParticipationId,
        version: currentParticipation.version,
        fingerprintSha256: currentParticipationFingerprint
      }) &&
      sourceMatches(visibilitySource, {
        sourceType: 'NETWORK_VISIBILITY_POLICY',
        sourceId: policy.networkParticipationId,
        version: policy.version,
        fingerprintSha256: currentVisibilityFingerprint
      }) &&
      (directExecutorEstablished || responsibilityHistorical === undefined)
    );

    const candidateCurrent = Boolean(
      sourceVersionsMatch &&
      exactCandidateIdentity({
        lineage,
        provider,
        providerFingerprintSha256: currentProviderFingerprint,
        supply,
        participationId: currentParticipation.networkParticipationId,
        participationVersion: currentParticipation.version,
        visibilityPolicyVersion: policy.version
      })
    );
    const responsibilityReferences = assessment
      ? [
          `mgsn-provider-responsibility:${assessment.profile.providerResponsibilityProfileId}:v${assessment.profile.version}:${assessment.profile.profileFingerprintSha256}`
        ]
      : [];

    return {
      authorityAvailable: true,
      requesterAuthorityCurrent: true,
      actorAuthorityCurrent: true,
      candidateCurrent,
      participationActive: true,
      visibilityAuthorized: true,
      trustedRelationshipRequired,
      trustedRelationshipCurrent,
      providerOperational: true,
      supplyCurrent: true,
      directExecutorEstablished,
      sourceVersionsMatch,
      checkedAuthorityReferences: unique([
        ...core.authorityReferences,
        ...providerReferences,
        ...supplyReferences,
        ...participationReferences,
        ...policyReferences,
        ...responsibilityReferences
      ])
    };
  }
}
