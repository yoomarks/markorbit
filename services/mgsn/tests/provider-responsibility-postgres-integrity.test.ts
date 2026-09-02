import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  ProviderResponsibilityEvidenceReferenceV1,
  ProviderResponsibilityProfileId,
  ProviderResponsibilityProfileV1
} from '@markorbit/contracts/provider-responsibility';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import { PostgresProviderResponsibilityRepository } from '../src/provider-responsibility-postgres.js';
import {
  ProviderResponsibilityService,
  type ProviderResponsibilityCommandType,
  type ProviderResponsibilityCommit,
  type ReviseProviderResponsibilityProfileCommand
} from '../src/provider-responsibility.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_PROVIDER_RESPONSIBILITY_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_PROVIDER_RESPONSIBILITY_POSTGRES_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const providerId = 'provider_responsibility-integrity' as ProviderId;
const workspaceId = '55555555-5555-4555-8555-555555555555';
const actorId = 'user_responsibility-integrity';
const verifierId = 'verifier_responsibility-integrity';
const initialAt = '2026-09-02T09:00:00.000Z';
const laterAt = '2026-09-02T09:01:00.000Z';

function providerEvidence(): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'provider-attestation:integrity',
    sourceOwner: 'MGSN',
    sourceType: 'PROVIDER_RESPONSIBILITY_ATTESTATION',
    sourceId: 'attestation_integrity',
    sourceVersion: 1,
    sourceFingerprintSha256: 'a'.repeat(64),
    authorityClass: 'PROVIDER_ATTESTATION',
    verificationState: 'CLAIM_ONLY',
    observedAt: initialAt,
    artifactAccessAuthorized: false
  };
}

function verifiedEvidence(observedAt = initialAt): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: `mgsn-verification:${observedAt}`,
    sourceOwner: 'MGSN',
    sourceType: 'DIRECT_EXECUTOR_VERIFICATION',
    sourceId: `verification_${observedAt}`,
    sourceVersion: observedAt === initialAt ? 1 : 2,
    sourceFingerprintSha256: 'b'.repeat(64),
    authorityClass: 'MGSN_VERIFIED_REFERENCE',
    verificationState: 'INDEPENDENTLY_VERIFIED',
    observedAt,
    artifactAccessAuthorized: false
  };
}

function createCommand(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    providerId,
    finalExecutorStatus: 'PROVIDER_IS_FINAL_EXECUTOR' as const,
    directResponsibilityStatus: 'ATTESTED' as const,
    noRebrokeringCommitmentState: 'COMMITTED' as const,
    intermediaryDisclosureState: 'NO_INTERMEDIARY_DISCLOSED' as const,
    executionTeamReferences: [
      {
        teamReference: 'team:integrity',
        roleReference: 'role:final-executor',
        identityAuthorityReference: 'core-team:integrity',
        contactDataEmbedded: false as const
      }
    ],
    legallyRequiredDistinctSigner: {
      kind: 'NONE' as const,
      distinctSignerRequired: false as const
    },
    evidenceReferences: [providerEvidence()],
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveUntil: '2026-10-01T00:00:00.000Z',
    idempotencyKey: 'create-responsibility-integrity',
    correlationId: 'correlation_create-responsibility-integrity',
    ...overrides
  };
}

function refingerprint(profile: ProviderResponsibilityProfileV1): ProviderResponsibilityProfileV1 {
  const withoutFingerprint = { ...profile } as Record<string, unknown>;
  delete withoutFingerprint.profileFingerprintSha256;
  return {
    ...profile,
    profileFingerprintSha256: createHash('sha256')
      .update(JSON.stringify(withoutFingerprint))
      .digest('hex')
  };
}

suite('Provider Responsibility PostgreSQL integrity', () => {
  const namespace = 'mgsn_provider_responsibility_integrity_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 12,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });

  let now = initialAt;
  let profileSequence = 0;
  const repository = () =>
    new PostgresProviderResponsibilityRepository(database, database.getPool());
  const providerRepository = () =>
    new PostgresProviderRegistryRepository(database, database.getPool());
  const service = (fixedProfileId?: ProviderResponsibilityProfileId) =>
    new ProviderResponsibilityService(
      repository(),
      providerRepository(),
      () => now,
      () =>
        fixedProfileId ??
        (`provider-responsibility_integrity-${++profileSequence}` as ProviderResponsibilityProfileId)
    );
  const principal = { workspaceId, actorId };
  const verifier = {
    actorId: verifierId,
    verifierAuthorityReference: 'mgsn-authority:responsibility-verifier-integrity',
    authority: 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER' as const
  };

  async function seedProvider() {
    const record = {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      displayName: 'Responsibility Integrity Provider',
      operationalStatus: 'ACTIVE',
      version: 1,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: initialAt,
      updatedAt: initialAt
    };
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
         provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,
         created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,'ACTIVE',1,$4::jsonb,$5,$5,$6,$6)`,
      [providerId, workspaceId, record.displayName, JSON.stringify(record), actorId, initialAt]
    );
  }

  async function counts() {
    const result = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM mgsn_provider_responsibility_profile_identities) AS identities,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_profiles) AS profiles,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_execution_team_references) AS teams,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_evidence_references) AS evidence,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_command_replays) AS replays,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_owner_audit_events) AS audits,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_pointer_audit) AS pointer_audits,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_current) AS current_rows`
    );
    return result.rows[0] as Record<string, number>;
  }

  async function createVerified() {
    const created = await service().createProfile(principal, createCommand());
    const verified = await service().recordVerification(verifier, {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      providerResponsibilityProfileId: created.providerResponsibilityProfileId,
      expectedProfileVersion: created.version,
      directResponsibilityStatus: 'VERIFIED',
      authorityState: 'CURRENT',
      evidenceReferences: [verifiedEvidence()],
      idempotencyKey: 'verify-responsibility-integrity',
      correlationId: 'correlation_verify-responsibility-integrity'
    });
    return { created, verified };
  }

  async function createSuspended() {
    const { created, verified } = await createVerified();
    const suspended = await service().changeStatus(principal, {
      schemaVersion: 1,
      providerId,
      providerResponsibilityProfileId: verified.providerResponsibilityProfileId,
      expectedProfileVersion: verified.version,
      action: 'SUSPEND',
      idempotencyKey: 'suspend-responsibility-integrity',
      correlationId: 'correlation_suspend-responsibility-integrity'
    });
    return { created, verified, suspended };
  }

  async function expectOneWinner(promises: readonly Promise<unknown>[]) {
    const results = await Promise.allSettled(promises);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  }

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMgsnTestDatabase({
      pool: database.getPool(),
      namespace,
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(async () => {
    now = initialAt;
    profileSequence = 0;
    await database.getPool().query('TRUNCATE mgsn_providers RESTART IDENTITY CASCADE');
    await seedProvider();
  });

  afterAll(() => database.close());

  it('keeps no-row authority unknown across repository and service restart', async () => {
    await expect(repository().findCurrentProfile(providerId, workspaceId)).resolves.toBeUndefined();
    await expect(
      service().assessCurrent(providerId, workspaceId, initialAt)
    ).resolves.toMatchObject({
      state: 'UNKNOWN_OR_UNPROVEN',
      directExecutorEstablished: false
    });
    await expect(
      service().assessCurrent(providerId, workspaceId, initialAt)
    ).resolves.toMatchObject({
      state: 'UNKNOWN_OR_UNPROVEN'
    });
  });

  it('round-trips a legally required signer without Handoff or artifact authority', async () => {
    const created = await service().createProfile(
      principal,
      createCommand({
        intermediaryDisclosureState: 'LEGALLY_REQUIRED_SIGNER_ONLY',
        legallyRequiredDistinctSigner: {
          kind: 'REQUIRED',
          distinctSignerRequired: true,
          signerReference: 'signer:integrity',
          signerIdentityAuthorityReference: 'core-signer:integrity',
          legalBasisReference: 'law:integrity',
          jurisdiction: 'US',
          function: 'SIGNING_OR_FILING_ONLY',
          transparentlyDisclosed: true,
          receivesHandoffDataByDefault: false,
          doesNotReplaceFinalExecutionProvider: true
        }
      })
    );
    const restarted = await repository().findCurrentProfile(providerId, workspaceId);
    expect(restarted).toEqual(created);
    expect(restarted?.legallyRequiredDistinctSigner).toMatchObject({
      kind: 'REQUIRED',
      function: 'SIGNING_OR_FILING_ONLY',
      receivesHandoffDataByDefault: false,
      doesNotReplaceFinalExecutionProvider: true
    });
    expect(
      restarted?.evidenceReferences.every((item) => item.artifactAccessAuthorized === false)
    ).toBe(true);
    expect(
      Object.values(restarted?.authorityConsequences ?? {}).every((value) => value === false)
    ).toBe(true);
  });

  it('deduplicates concurrent exact same-key creates into one physical mutation', async () => {
    const first = service('provider-responsibility_same-key-a');
    const second = service('provider-responsibility_same-key-b');
    const command = createCommand({ idempotencyKey: 'same-key-create-integrity' });
    const results = await Promise.all([
      first.createProfile(principal, command),
      second.createProfile(principal, command)
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await counts()).toMatchObject({
      identities: 1,
      profiles: 1,
      teams: 1,
      evidence: 1,
      replays: 1,
      audits: 1,
      pointer_audits: 1,
      current_rows: 1
    });
  });

  it('rolls back profile, children, pointer, semantic audit and replay on a late replay constraint failure', async () => {
    const created = await service().createProfile(principal, createCommand());
    now = laterAt;
    const next = refingerprint({
      ...created,
      version: 2,
      checkedAt: laterAt,
      correlationId: 'correlation_late-rollback-integrity'
    });
    const mutation: ProviderResponsibilityCommit = {
      providerId,
      providerWorkspaceId: workspaceId,
      expectedCurrentProfileId: created.providerResponsibilityProfileId,
      expectedCurrentProfileVersion: created.version,
      profile: next,
      replay: {
        scopeKey: `rollback:${workspaceId}:${providerId}`,
        idempotencyKey: 'late-rollback-integrity',
        requestFingerprintSha256: 'c'.repeat(64),
        commandType: 'INVALID' as ProviderResponsibilityCommandType,
        response: next
      },
      audit: {
        providerResponsibilityProfileId: created.providerResponsibilityProfileId,
        providerId,
        providerWorkspaceId: workspaceId,
        previousVersion: 1,
        newVersion: 2,
        action: 'REVISED',
        actorReference: `provider-workspace:${workspaceId}:actor:${actorId}`,
        requestFingerprintSha256: 'c'.repeat(64),
        occurredAt: laterAt
      }
    };
    await expect(repository().commit(mutation)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
    expect(await counts()).toMatchObject({
      identities: 1,
      profiles: 1,
      teams: 1,
      evidence: 1,
      replays: 1,
      audits: 1,
      pointer_audits: 1,
      current_rows: 1
    });
    await expect(repository().findCurrentProfile(providerId, workspaceId)).resolves.toMatchObject({
      providerResponsibilityProfileId: created.providerResponsibilityProfileId,
      version: 1
    });
  });

  it('rejects mutation of all append-only durable responsibility histories', async () => {
    const created = await service().createProfile(principal, createCommand());
    const profileId = created.providerResponsibilityProfileId;
    const statements = [
      `UPDATE mgsn_provider_responsibility_profile_identities SET created_at=created_at WHERE provider_responsibility_profile_id=$1`,
      `UPDATE mgsn_provider_responsibility_profiles SET created_at=created_at WHERE provider_responsibility_profile_id=$1`,
      `UPDATE mgsn_provider_responsibility_execution_team_references SET created_at=created_at WHERE provider_responsibility_profile_id=$1`,
      `UPDATE mgsn_provider_responsibility_evidence_references SET created_at=created_at WHERE provider_responsibility_profile_id=$1`,
      `UPDATE mgsn_provider_responsibility_command_replays SET created_at=created_at WHERE response_provider_responsibility_profile_id=$1`,
      `UPDATE mgsn_provider_responsibility_owner_audit_events SET occurred_at=occurred_at WHERE provider_responsibility_profile_id=$1`,
      `UPDATE mgsn_provider_responsibility_pointer_audit SET occurred_at=occurred_at WHERE new_profile_id=$1`,
      `DELETE FROM mgsn_provider_responsibility_current WHERE provider_responsibility_profile_id=$1`
    ];
    for (const statement of statements) {
      await expect(database.getPool().query(statement, [profileId])).rejects.toBeTruthy();
    }
    await expect(repository().findCurrentProfile(providerId, workspaceId)).resolves.toEqual(
      created
    );
  });

  it('fails closed when canonical JSON conflicts with normalized immutable profile truth', async () => {
    const created = await service().createProfile(principal, createCommand());
    const malformedId =
      'provider-responsibility_malformed-integrity' as ProviderResponsibilityProfileId;
    await database.getPool().query(
      `INSERT INTO mgsn_provider_responsibility_profile_identities(
         provider_responsibility_profile_id,provider_id,provider_workspace_id,created_at
       ) VALUES($1,$2,$3,$4)`,
      [malformedId, providerId, workspaceId, laterAt]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_provider_responsibility_profiles(
         provider_responsibility_profile_id,version,provider_id,provider_workspace_id,status,
         final_executor_status,direct_responsibility_status,no_rebrokering_commitment_state,
         intermediary_disclosure_state,signer_kind,signer_reference,
         signer_identity_authority_reference,signer_legal_basis_reference,signer_jurisdiction,
         signer_function,signer_transparently_disclosed,signer_receives_handoff_data_by_default,
         signer_does_not_replace_final_execution_provider,authority_state,effective_from,effective_until,
         checked_at,profile_fingerprint_sha256,profile_record,correlation_id,created_by,created_at
       )
       SELECT $2,version,provider_id,provider_workspace_id,status,
              final_executor_status,direct_responsibility_status,no_rebrokering_commitment_state,
              intermediary_disclosure_state,signer_kind,signer_reference,
              signer_identity_authority_reference,signer_legal_basis_reference,signer_jurisdiction,
              signer_function,signer_transparently_disclosed,signer_receives_handoff_data_by_default,
              signer_does_not_replace_final_execution_provider,authority_state,effective_from,effective_until,
              checked_at,profile_fingerprint_sha256,
              jsonb_set(
                jsonb_set(profile_record,'{providerResponsibilityProfileId}',to_jsonb($2::text)),
                '{status}','\"SUSPENDED\"'::jsonb
              ),correlation_id,created_by,$3
         FROM mgsn_provider_responsibility_profiles
        WHERE provider_responsibility_profile_id=$1 AND version=1`,
      [created.providerResponsibilityProfileId, malformedId, laterAt]
    );
    await expect(repository().findLatestProfile(malformedId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
  });

  it('serializes revise versus suspend with exactly one durable winner', async () => {
    const created = await service().createProfile(principal, createCommand());
    const base = createCommand();
    const revision: ReviseProviderResponsibilityProfileCommand = {
      ...base,
      providerResponsibilityProfileId: created.providerResponsibilityProfileId,
      expectedProfileVersion: created.version,
      idempotencyKey: 'revise-race-integrity',
      correlationId: 'correlation_revise-race-integrity'
    };
    const before = await counts();
    await expectOneWinner([
      service().reviseProfile(principal, revision),
      service().changeStatus(principal, {
        schemaVersion: 1,
        providerId,
        providerResponsibilityProfileId: created.providerResponsibilityProfileId,
        expectedProfileVersion: created.version,
        action: 'SUSPEND',
        idempotencyKey: 'suspend-race-integrity',
        correlationId: 'correlation_suspend-race-integrity'
      })
    ]);
    const after = await counts();
    expect(after.profiles - before.profiles).toBe(1);
    expect(after.replays - before.replays).toBe(1);
    expect(after.audits - before.audits).toBe(1);
    expect(after.pointer_audits - before.pointer_audits).toBe(1);
  });

  it('serializes governed verification versus revoke with no loser residue', async () => {
    const created = await service().createProfile(principal, createCommand());
    const before = await counts();
    await expectOneWinner([
      service().recordVerification(verifier, {
        schemaVersion: 1,
        providerId,
        providerWorkspaceId: workspaceId,
        providerResponsibilityProfileId: created.providerResponsibilityProfileId,
        expectedProfileVersion: created.version,
        directResponsibilityStatus: 'VERIFIED',
        authorityState: 'CURRENT',
        evidenceReferences: [verifiedEvidence()],
        idempotencyKey: 'verify-race-integrity',
        correlationId: 'correlation_verify-race-integrity'
      }),
      service().changeStatus(principal, {
        schemaVersion: 1,
        providerId,
        providerResponsibilityProfileId: created.providerResponsibilityProfileId,
        expectedProfileVersion: created.version,
        action: 'REVOKE',
        idempotencyKey: 'revoke-verify-race-integrity',
        correlationId: 'correlation_revoke-verify-race-integrity'
      })
    ]);
    const after = await counts();
    expect(after.profiles - before.profiles).toBe(1);
    expect(after.replays - before.replays).toBe(1);
    expect(after.audits - before.audits).toBe(1);
  });

  it('serializes governed revalidation versus revoke with one semantic audit winner', async () => {
    const { suspended } = await createSuspended();
    now = laterAt;
    const before = await counts();
    await expectOneWinner([
      service().revalidateCurrentAuthority(verifier, {
        schemaVersion: 1,
        providerId,
        providerWorkspaceId: workspaceId,
        providerResponsibilityProfileId: suspended.providerResponsibilityProfileId,
        expectedProfileVersion: suspended.version,
        evidenceReferences: [verifiedEvidence(laterAt)],
        idempotencyKey: 'revalidate-race-integrity',
        correlationId: 'correlation_revalidate-race-integrity'
      }),
      service().changeStatus(principal, {
        schemaVersion: 1,
        providerId,
        providerResponsibilityProfileId: suspended.providerResponsibilityProfileId,
        expectedProfileVersion: suspended.version,
        action: 'REVOKE',
        idempotencyKey: 'revoke-revalidate-race-integrity',
        correlationId: 'correlation_revoke-revalidate-race-integrity'
      })
    ]);
    const after = await counts();
    expect(after.profiles - before.profiles).toBe(1);
    expect(after.replays - before.replays).toBe(1);
    expect(after.audits - before.audits).toBe(1);
  });

  it('serializes resume versus revoke after exact post-suspension revalidation', async () => {
    const { suspended } = await createSuspended();
    now = laterAt;
    const revalidated = await service().revalidateCurrentAuthority(verifier, {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      providerResponsibilityProfileId: suspended.providerResponsibilityProfileId,
      expectedProfileVersion: suspended.version,
      evidenceReferences: [verifiedEvidence(laterAt)],
      idempotencyKey: 'revalidate-before-resume-race-integrity',
      correlationId: 'correlation_revalidate-before-resume-race-integrity'
    });
    const before = await counts();
    await expectOneWinner([
      service().changeStatus(principal, {
        schemaVersion: 1,
        providerId,
        providerResponsibilityProfileId: revalidated.providerResponsibilityProfileId,
        expectedProfileVersion: revalidated.version,
        action: 'RESUME',
        idempotencyKey: 'resume-race-integrity',
        correlationId: 'correlation_resume-race-integrity'
      }),
      service().changeStatus(principal, {
        schemaVersion: 1,
        providerId,
        providerResponsibilityProfileId: revalidated.providerResponsibilityProfileId,
        expectedProfileVersion: revalidated.version,
        action: 'REVOKE',
        idempotencyKey: 'revoke-resume-race-integrity',
        correlationId: 'correlation_revoke-resume-race-integrity'
      })
    ]);
    const after = await counts();
    expect(after.profiles - before.profiles).toBe(1);
    expect(after.replays - before.replays).toBe(1);
    expect(after.audits - before.audits).toBe(1);
  });

  it('allows only one fresh rejoin after terminal revoke', async () => {
    const created = await service().createProfile(principal, createCommand());
    const revoked = await service().changeStatus(principal, {
      schemaVersion: 1,
      providerId,
      providerResponsibilityProfileId: created.providerResponsibilityProfileId,
      expectedProfileVersion: created.version,
      action: 'REVOKE',
      idempotencyKey: 'revoke-before-rejoin-race-integrity',
      correlationId: 'correlation_revoke-before-rejoin-race-integrity'
    });
    expect(revoked.status).toBe('REVOKED');
    const before = await counts();
    await expectOneWinner([
      service('provider-responsibility_rejoin-a').createProfile(
        principal,
        createCommand({ idempotencyKey: 'rejoin-a-integrity' })
      ),
      service('provider-responsibility_rejoin-b').createProfile(
        principal,
        createCommand({ idempotencyKey: 'rejoin-b-integrity' })
      )
    ]);
    const after = await counts();
    expect(after.identities - before.identities).toBe(1);
    expect(after.profiles - before.profiles).toBe(1);
    expect(after.replays - before.replays).toBe(1);
    expect(after.audits - before.audits).toBe(1);
    expect(after.current_rows).toBe(1);
    const current = await repository().findCurrentProfile(providerId, workspaceId);
    expect(current?.providerResponsibilityProfileId).not.toBe(
      created.providerResponsibilityProfileId
    );
    expect(current?.version).toBe(1);
  });
});
