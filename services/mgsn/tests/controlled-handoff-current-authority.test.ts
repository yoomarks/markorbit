import { describe, expect, it, vi } from 'vitest';
import {
  controlledHandoffContractFixtureV1,
  type AuthorizeOrReplaceControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import { noDownstreamProviderSelectionAuthorityConsequences } from '@markorbit/contracts/provider-selection';
import type { ProviderRegistryRecord } from '../src/provider-registry.js';
import { providerDiscoveryFingerprint } from '../src/provider-discovery.js';
import {
  MgsnControlledHandoffCurrentAuthoritySource,
  type HandoffNetworkAuthoritySource,
  type HandoffProviderAuthoritySource,
  type HandoffResponsibilityAuthoritySource
} from '../src/controlled-handoff-current-authority.js';
import type { ProviderSelectionService } from '../src/provider-selection.js';

const fixture = controlledHandoffContractFixtureV1;
const providerId = fixture.authorizeCommand.recipient.providerId;
const providerWorkspaceId = fixture.authorizeCommand.recipient.providerWorkspaceId;
const at = '2026-09-04T09:45:00.000Z';

const provider: ProviderRegistryRecord = {
  schemaVersion: 1,
  providerId,
  providerWorkspaceId,
  displayName: 'Handoff 715 Provider',
  operationalStatus: 'ACTIVE',
  version: 2,
  createdBy: 'system',
  updatedBy: 'system',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z'
};

function providerFingerprint(): string {
  return providerDiscoveryFingerprint({
    providerId: provider.providerId,
    providerWorkspaceId: provider.providerWorkspaceId,
    operationalStatus: provider.operationalStatus,
    version: provider.version,
    updatedAt: provider.updatedAt
  });
}

function selectionValidation(overrides: Record<string, unknown> = {}) {
  const lineage = fixture.authorizeCommand.sourceLineage.selectionLineage;
  return {
    schemaVersion: 1 as const,
    selection: lineage.selection,
    requesterWorkspaceId: fixture.authorizeCommand.originatingWorkspaceId,
    scope: lineage.selectionScope,
    purpose: 'CONTROLLED_HANDOFF_REVIEW' as const,
    evaluatedAt: at,
    validationPolicyVersion: 'mgsn-provider-selection-validation-v1',
    checkedAuthorityReferences: ['selection-current:715'],
    authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
    validationDoesNotAuthorizeDownstreamAction: true as const,
    decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW' as const,
    currentlyUsable: true as const,
    publicReason: 'Current authority permits this Selection for the bounded review.',
    ...overrides
  };
}

function command(options: { externalProjection?: boolean } = {}): AuthorizeOrReplaceControlledHandoffCommandV1 {
  const base = structuredClone(fixture.authorizeCommand);
  const fingerprint = providerFingerprint();
  return {
    ...base,
    authorizedProjection: {
      ...base.authorizedProjection,
      items: [
        options.externalProjection
          ? {
              dataClass: 'APPLICANT_OWNER_OFFICIAL_DATA',
              fieldPath: 'legalName',
              sourceOwner: 'MARKREG',
              sourceReference: 'applicant:handoff-715',
              sourceVersion: 1,
              sourceFingerprintSha256: 'd'.repeat(64),
              necessityReference: 'necessity:handoff-715',
              requested: true,
              authorizedBySourceOwner: true,
              minimumNecessary: true,
              fieldValueEmbeddedInEnvelope: false,
              evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE'
            }
          : {
              dataClass: 'PROVIDER_REFERENCE',
              fieldPath: 'providerId',
              sourceOwner: 'MGSN',
              sourceReference: providerId,
              sourceVersion: provider.version,
              sourceFingerprintSha256: fingerprint,
              necessityReference: 'necessity:handoff-715-provider-reference',
              requested: true,
              authorizedBySourceOwner: true,
              minimumNecessary: true,
              fieldValueEmbeddedInEnvelope: false,
              evidenceArtifactRetrievalAuthority: 'NOT_APPLICABLE'
            }
      ]
    },
    sourceLineage: {
      ...base.sourceLineage,
      currentSourceVersions: [
        {
          owner: 'MGSN',
          sourceType: 'PROVIDER',
          sourceId: providerId,
          version: provider.version,
          fingerprintSha256: fingerprint,
          checkedAt: at,
          authorityState: 'CURRENT'
        }
      ]
    }
  };
}

function harness(validation = selectionValidation()) {
  const selection: Pick<ProviderSelectionService, 'validateCurrent'> = {
    validateCurrent: vi.fn(() => Promise.resolve(validation))
  };
  const network: HandoffNetworkAuthoritySource = {
    findLatestParticipation: vi.fn(() => Promise.resolve(undefined)),
    findCurrentParticipation: vi.fn(() => Promise.resolve(undefined)),
    findCurrentVisibilityPolicy: vi.fn(() => Promise.resolve(undefined))
  };
  const providers: HandoffProviderAuthoritySource = {
    findProviderById: vi.fn(() => Promise.resolve(provider)),
    findSupplyCapability: vi.fn(() => Promise.resolve(undefined))
  };
  const responsibility: HandoffResponsibilityAuthoritySource = {
    assessCurrent: vi.fn(() =>
      Promise.resolve({ state: 'UNKNOWN_OR_UNPROVEN', assessment: null })
    )
  };
  return {
    selection,
    source: new MgsnControlledHandoffCurrentAuthoritySource(
      selection,
      network,
      providers,
      responsibility,
      () => at
    )
  };
}

describe('MGSN current Controlled Handoff authority', () => {
  it('reuses exact current Selection and permits only current MGSN-owned source access', async () => {
    const { source, selection } = harness();

    await expect(
      source.evaluateCurrentAuthority({ command: command(), purpose: 'HANDOFF_AUTHORIZE' })
    ).resolves.toMatchObject({
      authorityAvailable: true,
      selectionCurrent: true,
      selectionScopeMatch: true,
      sourceVersionsMatch: true,
      sourceAccessCurrent: true,
      participationActive: true,
      visibilityAuthorized: true,
      directExecutorEstablished: true,
      hiddenIntermediaryDetected: false,
      evidenceArtifactAccessAuthorized: false
    });
    expect(selection.validateCurrent).toHaveBeenCalledWith(
      { workspaceId: fixture.authorizeCommand.originatingWorkspaceId },
      expect.objectContaining({
        providerSelectionId:
          fixture.authorizeCommand.sourceLineage.selectionLineage.selection.providerSelectionId,
        purpose: 'CONTROLLED_HANDOFF_REVIEW'
      })
    );
  });

  it('fails external owner projection access closed without a canonical owner verifier', async () => {
    const { source } = harness();

    await expect(
      source.evaluateCurrentAuthority({
        command: command({ externalProjection: true }),
        purpose: 'HANDOFF_AUTHORIZE'
      })
    ).resolves.toMatchObject({
      selectionCurrent: true,
      selectionScopeMatch: true,
      sourceVersionsMatch: true,
      sourceAccessCurrent: false,
      evidenceArtifactAccessAuthorized: false
    });
  });

  it('requires the exact current Selection version and scope, not historical validation history', async () => {
    const { source } = harness(
      selectionValidation({
        selection: {
          ...fixture.authorizeCommand.sourceLineage.selectionLineage.selection,
          version: 2
        }
      })
    );

    await expect(
      source.evaluateCurrentAuthority({ command: command(), purpose: 'HANDOFF_AUTHORIZE' })
    ).resolves.toMatchObject({
      authorityAvailable: true,
      selectionCurrent: true,
      selectionScopeMatch: false,
      sourceVersionsMatch: false
    });
  });

  it('does not reuse a persisted positive Selection validation after current Selection denial', async () => {
    const lineage = fixture.authorizeCommand.sourceLineage.selectionLineage;
    const { source } = harness({
      schemaVersion: 1,
      selection: lineage.selection,
      requesterWorkspaceId: fixture.authorizeCommand.originatingWorkspaceId,
      scope: lineage.selectionScope,
      purpose: 'CONTROLLED_HANDOFF_REVIEW',
      evaluatedAt: at,
      validationPolicyVersion: 'mgsn-provider-selection-validation-v1',
      checkedAuthorityReferences: [],
      authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
      validationDoesNotAuthorizeDownstreamAction: true,
      decision: 'DENY',
      currentlyUsable: false,
      denialReason: 'PARTICIPATION_NOT_ACTIVE',
      publicReason: 'Current network participation does not permit this bounded review.'
    });

    await expect(
      source.evaluateCurrentAuthority({ command: command(), purpose: 'HANDOFF_AUTHORIZE' })
    ).resolves.toMatchObject({
      authorityAvailable: true,
      selectionCurrent: false,
      sourceVersionsMatch: false,
      sourceAccessCurrent: false
    });
  });

  it('never authorizes evidence artifact retrieval from Handoff source visibility', async () => {
    const { source } = harness();
    const currentEnvelope = {
      ...structuredClone(fixture.currentEnvelope),
      authorizedProjection: command().authorizedProjection,
      sourceLineage: command().sourceLineage
    };

    await expect(
      source.evaluateCurrentAuthority({
        envelope: currentEnvelope,
        purpose: 'EVIDENCE_REFERENCE_RETRIEVAL_REVIEW',
        attempt: {
          ...structuredClone(fixture.validForExactConsumption.attempt),
          artifactRetrievalRequested: true,
          attemptedAt: at
        }
      })
    ).resolves.toMatchObject({
      evidenceArtifactAccessAuthorized: false
    });
  });
});
