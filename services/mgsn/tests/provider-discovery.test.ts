import { describe, expect, it, vi } from 'vitest';
import type {
  ProviderDiscoveryRequestReferenceV1,
  ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import {
  noNetworkParticipationAuthorityConsequences,
  type NetworkParticipationSnapshotV1,
  type NetworkVisibilityGrantV1
} from '@markorbit/contracts/network-participation';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import {
  ProviderDiscoveryService,
  type ProviderDiscoverySource,
  type ProviderDiscoverySourceBatch,
  type ProviderDiscoverySourceRepository
} from '../src/provider-discovery.js';

const requesterWorkspaceId = '11111111-1111-4111-8111-111111111111';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const providerId = 'provider_discovery_544' as ProviderId;
const at = '2026-09-02T02:00:00.000Z';

const grants: readonly NetworkVisibilityGrantV1[] = [
  {
    dataClass: 'ORGANIZATION_IDENTITY',
    fields: ['displayName'],
    scope: 'BOUNDED_PUBLIC',
    audience: { kind: 'BOUNDED_NETWORK' },
    purpose: 'PROVIDER_DISCOVERY',
    authorityReferences: ['authority:organization-identity']
  },
  {
    dataClass: 'PROVIDER_REFERENCE',
    fields: ['providerId', 'displayName'],
    scope: 'BOUNDED_PUBLIC',
    audience: { kind: 'BOUNDED_NETWORK' },
    purpose: 'PROVIDER_DISCOVERY',
    authorityReferences: ['authority:provider-reference']
  },
  {
    dataClass: 'SUPPLY_PROFILE',
    fields: ['serviceTypes'],
    scope: 'BOUNDED_PUBLIC',
    audience: { kind: 'BOUNDED_NETWORK' },
    purpose: 'PROVIDER_DISCOVERY',
    authorityReferences: ['authority:supply-profile']
  },
  {
    dataClass: 'SERVICE_JURISDICTIONS',
    fields: ['jurisdictions'],
    scope: 'BOUNDED_PUBLIC',
    audience: { kind: 'BOUNDED_NETWORK' },
    purpose: 'PROVIDER_DISCOVERY',
    authorityReferences: ['authority:jurisdictions']
  },
  {
    dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
    fields: ['evidenceReferences'],
    scope: 'BOUNDED_PUBLIC',
    audience: { kind: 'BOUNDED_NETWORK' },
    purpose: 'PROVIDER_DISCOVERY',
    authorityReferences: ['authority:evidence-reference']
  }
];

function request(
  overrides: Partial<ProviderDiscoveryRequestReferenceV1> = {}
): ProviderDiscoveryRequestReferenceV1 {
  return {
    schemaVersion: 1,
    providerDiscoveryRequestId: 'provider-discovery-request_544',
    requesterWorkspaceId,
    need: {
      reference: 'need:544',
      version: 1,
      fingerprintSha256: '1'.repeat(64),
      jurisdiction: 'US',
      serviceType: 'TRADEMARK_APPLICATION'
    },
    purpose: 'PROVIDER_DISCOVERY',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextReference: 'context:544',
    requestedDataClasses: [
      'ORGANIZATION_IDENTITY',
      'PROVIDER_REFERENCE',
      'SUPPLY_PROFILE',
      'SERVICE_JURISDICTIONS',
      'PROVIDER_EVIDENCE_REFERENCE'
    ],
    requestedFields: [
      'providerId',
      'displayName',
      'serviceTypes',
      'jurisdictions',
      'evidenceReferences'
    ],
    requestedAt: at,
    requestFingerprintSha256: '2'.repeat(64),
    correlationId: 'correlation_discovery_544',
    ...overrides
  };
}

function participation(
  overrides: Partial<Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }>> = {}
): Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }> {
  return {
    schemaVersion: 1,
    networkParticipationId: 'network-participation_discovery_544',
    workspaceId: providerWorkspaceId,
    providerId,
    participationVersion: 3,
    state: 'ACTIVE',
    authorizationReference: 'authority:participation',
    visibilityPolicy: {
      schemaVersion: 1,
      version: 4,
      scope: 'BOUNDED_PUBLIC',
      grants: grants as [NetworkVisibilityGrantV1, ...NetworkVisibilityGrantV1[]],
      authorizationReference: 'authority:visibility',
      updatedAt: at
    },
    checkedAt: at,
    authorityConsequences: noNetworkParticipationAuthorityConsequences,
    ...overrides
  };
}

function noParticipation(): Extract<
  NetworkParticipationSnapshotV1,
  { networkParticipationId: null }
> {
  return {
    schemaVersion: 1,
    networkParticipationId: null,
    workspaceId: providerWorkspaceId,
    providerId,
    participationVersion: null,
    state: 'NOT_PARTICIPATING',
    authorizationReference: null,
    visibilityPolicy: {
      schemaVersion: 1,
      version: null,
      scope: 'PRIVATE',
      grants: [],
      authorizationReference: null
    },
    checkedAt: at,
    authorityConsequences: noNetworkParticipationAuthorityConsequences
  };
}

function source(
  overrides: {
    provider?: Partial<ProviderDiscoverySource['provider']>;
    supply?: Partial<ProviderDiscoverySource['supply']>;
    participation?: NetworkParticipationSnapshotV1;
    visibilityAuthorityState?: ProviderDiscoverySource['visibilityAuthorityState'];
    providerSequence?: number;
  } = {}
): ProviderDiscoverySource {
  const sequence = overrides.providerSequence ?? 1;
  const id =
    overrides.providerSequence === undefined
      ? providerId
      : (`provider_discovery_544_${sequence}` as ProviderId);
  const workspaceId =
    overrides.providerSequence === undefined
      ? providerWorkspaceId
      : `22222222-2222-4222-8222-${String(sequence).padStart(12, '0')}`;
  const baseParticipation = participation({
    providerId: id,
    workspaceId,
    networkParticipationId: `network-participation_discovery_544_${sequence}`
  });
  return {
    provider: {
      providerId: id,
      providerWorkspaceId: workspaceId,
      displayName: `Provider ${sequence}`,
      operationalStatus: 'ACTIVE',
      version: 2,
      fingerprintSha256: 'a'.repeat(64),
      updatedAt: at,
      ...overrides.provider
    },
    supply: {
      providerSupplyCapabilityId: `provider-supply-capability_discovery_544_${sequence}`,
      providerId: id,
      providerWorkspaceId: workspaceId,
      version: 5,
      status: 'ACTIVE',
      jurisdictions: ['US'],
      serviceTypes: ['TRADEMARK_APPLICATION'],
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveUntil: '2027-01-01T00:00:00.000Z',
      verificationState: 'VERIFIED_FOR_SUPPLY',
      evidenceReferences: ['provider-evidence:authorized-544'],
      fingerprintSha256: 'b'.repeat(64),
      hasOperationalAvailability: true,
      ...overrides.supply
    },
    participation:
      overrides.participation ??
      (overrides.provider || overrides.supply
        ? participation({
            providerId: overrides.provider?.providerId ?? id,
            workspaceId:
              overrides.provider?.providerWorkspaceId ??
              overrides.supply?.providerWorkspaceId ??
              workspaceId,
            networkParticipationId: `network-participation_discovery_544_${sequence}`
          })
        : baseParticipation),
    visibilityAuthorityState: overrides.visibilityAuthorityState ?? 'CURRENT',
    participationFingerprintSha256: 'c'.repeat(64),
    visibilityPolicyFingerprintSha256: 'd'.repeat(64)
  };
}

function repository(
  batch: ProviderDiscoverySourceBatch | Error
): ProviderDiscoverySourceRepository {
  return {
    queryCurrentSources: vi.fn(() =>
      batch instanceof Error ? Promise.reject(batch) : Promise.resolve(batch)
    )
  };
}

function service(
  batch: ProviderDiscoverySourceBatch | Error,
  relationship?: ConstructorParameters<typeof ProviderDiscoveryService>[1]
) {
  return new ProviderDiscoveryService(repository(batch), relationship);
}

const principal = { workspaceId: requesterWorkspaceId, actorId: 'user_discovery_544' };

async function evaluated(
  currentSource: ProviderDiscoverySource,
  currentRequest = request()
): Promise<ProviderDiscoveryResultV1> {
  return service({ sources: [currentSource], complete: true }).evaluate(principal, currentRequest);
}

function privatePolicy(current: ReturnType<typeof participation>) {
  return {
    ...current,
    visibilityPolicy: {
      schemaVersion: 1 as const,
      version: 5,
      scope: 'PRIVATE' as const,
      grants: [] as const,
      authorizationReference: 'authority:private',
      updatedAt: at
    }
  };
}

describe('MGSN P0 #544 Provider Discovery live evaluation', () => {
  it('denies no participation, PRIVATE, PAUSED, and REVOKED without provider leakage', async () => {
    const cases = [
      source({ participation: noParticipation() }),
      source({ participation: privatePolicy(participation()) }),
      source({ participation: participation({ state: 'PAUSED' }) }),
      source({ participation: participation({ state: 'REVOKED' }) })
    ];
    for (const value of cases) {
      const result = await evaluated(value);
      expect(result).toMatchObject({ status: 'NO_AUTHORIZED_CANDIDATES', candidates: [] });
      expect(JSON.stringify(result)).not.toContain(value.provider.displayName);
    }
  });

  it('denies stale and ambiguous visibility and treats unavailable visibility as unavailable', async () => {
    await expect(evaluated(source({ visibilityAuthorityState: 'STALE' }))).resolves.toMatchObject({
      status: 'NO_AUTHORIZED_CANDIDATES'
    });
    await expect(
      evaluated(source({ visibilityAuthorityState: 'AMBIGUOUS' }))
    ).resolves.toMatchObject({ status: 'NO_AUTHORIZED_CANDIDATES' });
    await expect(
      evaluated(source({ visibilityAuthorityState: 'UNAVAILABLE' }))
    ).resolves.toMatchObject({ status: 'AUTHORITY_UNAVAILABLE', candidates: [] });
  });

  it('fails closed for denied purpose, audience, data class, and field', async () => {
    await expect(
      evaluated(source(), request({ purpose: 'OTHER' as 'PROVIDER_DISCOVERY' }))
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    const trusted = request({
      audience: {
        kind: 'TRUSTED_RELATIONSHIP',
        relationshipAuthorityReference: 'relationship:self-reference-is-not-proof'
      }
    });
    await expect(evaluated(source(), trusted)).resolves.toMatchObject({
      status: 'NO_AUTHORIZED_CANDIDATES'
    });

    const onlyProviderId = participation({
      visibilityPolicy: {
        schemaVersion: 1,
        version: 8,
        scope: 'BOUNDED_PUBLIC',
        grants: [grants[1]!] as [NetworkVisibilityGrantV1],
        authorizationReference: 'authority:provider-id-only',
        updatedAt: at
      }
    });
    await expect(evaluated(source({ participation: onlyProviderId }))).resolves.toMatchObject({
      status: 'NO_AUTHORIZED_CANDIDATES'
    });

    const providerIdFieldOnly = participation({
      visibilityPolicy: {
        schemaVersion: 1,
        version: 8,
        scope: 'BOUNDED_PUBLIC',
        grants: [
          {
            ...grants[1]!,
            fields: ['providerId'] as const
          }
        ] as [NetworkVisibilityGrantV1],
        authorizationReference: 'authority:provider-id-field-only',
        updatedAt: at
      }
    });
    const providerNameRequest = request({
      requestedDataClasses: ['PROVIDER_REFERENCE'],
      requestedFields: ['providerId', 'displayName']
    });
    await expect(
      evaluated(source({ participation: providerIdFieldOnly }), providerNameRequest)
    ).resolves.toMatchObject({ status: 'NO_AUTHORIZED_CANDIDATES' });
  });

  it('does not treat a TRUSTED request self-reference as current relationship proof', async () => {
    const trustedReference = 'relationship:trusted-544';
    const trustedGrant: NetworkVisibilityGrantV1 = {
      dataClass: 'PROVIDER_REFERENCE',
      fields: ['providerId'],
      scope: 'TRUSTED',
      audience: {
        kind: 'TRUSTED_RELATIONSHIP',
        relationshipAuthorityReference: trustedReference
      },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['authority:trusted-policy']
    };
    const trustedParticipation = participation({
      visibilityPolicy: {
        schemaVersion: 1,
        version: 9,
        scope: 'TRUSTED',
        grants: [trustedGrant],
        authorizationReference: 'authority:trusted',
        updatedAt: at
      }
    });
    const trustedRequest = request({
      audience: {
        kind: 'TRUSTED_RELATIONSHIP',
        relationshipAuthorityReference: trustedReference
      },
      requestedDataClasses: ['PROVIDER_REFERENCE'],
      requestedFields: ['providerId']
    });

    await expect(
      evaluated(source({ participation: trustedParticipation }), trustedRequest)
    ).resolves.toMatchObject({ status: 'NO_AUTHORIZED_CANDIDATES' });

    const currentAuthority = {
      getCurrentRelationshipAuthority: vi.fn(() =>
        Promise.resolve({
          state: 'CURRENT' as const,
          relationshipAuthorityReference: trustedReference
        })
      )
    };
    const result = await service(
      { sources: [source({ participation: trustedParticipation })], complete: true },
      currentAuthority
    ).evaluate(principal, trustedRequest);
    expect(result.status).toBe('CANDIDATES');
    expect(currentAuthority.getCurrentRelationshipAuthority).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterWorkspaceId,
        trustedActorId: principal.actorId,
        relationshipAuthorityReference: trustedReference
      })
    );
  });

  it('requires the trusted Workspace to equal the request Workspace before querying sources', async () => {
    const queryCurrentSources = vi.fn(() =>
      Promise.resolve({ sources: [source()], complete: true } as const)
    );
    const sourceRepository: ProviderDiscoverySourceRepository = { queryCurrentSources };
    await expect(
      new ProviderDiscoveryService(sourceRepository).evaluate(
        { ...principal, workspaceId: '33333333-3333-4333-8333-333333333333' },
        request()
      )
    ).rejects.toMatchObject({ code: 'REQUESTER_WORKSPACE_MISMATCH', status: 404 });
    expect(queryCurrentSources).not.toHaveBeenCalled();
  });

  it('keeps suitability independent for service, jurisdiction, Provider, Supply, and period', async () => {
    const cases = [
      source({ supply: { serviceTypes: ['OFFICE_ACTION'] } }),
      source({ supply: { jurisdictions: ['CA'] } }),
      source({ provider: { operationalStatus: 'SUSPENDED' } }),
      source({ supply: { status: 'SUSPENDED' } }),
      source({ supply: { verificationState: 'UNVERIFIED' } }),
      source({ supply: { hasOperationalAvailability: false } }),
      source({ supply: { effectiveUntil: '2026-09-01T00:00:00.000Z' } })
    ];
    for (const value of cases)
      await expect(evaluated(value)).resolves.toMatchObject({
        status: 'NO_AUTHORIZED_CANDIDATES'
      });
  });

  it('emits a canonical candidate containing exact authorized fields only', async () => {
    const boundedRequest = request({
      requestedDataClasses: ['PROVIDER_REFERENCE', 'SUPPLY_PROFILE'],
      requestedFields: ['providerId', 'serviceTypes']
    });
    const result = await evaluated(source(), boundedRequest);
    expect(result.status).toBe('CANDIDATES');
    if (result.status !== 'CANDIDATES') throw new Error('candidate expected');
    expect(result.candidates[0].authorizedProjection.fields).toEqual([
      {
        dataClass: 'PROVIDER_REFERENCE',
        field: 'providerId',
        value: result.candidates[0].providerId
      },
      {
        dataClass: 'SUPPLY_PROFILE',
        field: 'serviceTypes',
        value: ['TRADEMARK_APPLICATION']
      }
    ]);
    expect(result.candidates[0].visibilityEvidence).toEqual([]);
    expect(result.candidates[0].suitabilityEvidence).toEqual([]);
  });

  it('never projects raw capacity, raw availability, or private customer/commercial source values', async () => {
    const value = source() as ProviderDiscoverySource & Record<string, unknown>;
    value.capacityUnits = 999;
    value.availabilityUnits = 998;
    value.customerEmail = 'private-customer@example.test';
    value.quote = 'private-quote-544';
    value.margin = 'private-margin-544';
    const result = await evaluated(value);
    const serialized = JSON.stringify(result);
    for (const excluded of [
      'capacityUnits',
      'availabilityUnits',
      'private-customer@example.test',
      'private-quote-544',
      'private-margin-544'
    ])
      expect(serialized).not.toContain(excluded);
  });

  it('separates visible evidence references from artifact access', async () => {
    const result = await evaluated(source());
    if (result.status !== 'CANDIDATES') throw new Error('candidate expected');
    const candidate = result.candidates[0];
    expect(candidate.authorizedProjection.fields).toContainEqual({
      dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
      field: 'evidenceReferences',
      value: ['provider-evidence:authorized-544']
    });
    expect([...candidate.visibilityEvidence, ...candidate.suitabilityEvidence]).toSatisfy(
      (items: typeof candidate.visibilityEvidence) =>
        items.length > 0 && items.every((item) => item.artifactAccessAuthorized === false)
    );
    expect(candidate.explanation.limitations.map((item) => item.code)).toContain(
      'EVIDENCE_ARTIFACT_RETRIEVAL_NOT_AUTHORIZED'
    );
  });

  it('truthfully defaults Direct Executor to UNKNOWN regardless of Provider/Supply state', async () => {
    const result = await evaluated(source());
    if (result.status !== 'CANDIDATES') throw new Error('candidate expected');
    expect(result.candidates[0].directExecutorDisclosure).toEqual({
      state: 'UNKNOWN',
      evidenceReferences: [],
      requiresIndependentCurrentVerification: true
    });
    expect(result.candidates[0].explanation.limitations.map((item) => item.code)).toContain(
      'DIRECT_EXECUTOR_NOT_ESTABLISHED'
    );
    expect(JSON.stringify(result)).not.toMatch(/compliant direct executor|no-rebrokering proven/i);
  });

  it('produces deterministic candidate identity, candidate fingerprint, and result fingerprint', async () => {
    const value = source();
    const first = await evaluated(value);
    const second = await evaluated(structuredClone(value));
    expect(second).toEqual(first);
    if (first.status !== 'CANDIDATES' || second.status !== 'CANDIDATES')
      throw new Error('candidate expected');
    expect(second.candidates[0].providerDiscoveryCandidateId).toBe(
      first.candidates[0].providerDiscoveryCandidateId
    );
    expect(second.candidates[0].candidateFingerprintSha256).toBe(
      first.candidates[0].candidateFingerprintSha256
    );
    expect(second.resultFingerprintSha256).toBe(first.resultFingerprintSha256);
  });

  it('uses deterministic neutral Provider/Supply identifiers for ordering', async () => {
    const values = [
      source({ providerSequence: 3 }),
      source({ providerSequence: 1 }),
      source({ providerSequence: 2 })
    ];
    const result = await service({ sources: values, complete: true }).evaluate(
      principal,
      request()
    );
    if (result.status !== 'CANDIDATES') throw new Error('candidates expected');
    expect(result.candidates.map((candidate) => candidate.providerId)).toEqual([
      'provider_discovery_544_1',
      'provider_discovery_544_2',
      'provider_discovery_544_3'
    ]);
    expect(JSON.stringify(result)).not.toMatch(/score|winner|best provider|price/i);
  });

  it('asserts no candidates only after a complete successful source evaluation', async () => {
    await expect(
      service({ sources: [], complete: true }).evaluate(principal, request())
    ).resolves.toMatchObject({
      status: 'NO_AUTHORIZED_CANDIDATES',
      candidates: []
    });
    await expect(
      service({ sources: [], complete: false }).evaluate(principal, request())
    ).resolves.toMatchObject({
      status: 'AUTHORITY_UNAVAILABLE',
      candidates: []
    });
    await expect(
      service(new Error('database unavailable')).evaluate(principal, request())
    ).resolves.toMatchObject({
      status: 'AUTHORITY_UNAVAILABLE',
      candidates: []
    });
  });

  it('fails closed when a required current source version or lineage is malformed', async () => {
    await expect(
      evaluated(source({ supply: { fingerprintSha256: 'not-a-fingerprint' } }))
    ).resolves.toMatchObject({ status: 'AUTHORITY_UNAVAILABLE' });
    await expect(
      evaluated(source({ supply: { providerId: 'provider_other' } }))
    ).resolves.toMatchObject({ status: 'AUTHORITY_UNAVAILABLE' });
  });

  it('keeps every result and candidate authority consequence false', async () => {
    const candidateResult = await evaluated(source());
    const emptyResult = await service({ sources: [], complete: true }).evaluate(
      principal,
      request()
    );
    const unavailableResult = await service({ sources: [], complete: false }).evaluate(
      principal,
      request()
    );
    for (const result of [candidateResult, emptyResult, unavailableResult])
      expect(Object.values(result.authorityConsequences).every((value) => value === false)).toBe(
        true
      );
    if (candidateResult.status !== 'CANDIDATES') throw new Error('candidate expected');
    expect(
      Object.values(candidateResult.candidates[0].authorityConsequences).every(
        (value) => value === false
      )
    ).toBe(true);
  });

  it('rejects malformed request class/field combinations instead of broadening projection', async () => {
    const invalid = request({
      requestedDataClasses: ['PROVIDER_REFERENCE'],
      requestedFields: ['jurisdictions']
    });
    await expect(evaluated(source(), invalid)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
