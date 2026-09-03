import type {
  TrustEvidenceItemV1,
  TrustEvidenceVisibilityProjectionV1
} from '@markorbit/contracts/outcome-trust-evidence';
import type { NetworkParticipationRepository } from './network-participation.js';
import type {
  TrustEvidenceCurrentAuthoritySnapshot,
  TrustEvidenceCurrentAuthoritySource
} from './outcome-trust-evidence.js';
import type { ProviderRegistryRepository } from './provider-registry.js';
import type { ProviderResponsibilityService } from './provider-responsibility.js';
import type { ProviderReturnRepository } from './provider-return.js';

export type TrustEvidenceNetworkAuthoritySource = Pick<
  NetworkParticipationRepository,
  'findCurrentParticipation' | 'findLatestParticipation' | 'findCurrentVisibilityPolicy'
>;
export type TrustEvidenceProviderSource = Pick<ProviderRegistryRepository, 'findProviderById'>;
export type TrustEvidenceProviderReturnSource = Pick<ProviderReturnRepository, 'findProviderReturn'>;
export type TrustEvidenceResponsibilitySource = Pick<ProviderResponsibilityService, 'assessCurrent'>;

const unavailableSnapshot = Object.freeze({
  authorityAvailable: false,
  participationActive: false,
  visibilityAuthorized: false,
  relationshipAuthorityCurrent: false,
  sourceAuthoritiesCurrent: false,
  contextMatches: false,
  executorAttributionCurrent: false,
  authorityReferences: []
}) satisfies Readonly<TrustEvidenceCurrentAuthoritySnapshot>;

function uniqueReferences(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function contextsMatch(
  projection: Readonly<TrustEvidenceVisibilityProjectionV1>,
  items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
): boolean {
  return items.every(
    (item) =>
      item.providerId === projection.providerId &&
      item.context.providerId === projection.providerId &&
      item.context.contextFingerprintSha256 === projection.contextFingerprintSha256
  );
}

function hasBoundedNetworkGrant(
  policy: Awaited<
    ReturnType<TrustEvidenceNetworkAuthoritySource['findCurrentVisibilityPolicy']>
  >
): boolean {
  return Boolean(
    policy?.scope === 'BOUNDED_PUBLIC' &&
    policy.grants.some(
      (grant) =>
        grant.scope === 'BOUNDED_PUBLIC' &&
        grant.purpose === 'PROVIDER_DISCOVERY' &&
        grant.audience.kind === 'BOUNDED_NETWORK'
    )
  );
}

/**
 * Current serving authority for an already-known Trust Evidence projection.
 *
 * This source intentionally supports only exact MGSN-owned current truth. Historical visibility,
 * Provider Return claims and Direct Executor attribution are revalidated against their canonical
 * current owner records. Unsupported relationship/external-owner authority stays fail-closed. The
 * result grants only bounded Trust explanation serving; it cannot select, allocate, contact, file,
 * pay, retrieve artifacts or create Official Truth.
 */
export class MgsnTrustEvidenceCurrentAuthoritySource implements TrustEvidenceCurrentAuthoritySource {
  constructor(
    private readonly network: TrustEvidenceNetworkAuthoritySource,
    private readonly providerReturns: TrustEvidenceProviderReturnSource,
    private readonly providers: TrustEvidenceProviderSource,
    private readonly responsibility: TrustEvidenceResponsibilitySource
  ) {}

  async evaluateCurrentAuthority(input: {
    projection: Readonly<TrustEvidenceVisibilityProjectionV1>;
    evidenceItems: ReadonlyArray<Readonly<TrustEvidenceItemV1>>;
  }): Promise<Readonly<TrustEvidenceCurrentAuthoritySnapshot>> {
    try {
      return await this.evaluate(input.projection, input.evidenceItems);
    } catch {
      return unavailableSnapshot;
    }
  }

  private async evaluate(
    projection: Readonly<TrustEvidenceVisibilityProjectionV1>,
    items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
  ): Promise<Readonly<TrustEvidenceCurrentAuthoritySnapshot>> {
    const contextMatches = contextsMatch(projection, items);
    const sourceResult = await this.evaluateSources(projection, items);
    const executorResult = await this.evaluateExecutorAttribution(projection, items);

    if (projection.historicalAuthorization.kind !== 'NETWORK_VISIBILITY') {
      return {
        authorityAvailable: true,
        participationActive: false,
        visibilityAuthorized: false,
        relationshipAuthorityCurrent: false,
        sourceAuthoritiesCurrent: sourceResult.current,
        contextMatches,
        executorAttributionCurrent: executorResult.current,
        authorityReferences: uniqueReferences([
          ...sourceResult.authorityReferences,
          ...executorResult.authorityReferences
        ])
      };
    }

    const historical = projection.historicalAuthorization;
    const historicalParticipation = await this.network.findLatestParticipation(
      historical.networkParticipationId
    );
    if (
      !historicalParticipation ||
      historicalParticipation.providerId !== projection.providerId
    ) {
      return {
        authorityAvailable: true,
        participationActive: false,
        visibilityAuthorized: false,
        relationshipAuthorityCurrent: false,
        sourceAuthoritiesCurrent: sourceResult.current,
        contextMatches,
        executorAttributionCurrent: executorResult.current,
        authorityReferences: uniqueReferences([
          ...sourceResult.authorityReferences,
          ...executorResult.authorityReferences
        ])
      };
    }

    const currentParticipation = await this.network.findCurrentParticipation(
      historicalParticipation.workspaceId,
      projection.providerId
    );
    const participationActive = Boolean(
      currentParticipation?.networkParticipationId === historical.networkParticipationId &&
      currentParticipation.providerId === projection.providerId &&
      currentParticipation.workspaceId === historicalParticipation.workspaceId &&
      currentParticipation.state === 'ACTIVE' &&
      currentParticipation.version === historical.participationVersion
    );
    const currentPolicy = participationActive
      ? await this.network.findCurrentVisibilityPolicy(historical.networkParticipationId)
      : undefined;
    const visibilityAuthorized = Boolean(
      participationActive &&
      projection.audience.kind === 'BOUNDED_NETWORK' &&
      historical.networkPurpose === 'PROVIDER_DISCOVERY' &&
      currentPolicy?.networkParticipationId === historical.networkParticipationId &&
      currentPolicy.participationVersion === historical.participationVersion &&
      currentPolicy.version === historical.visibilityPolicyVersion &&
      currentPolicy.authorizationReference === historical.visibilityAuthorizationReference &&
      hasBoundedNetworkGrant(currentPolicy)
    );

    return {
      authorityAvailable: true,
      participationActive,
      visibilityAuthorized,
      relationshipAuthorityCurrent: false,
      sourceAuthoritiesCurrent: sourceResult.current,
      contextMatches,
      executorAttributionCurrent: executorResult.current,
      authorityReferences: uniqueReferences([
        ...(currentParticipation
          ? [
              `network-participation:${currentParticipation.networkParticipationId}:v${currentParticipation.version}`,
              currentParticipation.authorizationReference
            ]
          : []),
        ...(currentPolicy
          ? [
              `network-visibility-policy:${currentPolicy.networkParticipationId}:v${currentPolicy.version}`,
              currentPolicy.authorizationReference
            ]
          : []),
        ...sourceResult.authorityReferences,
        ...executorResult.authorityReferences
      ])
    };
  }

  private async evaluateSources(
    projection: Readonly<TrustEvidenceVisibilityProjectionV1>,
    items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
  ): Promise<Readonly<{ current: boolean; authorityReferences: readonly string[] }>> {
    if (items.length === 0) return { current: true, authorityReferences: [] };

    const authorityReferences: string[] = [];
    for (const item of items) {
      if (item.source.kind !== 'PROVIDER_CLAIM')
        return { current: false, authorityReferences };

      // V1 has no generic current-owner verifier for embedded evidence references. Preserve their
      // provenance, but do not claim current source authority until such a source exists.
      if (item.evidenceReferences.length > 0)
        return { current: false, authorityReferences };

      const source = item.source;
      const current = await this.providerReturns.findProviderReturn(source.providerReturnId);
      if (
        !current ||
        source.providerReturnStatus !== 'CURRENT' ||
        current.status !== 'CURRENT' ||
        current.providerId !== projection.providerId ||
        current.version !== source.providerReturnVersion ||
        current.returnFingerprintSha256 !== source.providerReturnFingerprintSha256
      ) {
        return { current: false, authorityReferences };
      }
      authorityReferences.push(
        `provider-return:${current.providerReturnId}:v${current.version}:${current.returnFingerprintSha256}`
      );
    }
    return { current: true, authorityReferences };
  }

  private async evaluateExecutorAttribution(
    projection: Readonly<TrustEvidenceVisibilityProjectionV1>,
    items: ReadonlyArray<Readonly<TrustEvidenceItemV1>>
  ): Promise<Readonly<{ current: boolean; authorityReferences: readonly string[] }>> {
    const established = items
      .map((item) => item.context.executorAttribution)
      .filter((attribution) => attribution.state === 'ESTABLISHED');
    if (established.length === 0) return { current: true, authorityReferences: [] };

    const provider = await this.providers.findProviderById(projection.providerId);
    if (!provider || provider.operationalStatus !== 'ACTIVE')
      return { current: false, authorityReferences: [] };

    const result = await this.responsibility.assessCurrent(
      projection.providerId,
      provider.providerWorkspaceId
    );
    const assessment = result.assessment;
    if (
      !assessment ||
      assessment.directExecutorEstablished !== true ||
      (assessment.state !== 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' &&
        assessment.state !== 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED') ||
      assessment.profileAuthorityState !== 'CURRENT' ||
      assessment.finalExecutionProviderId !== projection.providerId ||
      assessment.finalExecutionProviderWorkspaceId !== provider.providerWorkspaceId
    ) {
      return { current: false, authorityReferences: [] };
    }

    const exactHistoricalLineage = established.every(
      (attribution) =>
        attribution.finalExecutionProviderId === projection.providerId &&
        attribution.assessmentState === assessment.state &&
        attribution.profile.providerResponsibilityProfileId ===
          assessment.profile.providerResponsibilityProfileId &&
        attribution.profile.version === assessment.profile.version &&
        attribution.profile.profileFingerprintSha256 ===
          assessment.profile.profileFingerprintSha256
    );
    if (!exactHistoricalLineage) return { current: false, authorityReferences: [] };

    return {
      current: true,
      authorityReferences: [
        `provider-responsibility:${assessment.profile.providerResponsibilityProfileId}:v${assessment.profile.version}:${assessment.profile.profileFingerprintSha256}`
      ]
    };
  }
}
