import { describe, expect, it, vi } from 'vitest';
import {
  noDownstreamProviderSelectionAuthorityConsequences,
  providerSelectionContractFixtureV1,
  type CreateOrReplaceProviderSelectionCommandV1,
  type ProviderSelectionId,
  type ProviderSelectionValidationDenialReason,
  type RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';
import {
  InMemoryProviderSelectionRepository,
  ProviderSelectionError,
  ProviderSelectionService,
  type ProviderSelectionCurrentAuthoritySnapshot,
  type ProviderSelectionCurrentAuthoritySource,
  type ProviderSelectionPrincipal
} from '../src/provider-selection.js';

const fixture = providerSelectionContractFixtureV1;
const at = '2026-09-02T06:00:00.000Z';

function principal(
  overrides: Partial<ProviderSelectionPrincipal> = {}
): ProviderSelectionPrincipal {
  const authority = fixture.createCommand.trustedHumanAuthority;
  return {
    workspaceId: authority.requesterWorkspaceId,
    actorId: authority.selectingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: authority.principalReference,
    workspaceMembershipReference: authority.workspaceMembershipReference,
    selectionAuthorityReference: authority.selectionAuthorityReference,
    selectionAuthorityVersion: authority.selectionAuthorityVersion,
    authenticatedAt: authority.authenticatedAt,
    affirmativeHumanActionEvidenceReference: authority.affirmativeHumanActionEvidenceReference,
    ...overrides
  };
}

function currentSnapshot(
  overrides: Partial<ProviderSelectionCurrentAuthoritySnapshot> = {}
): ProviderSelectionCurrentAuthoritySnapshot {
  const base: ProviderSelectionCurrentAuthoritySnapshot = {
    authorityAvailable: true,
    requesterAuthorityCurrent: true,
    actorAuthorityCurrent: true,
    candidateCurrent: true,
    participationActive: true,
    visibilityAuthorized: true,
    trustedRelationshipRequired: false,
    trustedRelationshipCurrent: true,
    providerOperational: true,
    supplyCurrent: true,
    directExecutorEstablished: true,
    sourceVersionsMatch: true,
    checkedAuthorityReferences: [
      fixture.currentSelection.sourceLineage.visibilityAuthorizationAtReview.networkParticipationId,
      fixture.currentSelection.sourceLineage.provider.providerId,
      fixture.currentSelection.sourceLineage.providerSupplyCapability.id
    ]
  };
  return { ...base, ...overrides };
}

function authorityEvaluator(
  value: ProviderSelectionCurrentAuthoritySnapshot | Error = currentSnapshot()
) {
  return vi.fn(() => {
    if (value instanceof Error) {
      return Promise.reject(value);
    }
    return Promise.resolve(value);
  });
}

function authoritySource(
  value: ProviderSelectionCurrentAuthoritySnapshot | Error = currentSnapshot()
): ProviderSelectionCurrentAuthoritySource {
  return { evaluateCurrentAuthority: authorityEvaluator(value) };
}

function createCommand(
  overrides: Partial<CreateOrReplaceProviderSelectionCommandV1> = {}
): CreateOrReplaceProviderSelectionCommandV1 {
  return {
    ...structuredClone(fixture.createCommand),
    ...overrides
  };
}

function replacementCommand(
  current: Awaited<ReturnType<ProviderSelectionService['createOrReplace']>>
): CreateOrReplaceProviderSelectionCommandV1 {
  const base = fixture.createCommand;
  const candidateId =
    'provider-discovery-candidate_selection-replacement' as typeof base.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId;
  const candidateFingerprintSha256 = '8'.repeat(64);
  return {
    ...structuredClone(base),
    sourceLineage: {
      ...structuredClone(base.sourceLineage),
      discoveryCandidate: {
        ...structuredClone(base.sourceLineage.discoveryCandidate),
        providerDiscoveryCandidateId: candidateId,
        candidateFingerprintSha256
      }
    },
    acknowledgement: {
      ...structuredClone(base.acknowledgement),
      reviewedCandidateId: candidateId,
      reviewedCandidateFingerprintSha256: candidateFingerprintSha256
    },
    expectedCurrent: {
      kind: 'EXACT',
      providerSelectionId: current.selection.providerSelectionId,
      version: current.selection.version,
      expectedScopeVersion: current.selection.scopeVersion
    },
    idempotencyKey: 'provider-selection:replace:test',
    commandFingerprintSha256: 'c'.repeat(64),
    correlationId: 'correlation_selection_replace_test'
  };
}

function revokeCommand(
  current: Awaited<ReturnType<ProviderSelectionService['createOrReplace']>>
): RevokeProviderSelectionCommandV1 {
  return {
    ...structuredClone(fixture.revokeCommand),
    target: {
      providerSelectionId: current.selection.providerSelectionId,
      version: current.selection.version,
      scopeVersion: current.selection.scopeVersion
    },
    idempotencyKey: 'provider-selection:revoke:test',
    commandFingerprintSha256: 'd'.repeat(64),
    correlationId: 'correlation_selection_revoke_test'
  };
}

function harness(value: ProviderSelectionCurrentAuthoritySnapshot | Error = currentSnapshot()) {
  const repository = new InMemoryProviderSelectionRepository();
  const evaluateCurrentAuthority = authorityEvaluator(value);
  const source: ProviderSelectionCurrentAuthoritySource = { evaluateCurrentAuthority };
  let sequence = 0;
  const service = new ProviderSelectionService(
    repository,
    source,
    () => at,
    () => `provider-selection_test-${++sequence}` as ProviderSelectionId
  );
  return { repository, service, evaluateCurrentAuthority };
}

async function createCurrent(
  service: ProviderSelectionService
): Promise<Awaited<ReturnType<ProviderSelectionService['createOrReplace']>>> {
  return service.createOrReplace(principal(), createCommand());
}

function expectSelectionError(
  error: unknown,
  code: ProviderSelectionError['code'],
  denialReason?: ProviderSelectionValidationDenialReason
): void {
  expect(error).toBeInstanceOf(ProviderSelectionError);
  expect(error).toMatchObject({
    code,
    ...(denialReason ? { denialReason } : {})
  });
}

describe('MGSN Human Provider Selection V1 Phase A', () => {
  it('creates one explicit human Selection with no downstream authority', async () => {
    const { service } = harness();
    const result = await createCurrent(service);

    expect(result).toMatchObject({ mutation: 'CREATED', replayed: false });
    expect(result.selection).toMatchObject({
      status: 'CURRENT',
      version: 1,
      scopeVersion: 1,
      requesterWorkspaceId: fixture.createCommand.requesterWorkspaceId,
      authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences
    });
    expect(result.selection.sourceLineage.discoveryCandidate).toEqual(
      fixture.createCommand.sourceLineage.discoveryCandidate
    );
    expect(result.selection.authorityConsequences).toEqual(
      noDownstreamProviderSelectionAuthorityConsequences
    );
  });

  it.each(['SYSTEM', 'AI_AGENT'] as const)(
    'rejects %s callers because Selection requires human action',
    async (actorKind) => {
      const { service, evaluateCurrentAuthority } = harness();

      await expect(
        service.createOrReplace(principal({ actorKind }), createCommand())
      ).rejects.toMatchObject({ code: 'HUMAN_ACTION_REQUIRED', status: 403 });
      expect(evaluateCurrentAuthority).not.toHaveBeenCalled();
    }
  );

  it('rejects a wrong trusted Workspace before reading current authority', async () => {
    const { service, evaluateCurrentAuthority } = harness();

    await expect(
      service.createOrReplace(
        principal({ workspaceId: '018f0000-0000-7000-8000-000000000999' }),
        createCommand()
      )
    ).rejects.toMatchObject({ code: 'REQUESTER_WORKSPACE_MISMATCH', status: 403 });
    expect(evaluateCurrentAuthority).not.toHaveBeenCalled();
  });

  it('rejects selecting actor and trusted authority mismatches', async () => {
    const { service, evaluateCurrentAuthority } = harness();

    await expect(
      service.createOrReplace(principal({ actorId: 'user_spoofed' }), createCommand())
    ).rejects.toMatchObject({ code: 'SELECTING_ACTOR_MISMATCH', status: 403 });
    await expect(
      service.createOrReplace(
        principal({ selectionAuthorityReference: 'selection-authority:spoofed' }),
        createCommand()
      )
    ).rejects.toMatchObject({ code: 'SELECTING_ACTOR_MISMATCH', status: 403 });
    expect(evaluateCurrentAuthority).not.toHaveBeenCalled();
  });

  it('rejects non-affirmative or mismatched human acknowledgement at runtime', async () => {
    const { service } = harness();
    const nonAffirmative = {
      ...createCommand(),
      acknowledgement: {
        ...structuredClone(fixture.createCommand.acknowledgement),
        affirmativeHumanAction: false
      }
    } as unknown as CreateOrReplaceProviderSelectionCommandV1;
    const mismatchedCandidate = createCommand({
      acknowledgement: {
        ...structuredClone(fixture.createCommand.acknowledgement),
        reviewedCandidateFingerprintSha256: '9'.repeat(64)
      }
    });

    await expect(service.createOrReplace(principal(), nonAffirmative)).rejects.toMatchObject({
      code: 'HUMAN_ACTION_REQUIRED'
    });
    await expect(service.createOrReplace(principal(), mismatchedCandidate)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
  });

  it('rejects protected-data acknowledgement flags and mismatched reviewed scope', async () => {
    const { service } = harness();
    const protectedData = {
      ...createCommand(),
      acknowledgement: {
        ...structuredClone(fixture.createCommand.acknowledgement),
        containsCustomerDocuments: true
      }
    } as unknown as CreateOrReplaceProviderSelectionCommandV1;
    const wrongScopeReview = createCommand({
      acknowledgement: {
        ...structuredClone(fixture.createCommand.acknowledgement),
        reviewedScopeFingerprintSha256: '9'.repeat(64)
      }
    });

    await expect(service.createOrReplace(principal(), protectedData)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    await expect(service.createOrReplace(principal(), wrongScopeReview)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
  });

  it('requires exact Discovery Need lineage for the Selection scope', async () => {
    const { service } = harness();
    const command = createCommand({
      sourceLineage: {
        ...structuredClone(fixture.createCommand.sourceLineage),
        discoveryRequest: {
          ...structuredClone(fixture.createCommand.sourceLineage.discoveryRequest),
          needFingerprintSha256: '9'.repeat(64)
        }
      }
    });

    await expect(service.createOrReplace(principal(), command)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
  });

  it('fails Selection commit closed when current authority is unavailable', async () => {
    const { service } = harness(new Error('current source unavailable'));

    await expect(service.createOrReplace(principal(), createCommand())).rejects.toMatchObject({
      code: 'AUTHORITY_UNAVAILABLE',
      status: 503,
      denialReason: 'AUTHORITY_UNAVAILABLE'
    });
  });

  const currentDenials: ReadonlyArray<{
    name: string;
    denial: ProviderSelectionValidationDenialReason;
    snapshot: Partial<ProviderSelectionCurrentAuthoritySnapshot>;
  }> = [
    {
      name: 'requester authority',
      denial: 'REQUESTER_AUTHORITY_NOT_CURRENT',
      snapshot: { requesterAuthorityCurrent: false }
    },
    {
      name: 'actor authority',
      denial: 'ACTOR_AUTHORITY_NOT_CURRENT',
      snapshot: { actorAuthorityCurrent: false }
    },
    {
      name: 'candidate currentness',
      denial: 'STALE_CANDIDATE',
      snapshot: { candidateCurrent: false }
    },
    {
      name: 'network participation',
      denial: 'PARTICIPATION_NOT_ACTIVE',
      snapshot: { participationActive: false }
    },
    {
      name: 'visibility authority',
      denial: 'VISIBILITY_NO_LONGER_AUTHORIZED',
      snapshot: { visibilityAuthorized: false }
    },
    {
      name: 'trusted relationship authority',
      denial: 'TRUSTED_RELATIONSHIP_NOT_CURRENT',
      snapshot: {
        trustedRelationshipRequired: true,
        trustedRelationshipCurrent: false
      }
    },
    {
      name: 'Provider operational state',
      denial: 'PROVIDER_NOT_OPERATIONAL',
      snapshot: { providerOperational: false }
    },
    {
      name: 'Supply Capability currentness',
      denial: 'SUPPLY_NOT_CURRENT',
      snapshot: { supplyCurrent: false }
    },
    {
      name: 'Direct Executor authority',
      denial: 'DIRECT_EXECUTOR_NOT_ESTABLISHED',
      snapshot: { directExecutorEstablished: false }
    },
    {
      name: 'source version exactness',
      denial: 'SOURCE_VERSION_MISMATCH',
      snapshot: { sourceVersionsMatch: false }
    }
  ];

  it.each(currentDenials)(
    'fails Selection commit closed when $name is not current',
    async ({ denial, snapshot }) => {
      const { service } = harness(currentSnapshot(snapshot));

      try {
        await service.createOrReplace(principal(), createCommand());
        throw new Error('expected Selection commit to fail');
      } catch (error) {
        expectSelectionError(error, 'CURRENT_AUTHORITY_DENIED', denial);
      }
    }
  );

  it('conflicts when ABSENT is used after a current Selection exists', async () => {
    const { service } = harness();
    await createCurrent(service);
    const second = createCommand({
      idempotencyKey: 'provider-selection:create:second',
      commandFingerprintSha256: 'b'.repeat(64),
      correlationId: 'correlation_selection_second'
    });

    await expect(service.createOrReplace(principal(), second)).rejects.toMatchObject({
      code: 'STALE_SELECTION',
      status: 409
    });
  });

  it('requires exact current id, version and scopeVersion for replacement', async () => {
    const { service } = harness();
    const current = await createCurrent(service);
    const replacement = replacementCommand(current);
    const stale = {
      ...replacement,
      expectedCurrent: {
        ...replacement.expectedCurrent,
        expectedScopeVersion: current.selection.scopeVersion + 1
      }
    } as CreateOrReplaceProviderSelectionCommandV1;

    await expect(service.createOrReplace(principal(), stale)).rejects.toMatchObject({
      code: 'STALE_SELECTION',
      status: 409
    });
  });

  it('atomically supersedes the old Selection and installs one fresh current Selection', async () => {
    const { repository, service } = harness();
    const current = await createCurrent(service);
    const replaced = await service.createOrReplace(principal(), replacementCommand(current));
    const oldHistory = await repository.listSelectionHistory(current.selection.providerSelectionId);

    expect(replaced).toMatchObject({ mutation: 'REPLACED', replayed: false });
    expect(replaced.selection).toMatchObject({
      status: 'CURRENT',
      version: 1,
      scopeVersion: 2
    });
    expect(replaced.selection.providerSelectionId).not.toBe(current.selection.providerSelectionId);
    expect(oldHistory.at(-1)).toMatchObject({
      status: 'SUPERSEDED',
      version: 2,
      scopeVersion: 2,
      supersededBy: {
        providerSelectionId: replaced.selection.providerSelectionId,
        version: 1,
        scopeVersion: 2
      }
    });
  });

  it('revokes the exact current Selection without positive candidate revalidation', async () => {
    const { repository, service, evaluateCurrentAuthority } = harness();
    const current = await createCurrent(service);
    evaluateCurrentAuthority.mockRejectedValue(
      new Error('candidate source unavailable after human withdrawal')
    );

    const revoked = await service.revoke(principal(), revokeCommand(current));
    const state = await repository.findScopeState(
      [
        'provider-selection',
        fixture.createCommand.requesterWorkspaceId,
        fixture.createCommand.scope.owner,
        encodeURIComponent(fixture.createCommand.scope.reference)
      ].join(':')
    );

    expect(revoked.selection).toMatchObject({
      status: 'REVOKED',
      version: 2,
      scopeVersion: 2,
      revocationReasonCode: 'HUMAN_WITHDRAWAL'
    });
    expect(state).toEqual({ scopeVersion: 2 });
    expect(evaluateCurrentAuthority).toHaveBeenCalledTimes(1);
  });

  it('replays the exact historical mutation without re-establishing current usability', async () => {
    const { service, evaluateCurrentAuthority } = harness();
    const created = await createCurrent(service);
    const replayed = await service.createOrReplace(principal(), createCommand());

    expect(replayed.selection).toEqual(created.selection);
    expect(replayed.replayed).toBe(true);
    expect(replayed.replayDoesNotEstablishCurrentUsability).toBe(true);
    expect(evaluateCurrentAuthority).toHaveBeenCalledTimes(1);
  });

  it('conflicts when an idempotency key is reused with a different effective fingerprint', async () => {
    const { service } = harness();
    await createCurrent(service);
    const changed = createCommand({ commandFingerprintSha256: 'b'.repeat(64) });

    await expect(service.createOrReplace(principal(), changed)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });
  });

  it('does not permit historical replay under a different trusted principal', async () => {
    const { service } = harness();
    await createCurrent(service);

    await expect(
      service.createOrReplace(principal({ actorId: 'user_other' }), createCommand())
    ).rejects.toMatchObject({ code: 'SELECTING_ACTOR_MISMATCH', status: 403 });
  });

  it('keeps CURRENT lifecycle separate from current usability', async () => {
    const { service } = harness(currentSnapshot({ visibilityAuthorized: false }));
    const created = await createCurrent(
      new ProviderSelectionService(
        new InMemoryProviderSelectionRepository(),
        authoritySource(currentSnapshot()),
        () => at,
        () => 'provider-selection_lifecycle-test'
      )
    );
    const validationRepository = new InMemoryProviderSelectionRepository();
    const seedService = new ProviderSelectionService(
      validationRepository,
      authoritySource(currentSnapshot()),
      () => at,
      () => created.selection.providerSelectionId
    );
    const seeded = await seedService.createOrReplace(principal(), createCommand());
    const validationService = new ProviderSelectionService(
      validationRepository,
      authoritySource(currentSnapshot({ visibilityAuthorized: false })),
      () => at
    );

    const validation = await validationService.validateCurrent(principal(), {
      scope: seeded.selection.scope,
      providerSelectionId: seeded.selection.providerSelectionId,
      purpose: 'CONTROLLED_HANDOFF_REVIEW'
    });

    expect(validation).toMatchObject({
      decision: 'DENY',
      currentlyUsable: false,
      denialReason: 'VISIBILITY_NO_LONGER_AUTHORIZED'
    });
    expect(service).toBeDefined();
  });

  it('returns currently usable only when every bounded current source is positive', async () => {
    const { service } = harness();
    const created = await createCurrent(service);

    const validation = await service.validateCurrent(principal(), {
      scope: created.selection.scope,
      providerSelectionId: created.selection.providerSelectionId,
      purpose: 'CONTROLLED_HANDOFF_REVIEW'
    });

    expect(validation).toMatchObject({
      decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
      currentlyUsable: true,
      validationDoesNotAuthorizeDownstreamAction: true,
      authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences
    });
  });

  it('denies a superseded Selection even when all current provider facts are positive', async () => {
    const { service } = harness();
    const current = await createCurrent(service);
    await service.createOrReplace(principal(), replacementCommand(current));

    const validation = await service.validateCurrent(principal(), {
      scope: current.selection.scope,
      providerSelectionId: current.selection.providerSelectionId,
      purpose: 'CONTROLLED_HANDOFF_REVIEW'
    });

    expect(validation).toMatchObject({
      decision: 'DENY',
      denialReason: 'SELECTION_SUPERSEDED'
    });
  });

  it('denies a revoked Selection and replay cannot revive it', async () => {
    const { service } = harness();
    const current = await createCurrent(service);
    await service.revoke(principal(), revokeCommand(current));
    const replayedCreate = await service.createOrReplace(principal(), createCommand());
    const validation = await service.validateCurrent(principal(), {
      scope: current.selection.scope,
      providerSelectionId: current.selection.providerSelectionId,
      purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
    });

    expect(replayedCreate.replayed).toBe(true);
    expect(replayedCreate.selection.status).toBe('CURRENT');
    expect(validation).toMatchObject({
      decision: 'DENY',
      denialReason: 'SELECTION_REVOKED'
    });
  });

  it('fails validation closed when the current authority source throws', async () => {
    const repository = new InMemoryProviderSelectionRepository();
    const seed = new ProviderSelectionService(
      repository,
      authoritySource(currentSnapshot()),
      () => at,
      () => 'provider-selection_authority-outage'
    );
    const created = await seed.createOrReplace(principal(), createCommand());
    const service = new ProviderSelectionService(
      repository,
      authoritySource(new Error('outage')),
      () => at
    );

    const validation = await service.validateCurrent(principal(), {
      scope: created.selection.scope,
      providerSelectionId: created.selection.providerSelectionId,
      purpose: 'CONTROLLED_HANDOFF_REVIEW'
    });

    expect(validation).toMatchObject({
      decision: 'DENY',
      denialReason: 'AUTHORITY_UNAVAILABLE'
    });
  });

  it('does not disclose another Workspace Selection through current validation', async () => {
    const { service, evaluateCurrentAuthority } = harness();
    const created = await createCurrent(service);
    const callsBefore = evaluateCurrentAuthority.mock.calls.length;

    await expect(
      service.validateCurrent(
        { workspaceId: '018f0000-0000-7000-8000-000000000999' },
        {
          scope: created.selection.scope,
          providerSelectionId: created.selection.providerSelectionId,
          purpose: 'CONTROLLED_HANDOFF_REVIEW'
        }
      )
    ).rejects.toMatchObject({ code: 'SELECTION_NOT_FOUND', status: 404 });
    expect(evaluateCurrentAuthority).toHaveBeenCalledTimes(callsBefore);
  });

  it('does not let Provider operational or Supply currentness substitute for Direct Executor', async () => {
    const repository = new InMemoryProviderSelectionRepository();
    const seed = new ProviderSelectionService(
      repository,
      authoritySource(currentSnapshot()),
      () => at,
      () => 'provider-selection_direct-executor'
    );
    const created = await seed.createOrReplace(principal(), createCommand());
    const service = new ProviderSelectionService(
      repository,
      authoritySource(
        currentSnapshot({
          providerOperational: true,
          supplyCurrent: true,
          directExecutorEstablished: false
        })
      ),
      () => at
    );

    const validation = await service.validateCurrent(principal(), {
      scope: created.selection.scope,
      providerSelectionId: created.selection.providerSelectionId,
      purpose: 'SELECTION_COMMIT'
    });

    expect(validation).toMatchObject({
      decision: 'DENY',
      denialReason: 'DIRECT_EXECUTOR_NOT_ESTABLISHED'
    });
  });

  it('keeps replay and audit records privacy-safe and bounded', async () => {
    const { repository, service } = harness();
    const created = await createCurrent(service);
    const key = [
      'provider-selection',
      fixture.createCommand.requesterWorkspaceId,
      fixture.createCommand.scope.owner,
      encodeURIComponent(fixture.createCommand.scope.reference)
    ].join(':');
    const audit = await repository.listAuditHistory(key);
    const history = await repository.listSelectionHistory(created.selection.providerSelectionId);
    const serialized = JSON.stringify({ audit, history });

    expect(serialized).not.toContain('customerEmail');
    expect(serialized).not.toContain('customerPhone');
    expect(serialized).not.toContain('rawEvidence');
    expect(serialized).not.toContain('margin');
    expect(serialized).not.toContain('profit');
    expect(serialized).not.toContain('providerAllocated":true');
    expect(serialized).not.toContain('providerEngaged":true');
  });

  it('serializes concurrent ABSENT creates so at most one becomes current', async () => {
    const { repository, service } = harness();
    const second = createCommand({
      idempotencyKey: 'provider-selection:create:concurrent-2',
      commandFingerprintSha256: 'b'.repeat(64),
      correlationId: 'correlation_selection_concurrent_2'
    });
    const results = await Promise.allSettled([
      service.createOrReplace(principal(), createCommand()),
      service.createOrReplace(principal(), second)
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const key = [
      'provider-selection',
      fixture.createCommand.requesterWorkspaceId,
      fixture.createCommand.scope.owner,
      encodeURIComponent(fixture.createCommand.scope.reference)
    ].join(':');
    const state = await repository.findScopeState(key);

    expect(fulfilled).toHaveLength(1);
    expect(state.current?.status).toBe('CURRENT');
    expect(state.scopeVersion).toBe(1);
  });

  it('supports a fresh explicit Selection after revoke without reviving the old identity', async () => {
    const { service } = harness();
    const current = await createCurrent(service);
    const revoked = await service.revoke(principal(), revokeCommand(current));
    const rejoin = createCommand({
      expectedCurrent: {
        kind: 'ABSENT',
        expectedScopeVersion: revoked.selection.scopeVersion
      },
      idempotencyKey: 'provider-selection:create:after-revoke',
      commandFingerprintSha256: 'e'.repeat(64),
      correlationId: 'correlation_selection_after_revoke'
    });

    const recreated = await service.createOrReplace(principal(), rejoin);

    expect(recreated.selection.providerSelectionId).not.toBe(current.selection.providerSelectionId);
    expect(recreated.selection).toMatchObject({
      status: 'CURRENT',
      version: 1,
      scopeVersion: 3
    });
  });
});
