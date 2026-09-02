import { describe, expect, it, vi } from 'vitest';
import {
  controlledHandoffContractFixtureV1,
  noDownstreamHandoffAuthorityConsequences,
  type AuthorizeOrReplaceControlledHandoffCommandV1,
  type ControlledHandoffId,
  type RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import {
  ControlledHandoffError,
  ControlledPrivacyHandoffService,
  InMemoryControlledHandoffRepository,
  type ControlledHandoffCurrentAuthoritySnapshot,
  type ControlledHandoffCurrentAuthoritySource,
  type ControlledHandoffPrincipal
} from '../src/controlled-privacy-handoff.js';

const fixture = controlledHandoffContractFixtureV1;
const now = '2026-09-01T09:45:00.000Z';

function principal(overrides: Partial<ControlledHandoffPrincipal> = {}): ControlledHandoffPrincipal {
  const authority = fixture.authorizeCommand.trustedHumanAuthority;
  return {
    workspaceId: authority.originatingWorkspaceId,
    actorId: authority.authorizingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: authority.principalReference,
    workspaceMembershipReference: authority.workspaceMembershipReference,
    handoffAuthorityReference: authority.handoffAuthorityReference,
    handoffAuthorityVersion: authority.handoffAuthorityVersion,
    authenticatedAt: authority.authenticatedAt,
    affirmativeHumanActionEvidenceReference: authority.affirmativeHumanActionEvidenceReference,
    ...overrides
  };
}

function currentSnapshot(
  overrides: Partial<ControlledHandoffCurrentAuthoritySnapshot> = {}
): ControlledHandoffCurrentAuthoritySnapshot {
  return {
    authorityAvailable: true,
    selectionCurrent: true,
    selectionScopeMatch: true,
    sourceVersionsMatch: true,
    sourceAccessCurrent: true,
    participationActive: true,
    visibilityAuthorized: true,
    directExecutorEstablished: true,
    hiddenIntermediaryDetected: false,
    evidenceArtifactAccessAuthorized: false,
    checkedAuthorityReferences: [
      'selection:current',
      'network-participation:current',
      'direct-executor:current'
    ],
    ...overrides
  };
}

function harness(snapshot: ControlledHandoffCurrentAuthoritySnapshot | Error = currentSnapshot()) {
  const repository = new InMemoryControlledHandoffRepository();
  const evaluateCurrentAuthority = vi.fn(() => {
    if (snapshot instanceof Error) return Promise.reject(snapshot);
    return Promise.resolve(snapshot);
  });
  const source: ControlledHandoffCurrentAuthoritySource = { evaluateCurrentAuthority };
  let sequence = 0;
  const service = new ControlledPrivacyHandoffService(
    repository,
    source,
    () => now,
    () => `controlled-handoff_605-${++sequence}` as ControlledHandoffId
  );
  return { repository, service, evaluateCurrentAuthority };
}

function authorizeCommand(
  overrides: Partial<AuthorizeOrReplaceControlledHandoffCommandV1> = {}
): AuthorizeOrReplaceControlledHandoffCommandV1 {
  return { ...structuredClone(fixture.authorizeCommand), ...overrides };
}

async function createCurrent(service: ControlledPrivacyHandoffService) {
  return service.authorizeOrReplace(principal(), authorizeCommand());
}

function replacementCommand(
  current: Awaited<ReturnType<ControlledPrivacyHandoffService['authorizeOrReplace']>>
): AuthorizeOrReplaceControlledHandoffCommandV1 {
  return authorizeCommand({
    expectedCurrent: {
      kind: 'EXACT',
      controlledHandoffId: current.envelope.controlledHandoffId,
      version: current.envelope.version
    },
    idempotencyKey: 'controlled-handoff:605:replace',
    commandFingerprintSha256: '4'.repeat(64),
    correlationId: 'correlation_controlled-handoff-605-replace'
  });
}

function revokeCommand(
  current: Awaited<ReturnType<ControlledPrivacyHandoffService['authorizeOrReplace']>>
): RevokeControlledHandoffCommandV1 {
  return {
    ...structuredClone(fixture.revokeCommand),
    target: {
      controlledHandoffId: current.envelope.controlledHandoffId,
      version: current.envelope.version
    },
    idempotencyKey: 'controlled-handoff:605:revoke',
    commandFingerprintSha256: '6'.repeat(64),
    correlationId: 'correlation_controlled-handoff-605-revoke'
  };
}

function attempt() {
  return structuredClone(fixture.validForExactConsumption.attempt);
}

describe('MGSN Controlled Privacy Handoff V1 Phase A', () => {
  it('authorizes one explicit human, minimum-necessary envelope with no downstream authority', async () => {
    const { service } = harness();
    const result = await createCurrent(service);

    expect(result).toMatchObject({ mutation: 'AUTHORIZED', replayed: false });
    expect(result.envelope).toMatchObject({
      status: 'AUTHORIZED',
      version: 1,
      originatingWorkspaceId: fixture.authorizeCommand.originatingWorkspaceId,
      authorityConsequences: noDownstreamHandoffAuthorityConsequences
    });
    expect(result.envelope.authorizedProjection.items).toEqual(
      fixture.authorizeCommand.authorizedProjection.items
    );
    expect(result.envelope.authorityConsequences.externalContactAuthorized).toBe(false);
    expect(result.envelope.authorityConsequences.providerAllocated).toBe(false);
    expect(result.envelope.authorityConsequences.protectedActionReleased).toBe(false);
    expect(result.envelope.authorityConsequences.filingAuthorized).toBe(false);
    expect(result.envelope.authorityConsequences.paymentAuthorized).toBe(false);
    expect(result.envelope.authorityConsequences.officialTruthCreated).toBe(false);
  });

  it.each(['SYSTEM', 'AI_AGENT'] as const)(
    'rejects %s authorization before reading current private authority',
    async (actorKind) => {
      const { service, evaluateCurrentAuthority } = harness();
      await expect(
        service.authorizeOrReplace(principal({ actorKind }), authorizeCommand())
      ).rejects.toMatchObject({ code: 'HUMAN_ACTION_REQUIRED', status: 403 });
      expect(evaluateCurrentAuthority).not.toHaveBeenCalled();
    }
  );

  it('rejects wrong Workspace and spoofed human authority before current authority evaluation', async () => {
    const { service, evaluateCurrentAuthority } = harness();
    await expect(
      service.authorizeOrReplace(
        principal({ workspaceId: '018f0000-0000-7000-8000-000000000999' }),
        authorizeCommand()
      )
    ).rejects.toMatchObject({ code: 'ORIGINATING_WORKSPACE_MISMATCH', status: 403 });
    await expect(
      service.authorizeOrReplace(principal({ actorId: 'user_spoofed' }), authorizeCommand())
    ).rejects.toMatchObject({ code: 'AUTHORIZING_ACTOR_MISMATCH', status: 403 });
    expect(evaluateCurrentAuthority).not.toHaveBeenCalled();
  });

  it('rejects Privacy Preview, recipient and projection mismatches', async () => {
    const { service } = harness();
    const previewMismatch = authorizeCommand({
      privacyPreviewAcknowledgement: {
        ...structuredClone(fixture.authorizeCommand.privacyPreviewAcknowledgement),
        projectionFingerprintSha256: '0'.repeat(64)
      }
    });
    const recipientMismatch = authorizeCommand({
      recipient: {
        ...structuredClone(fixture.authorizeCommand.recipient),
        providerWorkspaceId: '018f0000-0000-7000-8000-000000009999'
      }
    });
    const overbroad = {
      ...authorizeCommand(),
      authorizedProjection: {
        ...structuredClone(fixture.authorizeCommand.authorizedProjection),
        wildcardAllowed: true
      }
    } as unknown as AuthorizeOrReplaceControlledHandoffCommandV1;

    await expect(service.authorizeOrReplace(principal(), previewMismatch)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    await expect(service.authorizeOrReplace(principal(), recipientMismatch)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    await expect(service.authorizeOrReplace(principal(), overbroad)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
  });

  it.each([
    ['SELECTION_NOT_CURRENT', { selectionCurrent: false }],
    ['SELECTION_SCOPE_MISMATCH', { selectionScopeMatch: false }],
    ['SOURCE_VERSION_MISMATCH', { sourceVersionsMatch: false }],
    ['SOURCE_ACCESS_NOT_CURRENT', { sourceAccessCurrent: false }],
    ['PARTICIPATION_NOT_ACTIVE', { participationActive: false }],
    ['VISIBILITY_NO_LONGER_AUTHORIZED', { visibilityAuthorized: false }],
    ['DIRECT_EXECUTOR_NOT_ESTABLISHED', { directExecutorEstablished: false }],
    ['HIDDEN_INTERMEDIARY_DETECTED', { hiddenIntermediaryDetected: true }]
  ] as const)(
    'fails authorize closed for %s',
    async (denialReason, overrides) => {
      const { service } = harness(currentSnapshot(overrides));
      await expect(createCurrent(service)).rejects.toMatchObject({
        code: 'CURRENT_AUTHORITY_DENIED',
        denialReason
      });
    }
  );

  it('fails authorize closed when current authority source is unavailable', async () => {
    const { service } = harness(new Error('authority outage'));
    await expect(createCurrent(service)).rejects.toMatchObject({
      code: 'AUTHORITY_UNAVAILABLE',
      status: 503,
      denialReason: 'AUTHORITY_UNAVAILABLE'
    });
  });

  it('replays historical authorization without re-establishing current usability', async () => {
    const { service, evaluateCurrentAuthority } = harness();
    const created = await createCurrent(service);
    const replay = await createCurrent(service);

    expect(replay.envelope).toEqual(created.envelope);
    expect(replay.replayed).toBe(true);
    expect(replay.replayDoesNotEstablishCurrentUsability).toBe(true);
    expect(evaluateCurrentAuthority).toHaveBeenCalledTimes(1);
  });

  it('conflicts when an idempotency key is reused with another fingerprint or principal', async () => {
    const { service } = harness();
    await createCurrent(service);
    await expect(
      service.authorizeOrReplace(
        principal(),
        authorizeCommand({ commandFingerprintSha256: 'f'.repeat(64) })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    await expect(
      service.authorizeOrReplace(principal({ actorId: 'user_other' }), authorizeCommand())
    ).rejects.toBeInstanceOf(ControlledHandoffError);
  });

  it('requires exact current CAS and appends replacement versions on the same Handoff identity', async () => {
    const { repository, service } = harness();
    const current = await createCurrent(service);
    const stale = replacementCommand(current);
    stale.expectedCurrent = {
      kind: 'EXACT',
      controlledHandoffId: current.envelope.controlledHandoffId,
      version: current.envelope.version + 1
    };
    await expect(service.authorizeOrReplace(principal(), stale)).rejects.toMatchObject({
      code: 'STALE_HANDOFF',
      status: 409
    });

    const replaced = await service.authorizeOrReplace(principal(), replacementCommand(current));
    expect(replaced).toMatchObject({ mutation: 'REPLACED' });
    expect(replaced.envelope.controlledHandoffId).toBe(current.envelope.controlledHandoffId);
    expect(replaced.envelope.version).toBe(2);
    expect(repository.listHistory(current.envelope.controlledHandoffId)).toHaveLength(2);
  });

  it('revokes only the exact current envelope and replay cannot revive current permission', async () => {
    const { repository, service } = harness();
    const current = await createCurrent(service);
    const revoked = await service.revoke(principal(), revokeCommand(current));
    const replayedAuthorize = await createCurrent(service);

    expect(revoked.envelope).toMatchObject({
      status: 'REVOKED',
      version: 2,
      revocationReasonCode: 'HUMAN_WITHDRAWAL'
    });
    expect(replayedAuthorize.replayed).toBe(true);
    expect(replayedAuthorize.envelope.status).toBe('AUTHORIZED');
    expect(repository.listHistory(current.envelope.controlledHandoffId)).toHaveLength(2);

    const validation = await service.validateCurrent(principal(), {
      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 2 },
      purpose: 'HANDOFF_CONSUMPTION',
      attempt: attempt()
    });
    expect(validation).toMatchObject({ decision: 'DENY', denialReason: 'HANDOFF_REVOKED' });
  });

  it('validates only the exact current recipient, purpose, projection and finite time window', async () => {
    const { service } = harness();
    const current = await createCurrent(service);
    const exact = await service.validateCurrent(principal(), {
      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 1 },
      purpose: 'HANDOFF_CONSUMPTION',
      attempt: attempt()
    });
    expect(exact).toMatchObject({
      decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
      currentlyUsable: true,
      validationIsNotBearerCapability: true,
      validationDoesNotAuthorizeDownstreamAction: true
    });

    const wrongRecipient = await service.validateCurrent(principal(), {
      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 1 },
      purpose: 'HANDOFF_CONSUMPTION',
      attempt: {
        ...attempt(),
        recipientProviderWorkspaceId: '018f0000-0000-7000-8000-000000009999'
      }
    });
    expect(wrongRecipient).toMatchObject({ decision: 'DENY', denialReason: 'WRONG_RECIPIENT' });

    const expired = await service.validateCurrent(principal(), {
      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 1 },
      purpose: 'HANDOFF_CONSUMPTION',
      attempt: { ...attempt(), attemptedAt: '2026-09-03T09:45:00.000Z' }
    });
    expect(expired).toMatchObject({ decision: 'DENY', denialReason: 'HANDOFF_EXPIRED' });
  });

  it('keeps evidence reference visibility separate from artifact retrieval authority', async () => {
    const { service } = harness(currentSnapshot({ evidenceArtifactAccessAuthorized: false }));
    const current = await createCurrent(service);
    const validation = await service.validateCurrent(principal(), {
      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 1 },
      purpose: 'EVIDENCE_REFERENCE_RETRIEVAL_REVIEW',
      attempt: { ...attempt(), artifactRetrievalRequested: true }
    });
    expect(validation).toMatchObject({
      decision: 'DENY',
      denialReason: 'EVIDENCE_ARTIFACT_ACCESS_NOT_AUTHORIZED',
      currentExactDisclosurePermitted: false
    });
  });

  it('revalidates current authority on every consumption instead of trusting persisted AUTHORIZED', async () => {
    const repository = new InMemoryControlledHandoffRepository();
    const positive: ControlledHandoffCurrentAuthoritySource = {
      evaluateCurrentAuthority: () => Promise.resolve(currentSnapshot())
    };
    const seed = new ControlledPrivacyHandoffService(
      repository,
      positive,
      () => now,
      () => 'controlled-handoff_605-currentness' as ControlledHandoffId
    );
    const current = await createCurrent(seed);
    const stale = new ControlledPrivacyHandoffService(repository, {
      evaluateCurrentAuthority: () =>
        Promise.resolve(currentSnapshot({ visibilityAuthorized: false }))
    }, () => now);

    const validation = await stale.validateCurrent(principal(), {
      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 1 },
      purpose: 'HANDOFF_CONSUMPTION',
      attempt: attempt()
    });
    expect(validation).toMatchObject({
      decision: 'DENY',
      denialReason: 'VISIBILITY_NO_LONGER_AUTHORIZED'
    });
  });
});
