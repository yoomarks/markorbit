import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProviderResponsibilityEvidenceReferenceV1 } from '@markorbit/contracts/provider-responsibility';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import { PostgresProviderResponsibilityRepository } from '../src/provider-responsibility-postgres.js';
import {
  ProviderResponsibilityService,
  type ChangeProviderResponsibilityProfileStatusCommand,
  type CreateProviderResponsibilityProfileCommand,
  type RevalidateProviderResponsibilityCurrentAuthorityCommand,
  type RecordProviderResponsibilityVerificationCommand
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
const providerId = 'provider_responsibility-postgres' as ProviderId;
const workspaceId = '44444444-4444-4444-8444-444444444444';
const actorId = 'user_responsibility-postgres';
const verifierId = 'verifier_responsibility-postgres';
const initialAt = '2026-09-02T08:00:00.000Z';
const afterSuspensionAt = '2026-09-02T08:01:00.000Z';

function providerEvidence(): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'provider-attestation:postgres',
    sourceOwner: 'MGSN',
    sourceType: 'PROVIDER_RESPONSIBILITY_ATTESTATION',
    sourceId: 'attestation_postgres',
    sourceVersion: 1,
    sourceFingerprintSha256: '1'.repeat(64),
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
    sourceFingerprintSha256: '2'.repeat(64),
    authorityClass: 'MGSN_VERIFIED_REFERENCE',
    verificationState: 'INDEPENDENTLY_VERIFIED',
    observedAt,
    artifactAccessAuthorized: false
  };
}

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
        teamReference: 'team:postgres',
        roleReference: 'role:final-executor',
        identityAuthorityReference: 'core-team:postgres',
        contactDataEmbedded: false
      }
    ],
    legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
    evidenceReferences: [providerEvidence()],
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveUntil: '2026-10-01T00:00:00.000Z',
    idempotencyKey: 'create-responsibility-postgres',
    correlationId: 'correlation_create-responsibility-postgres',
    ...overrides
  };
}

suite('Provider Responsibility PostgreSQL repository', () => {
  const namespace = 'mgsn_provider_responsibility_postgres_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 8,
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
  const service = () =>
    new ProviderResponsibilityService(
      repository(),
      new PostgresProviderRegistryRepository(database, database.getPool()),
      () => now,
      () => `provider-responsibility_postgres-${++profileSequence}`
    );
  const principal = { workspaceId, actorId };
  const verifier = {
    actorId: verifierId,
    verifierAuthorityReference: 'mgsn-authority:responsibility-verifier-postgres',
    authority: 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER' as const
  };

  async function seedProvider() {
    const record = {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      displayName: 'Durable Responsibility Provider',
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

  it('survives restart through verification, suspend, governed revalidation, resume and replay', async () => {
    const created = await service().createProfile(principal, createCommand());
    expect(created).toMatchObject({
      version: 1,
      status: 'CURRENT',
      directResponsibilityStatus: 'ATTESTED'
    });
    await expect(
      service().assessCurrent(providerId, workspaceId, initialAt)
    ).resolves.toMatchObject({
      state: 'UNKNOWN_OR_UNPROVEN'
    });

    const verification: RecordProviderResponsibilityVerificationCommand = {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      providerResponsibilityProfileId: created.providerResponsibilityProfileId,
      expectedProfileVersion: created.version,
      directResponsibilityStatus: 'VERIFIED',
      authorityState: 'CURRENT',
      evidenceReferences: [verifiedEvidence()],
      idempotencyKey: 'verify-responsibility-postgres',
      correlationId: 'correlation_verify-responsibility-postgres'
    };
    const verified = await service().recordVerification(verifier, verification);
    expect(verified.version).toBe(2);
    await expect(
      service().assessCurrent(providerId, workspaceId, initialAt)
    ).resolves.toMatchObject({
      state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED'
    });

    const suspend: ChangeProviderResponsibilityProfileStatusCommand = {
      schemaVersion: 1,
      providerId,
      providerResponsibilityProfileId: verified.providerResponsibilityProfileId,
      expectedProfileVersion: verified.version,
      action: 'SUSPEND',
      idempotencyKey: 'suspend-responsibility-postgres',
      correlationId: 'correlation_suspend-responsibility-postgres'
    };
    const suspended = await service().changeStatus(principal, suspend);
    expect(suspended).toMatchObject({ version: 3, status: 'SUSPENDED', authorityState: 'STALE' });

    const immediateResume: ChangeProviderResponsibilityProfileStatusCommand = {
      ...suspend,
      expectedProfileVersion: suspended.version,
      action: 'RESUME',
      idempotencyKey: 'resume-too-early-responsibility-postgres',
      correlationId: 'correlation_resume-too-early-responsibility-postgres'
    };
    await expect(service().changeStatus(principal, immediateResume)).rejects.toMatchObject({
      code: 'CURRENT_AUTHORITY_REVALIDATION_REQUIRED'
    });

    now = afterSuspensionAt;
    const revalidation: RevalidateProviderResponsibilityCurrentAuthorityCommand = {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      providerResponsibilityProfileId: suspended.providerResponsibilityProfileId,
      expectedProfileVersion: suspended.version,
      evidenceReferences: [verifiedEvidence(afterSuspensionAt)],
      idempotencyKey: 'revalidate-responsibility-postgres',
      correlationId: 'correlation_revalidate-responsibility-postgres'
    };
    const revalidated = await service().revalidateCurrentAuthority(verifier, revalidation);
    expect(revalidated).toMatchObject({
      version: 4,
      status: 'SUSPENDED',
      authorityState: 'CURRENT'
    });
    await expect(
      service().assessCurrent(providerId, workspaceId, afterSuspensionAt)
    ).resolves.toMatchObject({
      state: 'PROFILE_SUSPENDED'
    });

    const restarted = service();
    const resumed = await restarted.changeStatus(principal, {
      schemaVersion: 1,
      providerId,
      providerResponsibilityProfileId: revalidated.providerResponsibilityProfileId,
      expectedProfileVersion: revalidated.version,
      action: 'RESUME',
      idempotencyKey: 'resume-responsibility-postgres',
      correlationId: 'correlation_resume-responsibility-postgres'
    });
    expect(resumed).toMatchObject({ version: 5, status: 'CURRENT', authorityState: 'CURRENT' });
    await expect(
      restarted.assessCurrent(providerId, workspaceId, afterSuspensionAt)
    ).resolves.toMatchObject({
      state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED'
    });

    const replayedCreate = await service().createProfile(principal, createCommand());
    expect(replayedCreate).toEqual(created);
    await expect(
      service().createProfile(principal, createCommand({ finalExecutorStatus: 'UNKNOWN' }))
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const audit = await repository().listAuditHistory(created.providerResponsibilityProfileId);
    expect(audit.map((event) => event.action)).toEqual([
      'CREATED',
      'VERIFICATION_RECORDED',
      'SUSPENDED',
      'CURRENT_AUTHORITY_REVALIDATED',
      'RESUMED'
    ]);
  });

  it('serializes different-key concurrent first creates with one winner and zero loser residue', async () => {
    const first = service();
    const second = service();
    const results = await Promise.allSettled([
      first.createProfile(principal, createCommand({ idempotencyKey: 'create-a-postgres' })),
      second.createProfile(principal, createCommand({ idempotencyKey: 'create-b-postgres' }))
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM mgsn_provider_responsibility_profile_identities) AS identities,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_profiles) AS profiles,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_command_replays) AS replays,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_owner_audit_events) AS audits,
         (SELECT count(*)::int FROM mgsn_provider_responsibility_current) AS current_rows`
    );
    expect(counts.rows[0]).toMatchObject({
      identities: 1,
      profiles: 1,
      replays: 1,
      audits: 1,
      current_rows: 1
    });
  });

  it('keeps revoked history terminal and requires a fresh profile id for re-entry', async () => {
    const created = await service().createProfile(principal, createCommand());
    const revoked = await service().changeStatus(principal, {
      schemaVersion: 1,
      providerId,
      providerResponsibilityProfileId: created.providerResponsibilityProfileId,
      expectedProfileVersion: created.version,
      action: 'REVOKE',
      idempotencyKey: 'revoke-responsibility-postgres',
      correlationId: 'correlation_revoke-responsibility-postgres'
    });
    expect(revoked.status).toBe('REVOKED');

    const rejoined = await service().createProfile(
      principal,
      createCommand({
        idempotencyKey: 'fresh-rejoin-responsibility-postgres',
        correlationId: 'correlation_fresh-rejoin-responsibility-postgres'
      })
    );
    expect(rejoined.version).toBe(1);
    expect(rejoined.providerResponsibilityProfileId).not.toBe(
      created.providerResponsibilityProfileId
    );
    await expect(repository().findCurrentProfile(providerId, workspaceId)).resolves.toMatchObject({
      providerResponsibilityProfileId: rejoined.providerResponsibilityProfileId
    });
    const oldHistory = await repository().listProfileHistory(
      created.providerResponsibilityProfileId
    );
    expect(oldHistory.at(-1)?.status).toBe('REVOKED');
  });
});
