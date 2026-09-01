import { describe, expect, it } from 'vitest';
import {
  noProviderResponsibilityAuthorityConsequences,
  type ProviderLegallyRequiredDistinctSignerV1,
  type ProviderResponsibilityEvidenceReferenceV1,
  type ProviderResponsibilityProfileV1
} from '@markorbit/contracts/provider-responsibility';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import {
  InMemoryProviderResponsibilityRepository,
  ProviderResponsibilityService,
  assessProviderDirectExecutor,
  type ChangeProviderResponsibilityProfileStatusCommand,
  type CreateProviderResponsibilityProfileCommand,
  type RecordProviderResponsibilityVerificationCommand,
  type RevalidateProviderResponsibilityCurrentAuthorityCommand,
  type ReviseProviderResponsibilityProfileCommand
} from '../src/provider-responsibility.js';
import type { ProviderRegistryRecord } from '../src/provider-registry.js';

const workspaceA = '11111111-1111-4111-8111-111111111111';
const workspaceB = '22222222-2222-4222-8222-222222222222';
const providerId = 'provider_responsibility-508' as ProviderId;
const actorId = 'user_responsibility-508';
const verifierId = 'verifier_responsibility-508';
const checkedAt = '2026-09-02T08:00:00.000Z';
const afterSuspensionAt = '2026-09-02T08:01:00.000Z';

function provider(): ProviderRegistryRecord {
  return {
    schemaVersion: 1,
    providerId,
    providerWorkspaceId: workspaceA,
    displayName: 'Responsibility Provider',
    operationalStatus: 'ACTIVE',
    version: 1,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: checkedAt,
    updatedAt: checkedAt
  };
}

function providerEvidence(
  overrides: Partial<ProviderResponsibilityEvidenceReferenceV1> = {}
): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'provider-attestation:508',
    sourceOwner: 'MGSN',
    sourceType: 'PROVIDER_RESPONSIBILITY_ATTESTATION',
    sourceId: 'attestation_508',
    sourceVersion: 1,
    sourceFingerprintSha256: '1'.repeat(64),
    authorityClass: 'PROVIDER_ATTESTATION',
    verificationState: 'CLAIM_ONLY',
    observedAt: checkedAt,
    artifactAccessAuthorized: false,
    ...overrides
  };
}

function verifiedEvidence(
  overrides: Partial<ProviderResponsibilityEvidenceReferenceV1> = {}
): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'mgsn-verification:508',
    sourceOwner: 'MGSN',
    sourceType: 'DIRECT_EXECUTOR_VERIFICATION',
    sourceId: 'verification_508',
    sourceVersion: 1,
    sourceFingerprintSha256: '2'.repeat(64),
    authorityClass: 'MGSN_VERIFIED_REFERENCE',
    verificationState: 'INDEPENDENTLY_VERIFIED',
    observedAt: checkedAt,
    artifactAccessAuthorized: false,
    ...overrides
  };
}

const noSigner = Object.freeze({
  kind: 'NONE',
  distinctSignerRequired: false
}) satisfies ProviderLegallyRequiredDistinctSignerV1;

const requiredSigner = Object.freeze({
  kind: 'REQUIRED',
  distinctSignerRequired: true,
  signerReference: 'organization:required-signer-508',
  signerIdentityAuthorityReference: 'core-organization:required-signer-508',
  legalBasisReference: 'legal-basis:required-signer-508',
  jurisdiction: 'US',
  function: 'SIGNING_OR_FILING_ONLY',
  transparentlyDisclosed: true,
  receivesHandoffDataByDefault: false,
  doesNotReplaceFinalExecutionProvider: true
}) satisfies ProviderLegallyRequiredDistinctSignerV1;

function createCommand(
  overrides: Partial<CreateProviderResponsibilityProfileCommand> = {}
): CreateProviderResponsibilityProfileCommand {
  return {
    schemaVersion: 1,
    providerId,
    finalExecutorStatus: 'PROVIDER_IS_FINAL_EXECUTOR',
    directResponsibilityStatus: 'ATTESTED',
    noRebrokeringCommitmentState: 'COMMITTED',
    intermediaryDisclosureState: 'NO_INTERMEDIARY_DISCLOSED',
    executionTeamReferences: [
      {
        teamReference: 'team:508',
        roleReference: 'role:final-executor',
        identityAuthorityReference: 'core-team:508',
        contactDataEmbedded: false
      }
    ],
    legallyRequiredDistinctSigner: noSigner,
    evidenceReferences: [providerEvidence()],
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveUntil: '2026-10-01T00:00:00.000Z',
    idempotencyKey: 'create-responsibility-508',
    correlationId: 'correlation_create-responsibility-508',
    ...overrides
  };
}

function reviseCommand(
  profile: ProviderResponsibilityProfileV1,
  overrides: Partial<ReviseProviderResponsibilityProfileCommand> = {}
): ReviseProviderResponsibilityProfileCommand {
  return {
    schemaVersion: 1,
    providerId,
    providerResponsibilityProfileId: profile.providerResponsibilityProfileId,
    expectedProfileVersion: profile.version,
    finalExecutorStatus: profile.finalExecutorStatus,
    directResponsibilityStatus: profile.directResponsibilityStatus,
    noRebrokeringCommitmentState: profile.noRebrokeringCommitmentState,
    intermediaryDisclosureState: profile.intermediaryDisclosureState,
    executionTeamReferences: profile.executionTeamReferences,
    legallyRequiredDistinctSigner: profile.legallyRequiredDistinctSigner,
    evidenceReferences: profile.evidenceReferences.filter(
      (evidence) => evidence.verificationState === 'CLAIM_ONLY'
    ),
    effectiveFrom: profile.effectiveFrom,
    ...(profile.effectiveUntil ? { effectiveUntil: profile.effectiveUntil } : {}),
    idempotencyKey: `revise-responsibility-${profile.version}`,
    correlationId: `correlation_revise-responsibility-${profile.version}`,
    ...overrides
  };
}

function statusCommand(
  profile: ProviderResponsibilityProfileV1,
  action: ChangeProviderResponsibilityProfileStatusCommand['action'],
  overrides: Partial<ChangeProviderResponsibilityProfileStatusCommand> = {}
): ChangeProviderResponsibilityProfileStatusCommand {
  return {
    schemaVersion: 1,
    providerId,
    providerResponsibilityProfileId: profile.providerResponsibilityProfileId,
    expectedProfileVersion: profile.version,
    action,
    idempotencyKey: `${action.toLowerCase()}-responsibility-${profile.version}`,
    correlationId: `correlation_${action.toLowerCase()}-responsibility-${profile.version}`,
    ...overrides
  };
}

function verificationCommand(
  profile: ProviderResponsibilityProfileV1,
  overrides: Partial<RecordProviderResponsibilityVerificationCommand> = {}
): RecordProviderResponsibilityVerificationCommand {
  return {
    schemaVersion: 1,
    providerId,
    providerWorkspaceId: workspaceA,
    providerResponsibilityProfileId: profile.providerResponsibilityProfileId,
    expectedProfileVersion: profile.version,
    directResponsibilityStatus: 'VERIFIED',
    authorityState: 'CURRENT',
    evidenceReferences: [verifiedEvidence()],
    idempotencyKey: `verify-responsibility-${profile.version}`,
    correlationId: `correlation_verify-responsibility-${profile.version}`,
    ...overrides
  };
}

function revalidationCommand(
  profile: ProviderResponsibilityProfileV1,
  overrides: Partial<RevalidateProviderResponsibilityCurrentAuthorityCommand> = {}
): RevalidateProviderResponsibilityCurrentAuthorityCommand {
  return {
    schemaVersion: 1,
    providerId,
    providerWorkspaceId: workspaceA,
    providerResponsibilityProfileId: profile.providerResponsibilityProfileId,
    expectedProfileVersion: profile.version,
    evidenceReferences: [
      verifiedEvidence({
        evidenceReference: 'mgsn-current-authority-revalidation:508',
        sourceId: 'current-authority-revalidation_508',
        sourceVersion: 2,
        observedAt: afterSuspensionAt
      })
    ],
    idempotencyKey: `revalidate-responsibility-${profile.version}`,
    correlationId: `correlation_revalidate-responsibility-${profile.version}`,
    ...overrides
  };
}

function fixture() {
  const providerRecord = provider();
  const providers = new Map<ProviderId, ProviderRegistryRecord>([[providerId, providerRecord]]);
  const repository = new InMemoryProviderResponsibilityRepository();
  let sequence = 0;
  let currentTime = checkedAt;
  const service = new ProviderResponsibilityService(
    repository,
    { findProviderById: (id) => Promise.resolve(providers.get(id)) },
    () => currentTime,
    () => `provider-responsibility_test-${++sequence}`
  );
  return {
    providerRecord,
    providers,
    repository,
    service,
    setNow: (value: string) => {
      currentTime = value;
    },
    principal: { workspaceId: workspaceA, actorId },
    verifier: {
      actorId: verifierId,
      verifierAuthorityReference: 'mgsn-authority:responsibility-verifier-508',
      authority: 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER' as const
    }
  };
}

describe('MGSN Provider Responsibility lifecycle and assessment', () => {
  it('maps no profile to unproven and denies the wrong Provider Workspace privacy-safely', async () => {
    const { service, principal } = fixture();
    await expect(service.assessCurrent(providerId, workspaceA, checkedAt)).resolves.toEqual({
      state: 'UNKNOWN_OR_UNPROVEN',
      assessment: null
    });
    await expect(
      service.createProfile({ ...principal, workspaceId: workspaceB }, createCommand())
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_FOUND', status: 404 });
  });

  it('records own-Workspace claim-only disclosure without changing Registry or downstream authority', async () => {
    const { service, repository, principal, providerRecord } = fixture();
    const created = await service.createProfile(principal, createCommand());
    expect(created).toMatchObject({
      providerId,
      providerWorkspaceId: workspaceA,
      status: 'CURRENT',
      version: 1,
      directResponsibilityStatus: 'ATTESTED'
    });
    expect(created.authorityConsequences).toEqual(noProviderResponsibilityAuthorityConsequences);
    expect(Object.values(created.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
    expect(created.evidenceReferences.every((evidence) => !evidence.artifactAccessAuthorized)).toBe(
      true
    );
    expect(providerRecord.operationalStatus).toBe('ACTIVE');
    expect(
      await repository.listProfileHistory(created.providerResponsibilityProfileId)
    ).toHaveLength(1);
  });

  it('explicitly rejects Provider self-promotion to VERIFIED or independent evidence', async () => {
    const { service, principal } = fixture();
    await expect(
      service.createProfile(principal, createCommand({ directResponsibilityStatus: 'VERIFIED' }))
    ).rejects.toMatchObject({ code: 'SELF_VERIFICATION_FORBIDDEN', status: 403 });
    await expect(
      service.createProfile(
        principal,
        createCommand({
          idempotencyKey: 'self-independent-evidence-508',
          evidenceReferences: [verifiedEvidence()]
        })
      )
    ).rejects.toMatchObject({ code: 'SELF_VERIFICATION_FORBIDDEN', status: 403 });
  });

  it('keeps final-executor attestation unproven until governed exact verification', async () => {
    const { service, principal, verifier } = fixture();
    const attested = await service.createProfile(principal, createCommand());
    await expect(service.assessCurrent(providerId, workspaceA, checkedAt)).resolves.toMatchObject({
      state: 'UNKNOWN_OR_UNPROVEN',
      assessment: { directExecutorEstablished: false }
    });
    const verified = await service.recordVerification(verifier, verificationCommand(attested));
    const result = await service.assessCurrent(providerId, workspaceA, checkedAt);
    expect(verified).toMatchObject({ directResponsibilityStatus: 'VERIFIED', version: 2 });
    expect(result).toMatchObject({
      state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
      assessment: {
        directExecutorEstablished: true,
        finalExecutionProviderId: providerId,
        finalExecutionProviderWorkspaceId: workspaceA,
        evidenceReferences: ['mgsn-verification:508'],
        currentAuthorityRevalidationRequiredBeforeUse: true,
        hiddenIntermediaryAllowed: false
      }
    });
  });

  it('establishes a transparent required-signer case without Handoff or appointment authority', async () => {
    const { service, principal, verifier } = fixture();
    const attested = await service.createProfile(
      principal,
      createCommand({
        intermediaryDisclosureState: 'LEGALLY_REQUIRED_SIGNER_ONLY',
        legallyRequiredDistinctSigner: requiredSigner
      })
    );
    await service.recordVerification(verifier, verificationCommand(attested));
    const { assessment } = await service.assessCurrent(providerId, workspaceA, checkedAt);
    expect(assessment).toMatchObject({
      state: 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED',
      legallyRequiredDistinctSigner: {
        function: 'SIGNING_OR_FILING_ONLY',
        receivesHandoffDataByDefault: false,
        doesNotReplaceFinalExecutionProvider: true
      },
      authorityConsequences: {
        professionalAppointmentCreated: false,
        externalContactAuthorized: false,
        filingAuthorized: false
      }
    });
  });

  it.each([
    [
      'provider not final executor',
      { finalExecutorStatus: 'PROVIDER_IS_NOT_FINAL_EXECUTOR' },
      'PROVIDER_NOT_FINAL_EXECUTOR'
    ],
    [
      'rebrokering',
      { intermediaryDisclosureState: 'REBROKERING_OR_SUBAGENT_DISCLOSED' },
      'REBROKERING_OR_SUBAGENT_DISCLOSED'
    ],
    [
      'commitment violation',
      { noRebrokeringCommitmentState: 'VIOLATION_RECORDED' },
      'NO_REBROKERING_COMMITMENT_NOT_CURRENT'
    ],
    [
      'responsibility dispute',
      { directResponsibilityStatus: 'DISPUTED' },
      'RESPONSIBILITY_DISPUTED'
    ],
    ['suspended profile', { status: 'SUSPENDED' }, 'PROFILE_SUSPENDED'],
    ['revoked profile', { status: 'REVOKED' }, 'PROFILE_REVOKED'],
    ['stale authority', { authorityState: 'STALE' }, 'AUTHORITY_NOT_CURRENT'],
    ['ambiguous authority', { authorityState: 'AMBIGUOUS' }, 'AUTHORITY_NOT_CURRENT'],
    ['unavailable authority', { authorityState: 'UNAVAILABLE' }, 'AUTHORITY_UNAVAILABLE'],
    ['not yet effective', { effectiveFrom: '2026-09-03T00:00:00.000Z' }, 'AUTHORITY_NOT_CURRENT'],
    ['expired', { effectiveUntil: checkedAt }, 'AUTHORITY_NOT_CURRENT']
  ] as const)('fails closed for %s', async (_name, change, expectedState) => {
    const { service, principal, verifier } = fixture();
    const attested = await service.createProfile(principal, createCommand());
    const verified = await service.recordVerification(verifier, verificationCommand(attested));
    expect(assessProviderDirectExecutor({ ...verified, ...change }, checkedAt).state).toBe(
      expectedState
    );
  });

  it.each([
    ['DISPUTED', 'RESPONSIBILITY_DISPUTED'],
    ['REVOKED', 'UNKNOWN_OR_UNPROVEN']
  ] as const)(
    'removes a positive result when its evidence is %s',
    async (verificationState, state) => {
      const { service, principal, verifier } = fixture();
      const attested = await service.createProfile(principal, createCommand());
      const verified = await service.recordVerification(verifier, verificationCommand(attested));
      const profile = {
        ...verified,
        evidenceReferences: [verifiedEvidence({ verificationState })]
      };
      expect(assessProviderDirectExecutor(profile, checkedAt).state).toBe(state);
    }
  );

  it('rejects immediate resume after suspending VERIFIED/CURRENT authority', async () => {
    const { service, repository, principal, verifier } = fixture();
    const created = await service.createProfile(principal, createCommand());
    const verified = await service.recordVerification(verifier, verificationCommand(created));
    const suspended = await service.changeStatus(principal, statusCommand(verified, 'SUSPEND'));
    expect(suspended).toMatchObject({ status: 'SUSPENDED', authorityState: 'STALE' });
    await expect(
      service.changeStatus(principal, statusCommand(suspended, 'RESUME'))
    ).rejects.toMatchObject({
      code: 'CURRENT_AUTHORITY_REVALIDATION_REQUIRED',
      status: 409
    });
    expect(
      await repository.listProfileHistory(suspended.providerResponsibilityProfileId)
    ).toHaveLength(3);
    expect(
      await repository.listAuditHistory(suspended.providerResponsibilityProfileId)
    ).toHaveLength(3);
  });

  it.each(['STALE', 'AMBIGUOUS', 'UNAVAILABLE'] as const)(
    'rejects resume while suspended authority is %s',
    async (authorityState) => {
      const { service, principal, verifier } = fixture();
      const created = await service.createProfile(principal, createCommand());
      const governed = await service.recordVerification(
        verifier,
        verificationCommand(created, { authorityState })
      );
      const suspended = await service.changeStatus(principal, statusCommand(governed, 'SUSPEND'));
      expect(suspended.authorityState).toBe(authorityState);
      await expect(
        service.changeStatus(principal, statusCommand(suspended, 'RESUME'))
      ).rejects.toMatchObject({ code: 'CURRENT_AUTHORITY_REVALIDATION_REQUIRED' });
    }
  );

  it('keeps revalidated authority suspended until explicit resume, then restores positive assessment', async () => {
    const { service, repository, principal, verifier, setNow } = fixture();
    const created = await service.createProfile(principal, createCommand());
    const verified = await service.recordVerification(verifier, verificationCommand(created));
    const suspended = await service.changeStatus(principal, statusCommand(verified, 'SUSPEND'));
    setNow(afterSuspensionAt);
    const command = revalidationCommand(suspended);
    const revalidated = await service.revalidateCurrentAuthority(verifier, command);
    expect(revalidated).toMatchObject({
      status: 'SUSPENDED',
      authorityState: 'CURRENT',
      directResponsibilityStatus: 'VERIFIED',
      version: suspended.version + 1
    });
    await expect(service.revalidateCurrentAuthority(verifier, command)).resolves.toEqual(
      revalidated
    );
    expect(
      await repository.listProfileHistory(revalidated.providerResponsibilityProfileId)
    ).toHaveLength(4);
    expect(await service.assessCurrent(providerId, workspaceA, afterSuspensionAt)).toMatchObject({
      state: 'PROFILE_SUSPENDED',
      assessment: { directExecutorEstablished: false }
    });
    const resumed = await service.changeStatus(principal, statusCommand(revalidated, 'RESUME'));
    expect(await service.assessCurrent(providerId, workspaceA, afterSuspensionAt)).toMatchObject({
      state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
      assessment: { directExecutorEstablished: true }
    });
    expect(resumed.authorityConsequences).toEqual(noProviderResponsibilityAuthorityConsequences);
  });

  it('rejects pre-suspension evidence as current-authority revalidation', async () => {
    const { service, repository, principal, verifier, setNow } = fixture();
    const created = await service.createProfile(principal, createCommand());
    const verified = await service.recordVerification(verifier, verificationCommand(created));
    const suspended = await service.changeStatus(principal, statusCommand(verified, 'SUSPEND'));
    setNow(afterSuspensionAt);
    await expect(
      service.revalidateCurrentAuthority(
        verifier,
        revalidationCommand(suspended, {
          evidenceReferences: [verifiedEvidence({ observedAt: checkedAt })]
        })
      )
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 422 });
    expect(
      await repository.listProfileHistory(suspended.providerResponsibilityProfileId)
    ).toHaveLength(3);
    expect(
      await repository.listAuditHistory(suspended.providerResponsibilityProfileId)
    ).toHaveLength(3);
  });

  it('does not allow a Provider principal to perform governed current-authority revalidation', async () => {
    const { service, principal, verifier, setNow } = fixture();
    const created = await service.createProfile(principal, createCommand());
    const verified = await service.recordVerification(verifier, verificationCommand(created));
    const suspended = await service.changeStatus(principal, statusCommand(verified, 'SUSPEND'));
    setNow(afterSuspensionAt);
    await expect(
      service.revalidateCurrentAuthority(
        principal as unknown as Parameters<typeof service.revalidateCurrentAuthority>[0],
        revalidationCommand(suspended)
      )
    ).rejects.toMatchObject({ code: 'INVALID_VERIFIER_AUTHORITY', status: 403 });
  });

  it.each(['RESUME', 'REVOKE'] as const)(
    'atomically resolves current-authority revalidation versus %s without loser residue',
    async (competingAction) => {
      const { service, repository, principal, verifier, setNow } = fixture();
      const created = await service.createProfile(principal, createCommand());
      const verified = await service.recordVerification(verifier, verificationCommand(created));
      const suspended = await service.changeStatus(principal, statusCommand(verified, 'SUSPEND'));
      setNow(afterSuspensionAt);
      const revalidationKey = `race-revalidation-${competingAction.toLowerCase()}-508`;
      const competingKey = `race-${competingAction.toLowerCase()}-revalidation-508`;
      const attempts = await Promise.allSettled([
        service.revalidateCurrentAuthority(
          verifier,
          revalidationCommand(suspended, {
            idempotencyKey: revalidationKey,
            correlationId: `correlation_${revalidationKey}`
          })
        ),
        service.changeStatus(
          principal,
          statusCommand(suspended, competingAction, {
            idempotencyKey: competingKey,
            correlationId: `correlation_${competingKey}`
          })
        )
      ]);
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
      expect(
        await repository.listProfileHistory(suspended.providerResponsibilityProfileId)
      ).toHaveLength(4);
      expect(
        await repository.listAuditHistory(suspended.providerResponsibilityProfileId)
      ).toHaveLength(4);
      const loserKey = attempts[0]?.status === 'rejected' ? revalidationKey : competingKey;
      expect(
        await repository.findReplay(`provider-responsibility:${workspaceA}:${providerId}`, loserKey)
      ).toBeUndefined();
    }
  );

  it('enforces suspend/resume CAS, terminal revoke and fresh-id re-entry', async () => {
    const { service, repository, principal, verifier, setNow } = fixture();
    const created = await service.createProfile(principal, createCommand());
    const verified = await service.recordVerification(verifier, verificationCommand(created));
    const suspended = await service.changeStatus(principal, statusCommand(verified, 'SUSPEND'));
    expect(suspended).toMatchObject({ status: 'SUSPENDED', authorityState: 'STALE', version: 3 });
    await expect(
      service.changeStatus(
        principal,
        statusCommand(suspended, 'RESUME', { expectedProfileVersion: 1 })
      )
    ).rejects.toMatchObject({ code: 'STALE_PROFILE' });
    setNow(afterSuspensionAt);
    const revalidated = await service.revalidateCurrentAuthority(
      verifier,
      revalidationCommand(suspended)
    );
    const resumed = await service.changeStatus(principal, statusCommand(revalidated, 'RESUME'));
    const revoked = await service.changeStatus(principal, statusCommand(resumed, 'REVOKE'));
    await expect(
      service.changeStatus(principal, statusCommand(revoked, 'RESUME'))
    ).rejects.toMatchObject({ code: 'PROFILE_REVOKED' });
    const rejoined = await service.createProfile(
      principal,
      createCommand({
        idempotencyKey: 'fresh-rejoin-508',
        correlationId: 'correlation_fresh-rejoin-508'
      })
    );
    expect(rejoined.providerResponsibilityProfileId).not.toBe(
      revoked.providerResponsibilityProfileId
    );
    expect(rejoined.version).toBe(1);
    expect(
      await repository.listProfileHistory(revoked.providerResponsibilityProfileId)
    ).toHaveLength(6);
  });

  it('returns the exact canonical replay and rejects a changed request under the same key', async () => {
    const { service, repository, principal } = fixture();
    const command = createCommand();
    const first = await service.createProfile(principal, command);
    await expect(service.createProfile(principal, command)).resolves.toEqual(first);
    expect(await repository.listProfileHistory(first.providerResponsibilityProfileId)).toHaveLength(
      1
    );
    await expect(
      service.createProfile(
        principal,
        createCommand({ effectiveUntil: '2026-11-01T00:00:00.000Z' })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('atomically permits one fresh disclosure and leaves no loser history, replay or audit', async () => {
    const { service, repository, principal } = fixture();
    const attempts = await Promise.allSettled([
      service.createProfile(principal, createCommand({ idempotencyKey: 'fresh-a-508' })),
      service.createProfile(
        principal,
        createCommand({
          idempotencyKey: 'fresh-b-508',
          correlationId: 'correlation_fresh-b-508'
        })
      )
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    const winner = attempts.find(
      (attempt): attempt is PromiseFulfilledResult<ProviderResponsibilityProfileV1> =>
        attempt.status === 'fulfilled'
    )!.value;
    const loserId = (
      ['provider-responsibility_test-1', 'provider-responsibility_test-2'] as const
    ).find((id) => id !== winner.providerResponsibilityProfileId)!;
    const loserKey = attempts[0]?.status === 'rejected' ? 'fresh-a-508' : 'fresh-b-508';
    expect(await repository.listProfileHistory(loserId)).toEqual([]);
    expect(await repository.listAuditHistory(loserId)).toEqual([]);
    expect(
      await repository.findReplay(`provider-responsibility:${workspaceA}:${providerId}`, loserKey)
    ).toBeUndefined();
  });

  it.each([
    ['two revisions', 'REVISE', 'REVISE'],
    ['suspend versus revise', 'SUSPEND', 'REVISE'],
    ['revoke versus revise', 'REVOKE', 'REVISE'],
    ['verification versus revoke', 'VERIFY', 'REVOKE']
  ] as const)(
    'atomically resolves %s with exactly one committed mutation',
    async (_name, left, right) => {
      const { service, repository, principal, verifier } = fixture();
      const current = await service.createProfile(principal, createCommand());
      const invoke = (kind: 'REVISE' | 'SUSPEND' | 'REVOKE' | 'VERIFY', suffix: string) => {
        if (kind === 'REVISE')
          return service.reviseProfile(
            principal,
            reviseCommand(current, {
              idempotencyKey: `race-${suffix}-508`,
              correlationId: `correlation_race-${suffix}-508`,
              effectiveUntil:
                suffix === 'left' ? '2026-10-02T00:00:00.000Z' : '2026-10-03T00:00:00.000Z'
            })
          );
        if (kind === 'VERIFY')
          return service.recordVerification(
            verifier,
            verificationCommand(current, {
              idempotencyKey: `race-${suffix}-508`,
              correlationId: `correlation_race-${suffix}-508`
            })
          );
        return service.changeStatus(
          principal,
          statusCommand(current, kind, {
            idempotencyKey: `race-${suffix}-508`,
            correlationId: `correlation_race-${suffix}-508`
          })
        );
      };
      const attempts = await Promise.allSettled([invoke(left, 'left'), invoke(right, 'right')]);
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
      expect(
        await repository.listProfileHistory(current.providerResponsibilityProfileId)
      ).toHaveLength(2);
      expect(
        await repository.listAuditHistory(current.providerResponsibilityProfileId)
      ).toHaveLength(2);
      const loserKey = attempts[0]?.status === 'rejected' ? 'race-left-508' : 'race-right-508';
      expect(
        await repository.findReplay(`provider-responsibility:${workspaceA}:${providerId}`, loserKey)
      ).toBeUndefined();
    }
  );

  it('atomically permits only one fresh rejoin after revoke', async () => {
    const { service, repository, principal } = fixture();
    const first = await service.createProfile(principal, createCommand());
    await service.changeStatus(principal, statusCommand(first, 'REVOKE'));
    const attempts = await Promise.allSettled([
      service.createProfile(
        principal,
        createCommand({ idempotencyKey: 'rejoin-a-508', correlationId: 'correlation_rejoin-a-508' })
      ),
      service.createProfile(
        principal,
        createCommand({ idempotencyKey: 'rejoin-b-508', correlationId: 'correlation_rejoin-b-508' })
      )
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    const winner = attempts.find(
      (attempt): attempt is PromiseFulfilledResult<ProviderResponsibilityProfileV1> =>
        attempt.status === 'fulfilled'
    )!.value;
    expect(winner.providerResponsibilityProfileId).not.toBe(first.providerResponsibilityProfileId);
    expect(await repository.listProfileHistory(first.providerResponsibilityProfileId)).toHaveLength(
      2
    );
  });

  it('retains immutable privacy-safe audit and profile history across operational restriction', async () => {
    const { service, repository, principal, providers, providerRecord } = fixture();
    const created = await service.createProfile(principal, createCommand());
    const violated = await service.reviseProfile(
      principal,
      reviseCommand(created, { noRebrokeringCommitmentState: 'VIOLATION_RECORDED' })
    );
    providers.set(providerId, { ...providerRecord, operationalStatus: 'SUSPENDED', version: 2 });
    const history = await repository.listProfileHistory(created.providerResponsibilityProfileId);
    const audits = await repository.listAuditHistory(created.providerResponsibilityProfileId);
    expect(history).toHaveLength(2);
    expect(history[0]?.noRebrokeringCommitmentState).toBe('COMMITTED');
    expect(history[1]?.noRebrokeringCommitmentState).toBe('VIOLATION_RECORDED');
    expect(audits.map((audit) => audit.action)).toEqual(['CREATED', 'VIOLATION_RECORDED']);
    expect(Object.keys(audits[0]!).sort()).toEqual(
      [
        'action',
        'actorReference',
        'newVersion',
        'occurredAt',
        'previousVersion',
        'providerId',
        'providerResponsibilityProfileId',
        'providerWorkspaceId',
        'requestFingerprintSha256'
      ].sort()
    );
    audits[0]!.actorReference = 'tampered';
    expect(
      (await repository.listAuditHistory(created.providerResponsibilityProfileId))[0]
        ?.actorReference
    ).toBe(actorId);
    expect(await service.assessCurrent(providerId, workspaceA, checkedAt)).toMatchObject({
      state: 'NO_REBROKERING_COMMITMENT_NOT_CURRENT'
    });
    expect(violated.authorityConsequences).toEqual(noProviderResponsibilityAuthorityConsequences);
  });
});
