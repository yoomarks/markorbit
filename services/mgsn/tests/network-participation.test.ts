import { describe, expect, it } from 'vitest';
import {
  noNetworkParticipationAuthorityConsequences,
  type ChangeNetworkParticipationStateCommandV1,
  type NetworkParticipationSnapshotV1,
  type OptInNetworkParticipationCommandV1,
  type ReplaceVisibilityPolicyCommandV1
} from '@markorbit/contracts/network-participation';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import {
  InMemoryNetworkParticipationRepository,
  NetworkParticipationService,
  evaluateNetworkVisibility,
  type EvaluateNetworkVisibilityInput
} from '../src/network-participation.js';
import type { ProviderRegistryRecord } from '../src/provider-registry.js';

const workspaceA = '11111111-1111-4111-8111-111111111111';
const workspaceB = '22222222-2222-4222-8222-222222222222';
const providerId = 'provider_network-440' as ProviderId;
const actorId = 'user_network-440';
const checkedAt = '2026-09-01T08:00:00.000Z';

function provider(id = providerId, workspaceId = workspaceA): ProviderRegistryRecord {
  return {
    schemaVersion: 1,
    providerId: id,
    providerWorkspaceId: workspaceId,
    displayName: 'Network Provider',
    operationalStatus: 'ACTIVE',
    version: 1,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: checkedAt,
    updatedAt: checkedAt
  };
}

function fixture() {
  const providers = new Map<ProviderId, ProviderRegistryRecord>([[providerId, provider()]]);
  const repository = new InMemoryNetworkParticipationRepository();
  let sequence = 0;
  const service = new NetworkParticipationService(
    repository,
    {
      findProviderById: (id) => Promise.resolve(providers.get(id))
    },
    () => checkedAt,
    () => `network-participation_test-${++sequence}`
  );
  return {
    repository,
    service,
    providers,
    principal: { workspaceId: workspaceA, actorId }
  };
}

function optInCommand(overrides: Partial<OptInNetworkParticipationCommandV1> = {}) {
  return {
    schemaVersion: 1,
    providerId,
    authorizationReference: 'authorization:opt-in-440',
    reason: 'Explicit network participation opt-in.',
    idempotencyKey: 'opt-in-440',
    correlationId: 'correlation_opt-in-440',
    ...overrides
  } satisfies OptInNetworkParticipationCommandV1;
}

function stateCommand(
  snapshot: Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }>,
  action: ChangeNetworkParticipationStateCommandV1['action'],
  overrides: Partial<ChangeNetworkParticipationStateCommandV1> = {}
) {
  return {
    schemaVersion: 1,
    action,
    networkParticipationId: snapshot.networkParticipationId,
    providerId,
    expectedParticipationVersion: snapshot.participationVersion,
    expectedVisibilityPolicyVersion: snapshot.visibilityPolicy.version,
    authorizationReference: `authorization:${action.toLowerCase()}-440`,
    reason: `Explicit ${action.toLowerCase()} request.`,
    idempotencyKey: `${action.toLowerCase()}-440`,
    correlationId: `correlation_${action.toLowerCase()}-440`,
    ...overrides
  } satisfies ChangeNetworkParticipationStateCommandV1;
}

function policyCommand(
  snapshot: Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }>,
  replacement: ReplaceVisibilityPolicyCommandV1['replacement'],
  overrides: Partial<ReplaceVisibilityPolicyCommandV1> = {}
) {
  return {
    schemaVersion: 1,
    networkParticipationId: snapshot.networkParticipationId,
    providerId,
    expectedParticipationVersion: snapshot.participationVersion,
    expectedVisibilityPolicyVersion: snapshot.visibilityPolicy.version,
    replacement,
    authorizationReference: 'authorization:visibility-440',
    reason: 'Explicit visibility replacement.',
    idempotencyKey: 'visibility-440',
    correlationId: 'correlation_visibility-440',
    ...overrides
  } satisfies ReplaceVisibilityPolicyCommandV1;
}

function evaluation(
  participation: NetworkParticipationSnapshotV1,
  overrides: Partial<EvaluateNetworkVisibilityInput> = {}
): EvaluateNetworkVisibilityInput {
  return {
    participation,
    authorityState: 'CURRENT',
    purpose: 'PROVIDER_DISCOVERY',
    audience: { kind: 'BOUNDED_NETWORK' },
    requestedProjection: [{ dataClass: 'PROVIDER_REFERENCE', fields: ['providerId'] }],
    checkedAt,
    ...overrides
  };
}

describe('MGSN Network Participation lifecycle', () => {
  it('normalizes an ACTIVE Provider without participation to NOT_PARTICIPATING and PRIVATE', async () => {
    const { service, principal } = fixture();
    const result = await service.read(principal, providerId);
    expect(result).toMatchObject({
      networkParticipationId: null,
      participationVersion: null,
      state: 'NOT_PARTICIPATING',
      authorizationReference: null,
      visibilityPolicy: {
        version: null,
        scope: 'PRIVATE',
        grants: [],
        authorizationReference: null
      }
    });
    expect(evaluateNetworkVisibility(evaluation(result)).authorityCheck.denialReasons).toEqual([
      'NOT_PARTICIPATING'
    ]);
  });

  it('opts in with ACTIVE v1 + explicit PRIVATE policy v1 and exact replay', async () => {
    const { service, repository, principal } = fixture();
    const command = optInCommand();
    const first = await service.optIn(principal, command);
    expect(first).toMatchObject({
      state: 'ACTIVE',
      participationVersion: 1,
      authorizationReference: command.authorizationReference,
      visibilityPolicy: {
        version: 1,
        scope: 'PRIVATE',
        grants: [],
        authorizationReference: command.authorizationReference
      }
    });
    await expect(service.optIn(principal, command)).resolves.toEqual(first);
    expect(await repository.listParticipationHistory(first.networkParticipationId!)).toHaveLength(
      1
    );
    expect(
      await repository.listVisibilityPolicyHistory(first.networkParticipationId!)
    ).toHaveLength(1);
    expect(await repository.listAuditHistory(first.networkParticipationId!)).toMatchObject([
      {
        previousParticipationState: 'NOT_PARTICIPATING',
        newParticipationState: 'ACTIVE',
        affectedDataClasses: []
      }
    ]);
    expect(Object.values(first.authorityConsequences).every((value) => !value)).toBe(true);
  });

  it('rejects changed replay payload and a second non-revoked opt-in', async () => {
    const { service, principal } = fixture();
    await service.optIn(principal, optInCommand());
    await expect(
      service.optIn(principal, optInCommand({ reason: 'Changed request.' }))
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    await expect(
      service.optIn(principal, optInCommand({ idempotencyKey: 'second-opt-in-440' }))
    ).rejects.toMatchObject({ code: 'PARTICIPATION_ALREADY_EXISTS', status: 409 });
  });

  it('atomically permits only one concurrent first opt-in for a Provider binding', async () => {
    const { service, repository, principal } = fixture();
    const attempts = await Promise.allSettled([
      service.optIn(principal, optInCommand({ idempotencyKey: 'concurrent-opt-in-a' })),
      service.optIn(
        principal,
        optInCommand({
          authorizationReference: 'authorization:concurrent-opt-in-b',
          idempotencyKey: 'concurrent-opt-in-b',
          correlationId: 'correlation_concurrent-opt-in-b'
        })
      )
    ]);
    const fulfilled = attempts.filter(
      (attempt): attempt is PromiseFulfilledResult<NetworkParticipationSnapshotV1> =>
        attempt.status === 'fulfilled'
    );
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected'
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: 'STALE_PARTICIPATION', status: 409 });

    const winner = fulfilled[0]!.value;
    expect((await service.read(principal, providerId)).networkParticipationId).toBe(
      winner.networkParticipationId
    );
    const possibleIds = ['network-participation_test-1', 'network-participation_test-2'] as const;
    const loserId = possibleIds.find((id) => id !== winner.networkParticipationId)!;
    expect(await repository.listParticipationHistory(loserId)).toEqual([]);
    expect(await repository.listVisibilityPolicyHistory(loserId)).toEqual([]);
    expect(await repository.listAuditHistory(loserId)).toEqual([]);
    const loserKey =
      attempts[0]?.status === 'rejected' ? 'concurrent-opt-in-a' : 'concurrent-opt-in-b';
    expect(
      await repository.findReplay(`network-participation:${workspaceA}:${providerId}`, loserKey)
    ).toBeUndefined();
  });

  it('pauses, resumes with exact versions, and retains the policy version', async () => {
    const { service, repository, principal } = fixture();
    const active = (await service.optIn(principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const pauseCommand = stateCommand(active, 'PAUSE');
    const paused = await service.changeState(principal, pauseCommand);
    expect(paused).toMatchObject({ state: 'PAUSED', participationVersion: 2 });
    expect(paused.visibilityPolicy.version).toBe(1);
    expect(evaluateNetworkVisibility(evaluation(paused)).authorityCheck.denialReasons).toEqual([
      'PARTICIPATION_NOT_ACTIVE'
    ]);
    await expect(service.changeState(principal, pauseCommand)).resolves.toEqual(paused);
    await expect(
      service.changeState(principal, { ...pauseCommand, reason: 'Changed pause request.' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    const resumed = await service.changeState(
      principal,
      stateCommand(
        paused as Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }>,
        'RESUME'
      )
    );
    expect(resumed).toMatchObject({ state: 'ACTIVE', participationVersion: 3 });
    expect(resumed.visibilityPolicy.version).toBe(1);
    expect(await repository.listParticipationHistory(active.networkParticipationId)).toHaveLength(
      3
    );
    expect(
      await repository.listVisibilityPolicyHistory(active.networkParticipationId)
    ).toHaveLength(1);
  });

  it.each(['ACTIVE', 'PAUSED'] as const)('revokes from %s and rejects revival', async (from) => {
    const { service, principal } = fixture();
    let current = (await service.optIn(principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    if (from === 'PAUSED')
      current = (await service.changeState(
        principal,
        stateCommand(current, 'PAUSE')
      )) as typeof current;
    const revoked = (await service.changeState(
      principal,
      stateCommand(current, 'REVOKE')
    )) as typeof current;
    expect(revoked.state).toBe('REVOKED');
    expect(evaluateNetworkVisibility(evaluation(revoked)).authorityCheck.denialReasons).toEqual([
      'PARTICIPATION_NOT_ACTIVE'
    ]);
    await expect(
      service.changeState(
        principal,
        stateCommand(revoked, 'RESUME', { idempotencyKey: `resume-revoked-${from}` })
      )
    ).rejects.toMatchObject({ code: 'PARTICIPATION_REVOKED', status: 409 });
  });

  it('rejoins after revoke with a fresh identity, PRIVATE policy, and no old grants', async () => {
    const { service, repository, principal } = fixture();
    const first = (await service.optIn(principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const visible = (await service.replaceVisibilityPolicy(
      principal,
      policyCommand(first, {
        scope: 'BOUNDED_PUBLIC',
        grants: [
          {
            dataClass: 'PROVIDER_REFERENCE',
            fields: ['providerId'],
            scope: 'BOUNDED_PUBLIC',
            audience: { kind: 'BOUNDED_NETWORK' },
            purpose: 'PROVIDER_DISCOVERY',
            authorityReferences: ['authorization:visibility-440']
          }
        ]
      })
    )) as typeof first;
    const revoked = (await service.changeState(
      principal,
      stateCommand(visible, 'REVOKE', { idempotencyKey: 'revoke-visible-440' })
    )) as typeof first;
    const rejoined = await service.optIn(
      principal,
      optInCommand({
        authorizationReference: 'authorization:fresh-rejoin-440',
        idempotencyKey: 'fresh-rejoin-440',
        correlationId: 'correlation_fresh-rejoin-440'
      })
    );
    expect(rejoined.networkParticipationId).not.toBe(revoked.networkParticipationId);
    expect(rejoined).toMatchObject({
      state: 'ACTIVE',
      participationVersion: 1,
      visibilityPolicy: { version: 1, scope: 'PRIVATE', grants: [] }
    });
    expect(await repository.listVisibilityPolicyHistory(first.networkParticipationId)).toHaveLength(
      2
    );
    await expect(
      service.changeState(
        principal,
        stateCommand(revoked, 'RESUME', { idempotencyKey: 'old-id-reuse-440' })
      )
    ).rejects.toMatchObject({ code: 'PARTICIPATION_REVOKED' });
  });

  it('atomically permits only one concurrent fresh rejoin after revocation', async () => {
    const { service, repository, principal } = fixture();
    const first = (await service.optIn(principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    await service.changeState(principal, stateCommand(first, 'REVOKE'));
    const attempts = await Promise.allSettled([
      service.optIn(
        principal,
        optInCommand({
          authorizationReference: 'authorization:concurrent-rejoin-a',
          idempotencyKey: 'concurrent-rejoin-a',
          correlationId: 'correlation_concurrent-rejoin-a'
        })
      ),
      service.optIn(
        principal,
        optInCommand({
          authorizationReference: 'authorization:concurrent-rejoin-b',
          idempotencyKey: 'concurrent-rejoin-b',
          correlationId: 'correlation_concurrent-rejoin-b'
        })
      )
    ]);
    const fulfilled = attempts.filter(
      (attempt): attempt is PromiseFulfilledResult<NetworkParticipationSnapshotV1> =>
        attempt.status === 'fulfilled'
    );
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected'
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: 'STALE_PARTICIPATION', status: 409 });

    const winner = fulfilled[0]!.value;
    expect((await service.read(principal, providerId)).networkParticipationId).toBe(
      winner.networkParticipationId
    );
    const possibleIds = ['network-participation_test-2', 'network-participation_test-3'] as const;
    const loserId = possibleIds.find((id) => id !== winner.networkParticipationId)!;
    expect(await repository.listParticipationHistory(loserId)).toEqual([]);
    expect(await repository.listVisibilityPolicyHistory(loserId)).toEqual([]);
    expect(await repository.listAuditHistory(loserId)).toEqual([]);
    const loserKey =
      attempts[0]?.status === 'rejected' ? 'concurrent-rejoin-a' : 'concurrent-rejoin-b';
    expect(
      await repository.findReplay(`network-participation:${workspaceA}:${providerId}`, loserKey)
    ).toBeUndefined();
  });

  it('rejects stale participation and policy versions without retrying', async () => {
    const { service, principal } = fixture();
    const active = (await service.optIn(principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    await expect(
      service.changeState(
        principal,
        stateCommand(active, 'PAUSE', { expectedParticipationVersion: 99 })
      )
    ).rejects.toMatchObject({ code: 'STALE_PARTICIPATION', status: 409 });
    await expect(
      service.changeState(
        principal,
        stateCommand(active, 'PAUSE', {
          expectedVisibilityPolicyVersion: 99,
          idempotencyKey: 'stale-policy-440'
        })
      )
    ).rejects.toMatchObject({ code: 'STALE_VISIBILITY_POLICY', status: 409 });
  });

  it('enforces trusted Provider/Workspace binding before revealing participation', async () => {
    const { service, principal } = fixture();
    await expect(
      service.optIn({ ...principal, workspaceId: workspaceB }, optInCommand())
    ).rejects.toMatchObject({ code: 'PROVIDER_WORKSPACE_MISMATCH', status: 403 });
    await expect(
      service.optIn(principal, optInCommand({ providerId: 'provider_missing-440' }))
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_FOUND', status: 404 });
  });
});

describe('MGSN Visibility V1 evaluator', () => {
  async function visibleFixtures() {
    const value = fixture();
    const active = (await value.service.optIn(value.principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const bounded = (await value.service.replaceVisibilityPolicy(
      value.principal,
      policyCommand(active, {
        scope: 'BOUNDED_PUBLIC',
        grants: [
          {
            dataClass: 'PROVIDER_REFERENCE',
            fields: ['providerId'],
            scope: 'BOUNDED_PUBLIC',
            audience: { kind: 'BOUNDED_NETWORK' },
            purpose: 'PROVIDER_DISCOVERY',
            authorityReferences: ['authorization:bounded-440']
          },
          {
            dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
            fields: ['evidenceReferences'],
            scope: 'BOUNDED_PUBLIC',
            audience: { kind: 'BOUNDED_NETWORK' },
            purpose: 'PROVIDER_DISCOVERY',
            authorityReferences: ['authorization:bounded-440']
          }
        ]
      })
    )) as typeof active;
    return { ...value, active, bounded };
  }

  it('denies PRIVATE and every non-current authority state with canonical reasons', async () => {
    const { active, bounded } = await visibleFixtures();
    expect(evaluateNetworkVisibility(evaluation(active)).authorityCheck.denialReasons).toEqual([
      'PRIVATE_SCOPE'
    ]);
    for (const [authorityState, reason] of [
      ['STALE', 'STALE_POLICY'],
      ['AMBIGUOUS', 'AMBIGUOUS_POLICY'],
      ['UNAVAILABLE', 'AUTHORITY_UNAVAILABLE']
    ] as const) {
      expect(
        evaluateNetworkVisibility(evaluation(bounded, { authorityState })).authorityCheck
          .denialReasons
      ).toEqual([reason]);
    }
  });

  it('allows only the exact bounded-network field intersection', async () => {
    const { bounded } = await visibleFixtures();
    const result = evaluateNetworkVisibility(
      evaluation(bounded, {
        requestedProjection: [
          { dataClass: 'PROVIDER_EVIDENCE_REFERENCE', fields: ['evidenceReferences'] },
          { dataClass: 'PROVIDER_REFERENCE', fields: ['providerId'] }
        ]
      })
    );
    expect(result.authorityCheck).toMatchObject({
      decision: 'ALLOW',
      denialReasons: [],
      authorityConsequences: noNetworkParticipationAuthorityConsequences
    });
    expect(result.authorizedProjection).toEqual({
      dataClasses: ['PROVIDER_EVIDENCE_REFERENCE', 'PROVIDER_REFERENCE'],
      fields: [
        { dataClass: 'PROVIDER_EVIDENCE_REFERENCE', fields: ['evidenceReferences'] },
        { dataClass: 'PROVIDER_REFERENCE', fields: ['providerId'] }
      ]
    });
    expect(result).not.toHaveProperty('provider');
    expect(JSON.stringify(result)).not.toContain('artifact');
  });

  it.each([
    [
      'unknown data class',
      [{ dataClass: 'APPLICANT_OWNER_OFFICIAL_DATA', fields: ['applicant'] }],
      'DATA_CLASS_NOT_AUTHORIZED'
    ],
    [
      'end-client identity',
      [{ dataClass: 'END_CLIENT_RELATIONSHIP', fields: ['email', 'phone'] }],
      'DATA_CLASS_NOT_AUTHORIZED'
    ],
    [
      'commercial data',
      [{ dataClass: 'PROVIDER_REFERENCE', fields: ['pricing', 'margin', 'profit'] }],
      'FIELD_NOT_AUTHORIZED'
    ],
    [
      'raw capacity',
      [{ dataClass: 'SUPPLY_PROFILE', fields: ['capacityUnits'] }],
      'FIELD_NOT_AUTHORIZED'
    ],
    [
      'raw availability',
      [{ dataClass: 'SUPPLY_PROFILE', fields: ['availabilityUnits'] }],
      'FIELD_NOT_AUTHORIZED'
    ],
    [
      'raw evidence artifact',
      [{ dataClass: 'PROVIDER_EVIDENCE_REFERENCE', fields: ['artifact'] }],
      'FIELD_NOT_AUTHORIZED'
    ],
    [
      'ungranted class',
      [{ dataClass: 'ORGANIZATION_IDENTITY', fields: ['displayName'] }],
      'DATA_CLASS_NOT_AUTHORIZED'
    ],
    [
      'ungranted field',
      [{ dataClass: 'PROVIDER_REFERENCE', fields: ['displayName'] }],
      'FIELD_NOT_AUTHORIZED'
    ]
  ])('denies protected or ungranted projection: %s', async (_name, requestedProjection, reason) => {
    const { bounded } = await visibleFixtures();
    const result = evaluateNetworkVisibility(evaluation(bounded, { requestedProjection }));
    expect(result.authorityCheck).toMatchObject({ decision: 'DENY', denialReasons: [reason] });
    expect(result.authorizedProjection).toEqual({ dataClasses: [], fields: [] });
  });

  it('denies wrong purpose and audience without a permissive fallback', async () => {
    const { bounded } = await visibleFixtures();
    expect(
      evaluateNetworkVisibility(evaluation(bounded, { purpose: 'COLLABORATION' })).authorityCheck
        .denialReasons
    ).toEqual(['PURPOSE_NOT_AUTHORIZED']);
    expect(
      evaluateNetworkVisibility(
        evaluation(bounded, {
          audience: {
            kind: 'TRUSTED_RELATIONSHIP',
            relationshipAuthorityReference: 'relationship:wrong-440'
          }
        })
      ).authorityCheck.denialReasons
    ).toEqual(['AUDIENCE_NOT_AUTHORIZED']);
  });

  it('requires exact current trusted relationship authority and minimizes its projection', async () => {
    const value = fixture();
    const active = (await value.service.optIn(value.principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const trusted = await value.service.replaceVisibilityPolicy(
      value.principal,
      policyCommand(active, {
        scope: 'TRUSTED',
        grants: [
          {
            dataClass: 'SUPPLY_PROFILE',
            fields: ['serviceTypes'],
            scope: 'TRUSTED',
            audience: {
              kind: 'TRUSTED_RELATIONSHIP',
              relationshipAuthorityReference: 'relationship:current-440'
            },
            purpose: 'PROVIDER_DISCOVERY',
            authorityReferences: ['authorization:trusted-440']
          }
        ]
      })
    );
    const trustedRequest = {
      audience: {
        kind: 'TRUSTED_RELATIONSHIP' as const,
        relationshipAuthorityReference: 'relationship:current-440'
      },
      requestedProjection: [{ dataClass: 'SUPPLY_PROFILE', fields: ['serviceTypes'] }]
    };
    expect(
      evaluateNetworkVisibility(evaluation(trusted, trustedRequest)).authorityCheck.denialReasons
    ).toEqual(['AUDIENCE_NOT_AUTHORIZED']);
    expect(
      evaluateNetworkVisibility(
        evaluation(trusted, {
          ...trustedRequest,
          currentRelationshipAuthority: {
            state: 'CURRENT',
            relationshipAuthorityReference: 'relationship:wrong-440'
          }
        })
      ).authorityCheck.denialReasons
    ).toEqual(['AUDIENCE_NOT_AUTHORIZED']);
    const allowed = evaluateNetworkVisibility(
      evaluation(trusted, {
        ...trustedRequest,
        currentRelationshipAuthority: {
          state: 'CURRENT',
          relationshipAuthorityReference: 'relationship:current-440'
        }
      })
    );
    expect(allowed.authorityCheck.decision).toBe('ALLOW');
    expect(allowed.authorizedProjection).toEqual({
      dataClasses: ['SUPPLY_PROFILE'],
      fields: [{ dataClass: 'SUPPLY_PROFILE', fields: ['serviceTypes'] }]
    });
  });

  it('makes a current PRIVATE contraction defeat a historical public policy', async () => {
    const { service, repository, principal, bounded } = await visibleFixtures();
    expect(evaluateNetworkVisibility(evaluation(bounded)).authorityCheck.decision).toBe('ALLOW');
    const contracted = await service.replaceVisibilityPolicy(
      principal,
      policyCommand(
        bounded,
        { scope: 'PRIVATE', grants: [] },
        { idempotencyKey: 'visibility-private-440', correlationId: 'correlation_private-440' }
      )
    );
    expect(contracted.participationVersion).toBe(bounded.participationVersion);
    expect(contracted.visibilityPolicy.version).toBe(3);
    expect(evaluateNetworkVisibility(evaluation(contracted)).authorityCheck.denialReasons).toEqual([
      'PRIVATE_SCOPE'
    ]);
    const history = await repository.listVisibilityPolicyHistory(bounded.networkParticipationId);
    expect(history.map((policy) => policy.scope)).toEqual(['PRIVATE', 'BOUNDED_PUBLIC', 'PRIVATE']);
    expect(await repository.listParticipationHistory(bounded.networkParticipationId)).toHaveLength(
      1
    );
  });

  it('replays an exact policy replacement and rejects a changed payload under the same key', async () => {
    const value = fixture();
    const active = (await value.service.optIn(value.principal, optInCommand())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const command = policyCommand(active, {
      scope: 'BOUNDED_PUBLIC',
      grants: [
        {
          dataClass: 'PROVIDER_REFERENCE',
          fields: ['providerId'],
          scope: 'BOUNDED_PUBLIC',
          audience: { kind: 'BOUNDED_NETWORK' },
          purpose: 'PROVIDER_DISCOVERY',
          authorityReferences: ['authorization:bounded-replay-440']
        }
      ]
    });
    const first = await value.service.replaceVisibilityPolicy(value.principal, command);
    await expect(value.service.replaceVisibilityPolicy(value.principal, command)).resolves.toEqual(
      first
    );
    await expect(
      value.service.replaceVisibilityPolicy(value.principal, {
        ...command,
        authorizationReference: 'authorization:changed-440'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('rejects invalid broad grants instead of normalizing them into permission', async () => {
    const { service, principal, active } = await visibleFixtures();
    await expect(
      service.replaceVisibilityPolicy(
        principal,
        policyCommand(active, {
          scope: 'BOUNDED_PUBLIC',
          grants: [
            {
              dataClass: 'SUPPLY_PROFILE',
              fields: ['capacityUnits'],
              scope: 'BOUNDED_PUBLIC',
              audience: { kind: 'BOUNDED_NETWORK' },
              purpose: 'PROVIDER_DISCOVERY',
              authorityReferences: ['authorization:invalid-440']
            }
          ]
        } as unknown as ReplaceVisibilityPolicyCommandV1['replacement'])
      )
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 422 });
  });
});
