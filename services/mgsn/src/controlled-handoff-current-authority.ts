import type {
  AuthorizedDataProjectionV1,
  ControlledHandoffSourceLineageV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type { DiscoveryCurrentSourceVersionV1 } from '@markorbit/contracts/provider-discovery';
import type { NetworkParticipationId } from '@markorbit/contracts/network-participation';
import type { ProviderId, ProviderSupplyCapabilityId } from '@markorbit/contracts/provider-execution';
import type {
  ControlledHandoffCurrentAuthoritySnapshot,
  ControlledHandoffCurrentAuthoritySource
} from './controlled-privacy-handoff.js';
import type { NetworkParticipationRepository } from './network-participation.js';
import { providerDiscoveryFingerprint } from './provider-discovery.js';
import type { ProviderRegistryRepository } from './provider-registry.js';
import { isSupplyOperationallyEligibleAt } from './provider-registry.js';
import type { ProviderResponsibilityService } from './provider-responsibility.js';
import {
  ProviderSelectionError,
  type ProviderSelectionService
} from './provider-selection.js';

export type HandoffNetworkAuthoritySource = Pick<
  NetworkParticipationRepository,
  'findLatestParticipation' | 'findCurrentParticipation' | 'findCurrentVisibilityPolicy'
>;
export type HandoffProviderAuthoritySource = Pick<
  ProviderRegistryRepository,
  'findProviderById' | 'findSupplyCapability'
>;
export type HandoffResponsibilityAuthoritySource = Pick<
  ProviderResponsibilityService,
  'assessCurrent'
>;

const unavailableSnapshot = Object.freeze({
  authorityAvailable: false,
  selectionCurrent: false,
  selectionScopeMatch: false,
  sourceVersionsMatch: false,
  sourceAccessCurrent: false,
  participationActive: false,
  visibilityAuthorized: false,
  directExecutorEstablished: false,
  hiddenIntermediaryDetected: false,
  evidenceArtifactAccessAuthorized: false,
  checkedAuthorityReferences: []
}) satisfies Readonly<ControlledHandoffCurrentAuthoritySnapshot>;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function exactScope(
  left: ControlledHandoffSourceLineageV1['selectionLineage']['selectionScope'],
  right: ControlledHandoffSourceLineageV1['selectionLineage']['selectionScope']
): boolean {
  return (
    left.owner === right.owner &&
    left.reference === right.reference &&
    left.version === right.version &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
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

function positiveResponsibility(
  assessment: Awaited<ReturnType<HandoffResponsibilityAuthoritySource['assessCurrent']>>['assessment'],
  providerId: ProviderId,
  providerWorkspaceId: string
): assessment is NonNullable<
  Awaited<ReturnType<HandoffResponsibilityAuthoritySource['assessCurrent']>>['assessment']
> {
  return Boolean(
    assessment?.directExecutorEstablished === true &&
    (assessment.state === 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' ||
      assessment.state === 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED') &&
    assessment.profileAuthorityState === 'CURRENT' &&
    assessment.finalExecutionProviderId === providerId &&
    assessment.finalExecutionProviderWorkspaceId.toLowerCase() === providerWorkspaceId.toLowerCase()
  );
}

function versionFingerprintMatches(
  source: Readonly<DiscoveryCurrentSourceVersionV1>,
  version: number | string,
  fingerprintSha256: string
): boolean {
  return source.version === version && source.fingerprintSha256 === fingerprintSha256;
}

/**
 * Current Handoff authority composes exact current Selection with only the MGSN source classes that
 * this owner can revalidate. External owner projection/source authority remains fail-closed until a
 * canonical verifier exists; historical CURRENT descriptors never become serving permission.
 */
export class MgsnControlledHandoffCurrentAuthoritySource
  implements ControlledHandoffCurrentAuthoritySource
{
  constructor(
    private readonly selection: Pick<ProviderSelectionService, 'validateCurrent'>,
    private readonly network: HandoffNetworkAuthoritySource,
    private readonly providers: HandoffProviderAuthoritySource,
    private readonly responsibility: HandoffResponsibilityAuthoritySource,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async evaluateCurrentAuthority(
    input: Parameters<ControlledHandoffCurrentAuthoritySource['evaluateCurrentAuthority']>[0]
  ): Promise<Readonly<ControlledHandoffCurrentAuthoritySnapshot>> {
    try {
      return await this.evaluate(input);
    } catch {
      return unavailableSnapshot;
    }
  }

  private async evaluate(
    input: Parameters<ControlledHandoffCurrentAuthoritySource['evaluateCurrentAuthority']>[0]
  ): Promise<Readonly<ControlledHandoffCurrentAuthoritySnapshot>> {
    const container = input.envelope ?? input.command;
    if (!container) return unavailableSnapshot;
    const lineage = container.sourceLineage;
    const selectionLineage = lineage.selectionLineage;
    const checkedAt = input.attempt?.attemptedAt ?? this.now();

    let validation: Awaited<ReturnType<ProviderSelectionService['validateCurrent']>>;
    try {
      validation = await this.selection.validateCurrent(
        { workspaceId: container.originatingWorkspaceId },
        {
          scope: selectionLineage.selectionScope,
          providerSelectionId: selectionLineage.selection.providerSelectionId,
          purpose: 'CONTROLLED_HANDOFF_REVIEW',
          checkedAt
        }
      );
    } catch (error) {
      if (error instanceof ProviderSelectionError && error.code === 'SELECTION_NOT_FOUND') {
        return { ...unavailableSnapshot, authorityAvailable: true };
      }
      return unavailableSnapshot;
    }

    const selectionReferenceMatches =
      validation.selection.providerSelectionId === selectionLineage.selection.providerSelectionId &&
      validation.selection.version === selectionLineage.selection.version &&
      validation.selection.scopeVersion === selectionLineage.selection.scopeVersion &&
      exactScope(validation.scope, selectionLineage.selectionScope);
    const selectionCurrent =
      validation.decision === 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW' &&
      validation.currentlyUsable === true;
    const selectionReferences = [...validation.checkedAuthorityReferences];
    if (!selectionCurrent || !selectionReferenceMatches) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        selectionCurrent,
        selectionScopeMatch: selectionReferenceMatches,
        checkedAuthorityReferences: unique(selectionReferences)
      };
    }

    const selectedProvider = selectionLineage.selectedProvider;
    if (
      selectedProvider.providerId !== container.recipient.providerId ||
      selectedProvider.providerWorkspaceId.toLowerCase() !==
        container.recipient.providerWorkspaceId.toLowerCase()
    ) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        selectionCurrent: true,
        selectionScopeMatch: true,
        checkedAuthorityReferences: unique(selectionReferences)
      };
    }

    const sources = await this.revalidateSourceVersions(
      lineage.currentSourceVersions,
      selectedProvider.providerId,
      selectedProvider.providerWorkspaceId,
      checkedAt
    );
    if (!sources.current) {
      return {
        ...unavailableSnapshot,
        authorityAvailable: true,
        selectionCurrent: true,
        selectionScopeMatch: true,
        participationActive: true,
        visibilityAuthorized: true,
        directExecutorEstablished: true,
        sourceVersionsMatch: false,
        checkedAuthorityReferences: unique([...selectionReferences, ...sources.references])
      };
    }

    const sourceAccessCurrent = this.projectionAccessCurrent(
      container.authorizedProjection,
      lineage.currentSourceVersions
    );
    return {
      authorityAvailable: true,
      selectionCurrent: true,
      selectionScopeMatch: true,
      sourceVersionsMatch: true,
      sourceAccessCurrent,
      participationActive: true,
      visibilityAuthorized: true,
      directExecutorEstablished: true,
      hiddenIntermediaryDetected: false,
      evidenceArtifactAccessAuthorized: false,
      checkedAuthorityReferences: unique([...selectionReferences, ...sources.references])
    };
  }

  private projectionAccessCurrent(
    projection: Readonly<AuthorizedDataProjectionV1>,
    sources: readonly Readonly<DiscoveryCurrentSourceVersionV1>[]
  ): boolean {
    return projection.items.every((item) => {
      if (item.sourceOwner !== 'MGSN' || item.authorizedBySourceOwner !== true) return false;
      return sources.some(
        (source) =>
          source.owner === 'MGSN' &&
          source.sourceId === item.sourceReference &&
          source.version === item.sourceVersion &&
          source.fingerprintSha256 === item.sourceFingerprintSha256
      );
    });
  }

  private async revalidateSourceVersions(
    sources: readonly Readonly<DiscoveryCurrentSourceVersionV1>[],
    providerId: ProviderId,
    providerWorkspaceId: string,
    checkedAt: string
  ): Promise<Readonly<{ current: boolean; references: readonly string[] }>> {
    if (sources.length === 0) return { current: false, references: [] };
    const references: string[] = [];
    for (const source of sources) {
      if (source.owner !== 'MGSN') return { current: false, references };
      if (source.sourceType === 'PROVIDER') {
        if (source.sourceId !== providerId) return { current: false, references };
        const provider = await this.providers.findProviderById(providerId);
        if (
          !provider ||
          provider.providerWorkspaceId.toLowerCase() !== providerWorkspaceId.toLowerCase() ||
          provider.operationalStatus !== 'ACTIVE' ||
          !versionFingerprintMatches(source, provider.version, providerFingerprint(provider))
        )
          return { current: false, references };
        references.push(`mgsn-provider:${provider.providerId}:v${provider.version}`);
        continue;
      }

      if (source.sourceType === 'PROVIDER_SUPPLY_CAPABILITY') {
        const supply = await this.providers.findSupplyCapability(
          source.sourceId as ProviderSupplyCapabilityId
        );
        const provider = await this.providers.findProviderById(providerId);
        if (
          !provider ||
          !supply ||
          supply.provider.providerId !== providerId ||
          supply.provider.providerWorkspaceId.toLowerCase() !== providerWorkspaceId.toLowerCase() ||
          supply.verificationState !== 'VERIFIED_FOR_SUPPLY' ||
          !isSupplyOperationallyEligibleAt(provider, supply, checkedAt) ||
          !versionFingerprintMatches(source, supply.version, supply.sourceFingerprintSha256)
        )
          return { current: false, references };
        references.push(
          `mgsn-provider-supply:${supply.providerSupplyCapabilityId}:v${supply.version}:${supply.sourceFingerprintSha256}`
        );
        continue;
      }

      if (source.sourceType === 'NETWORK_PARTICIPATION') {
        const participation = await this.network.findLatestParticipation(
          source.sourceId as NetworkParticipationId
        );
        const current = participation
          ? await this.network.findCurrentParticipation(providerWorkspaceId, providerId)
          : undefined;
        if (
          !participation ||
          !current ||
          current.networkParticipationId !== participation.networkParticipationId ||
          participation.providerId !== providerId ||
          participation.workspaceId.toLowerCase() !== providerWorkspaceId.toLowerCase() ||
          current.state !== 'ACTIVE' ||
          !versionFingerprintMatches(source, current.version, participationFingerprint(current))
        )
          return { current: false, references };
        references.push(
          `mgsn-network-participation:${current.networkParticipationId}:v${current.version}`
        );
        continue;
      }

      if (source.sourceType === 'NETWORK_VISIBILITY_POLICY') {
        const policy = await this.network.findCurrentVisibilityPolicy(
          source.sourceId as NetworkParticipationId
        );
        if (
          !policy ||
          policy.scope === 'PRIVATE' ||
          !versionFingerprintMatches(source, policy.version, visibilityFingerprint(policy))
        )
          return { current: false, references };
        references.push(`mgsn-network-visibility:${policy.networkParticipationId}:v${policy.version}`);
        continue;
      }

      if (source.sourceType === 'PROVIDER_RESPONSIBILITY_PROFILE') {
        const assessment = (
          await this.responsibility.assessCurrent(providerId, providerWorkspaceId, checkedAt)
        ).assessment;
        if (
          !positiveResponsibility(assessment, providerId, providerWorkspaceId) ||
          source.sourceId !== assessment.profile.providerResponsibilityProfileId ||
          !versionFingerprintMatches(
            source,
            assessment.profile.version,
            assessment.profile.profileFingerprintSha256
          )
        )
          return { current: false, references };
        references.push(
          `mgsn-provider-responsibility:${assessment.profile.providerResponsibilityProfileId}:v${assessment.profile.version}:${assessment.profile.profileFingerprintSha256}`
        );
        continue;
      }

      return { current: false, references };
    }
    return { current: true, references };
  }
}
