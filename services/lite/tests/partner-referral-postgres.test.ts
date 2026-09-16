import { createHash } from 'node:crypto';
import path from 'node:path';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresBusinessAttributionStore } from '../src/business-attribution.js';
import { PartnerReferralService, PostgresPartnerReferralStore } from '../src/partner-referral.js';
import { PostgresWorkspaceDirectoryStore } from '../src/workspace-directory.js';

const url = process.env.LITE_PARTNER_REFERRAL_TEST_DATABASE_URL;
const required = process.env.LITE_PARTNER_REFERRAL_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('LITE_PARTNER_REFERRAL_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const evaluatedAt = '2026-09-17T09:00:00.000Z';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

suite('PostgreSQL Partner Referral eligibility journey', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'partner-referral-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_partner_referral_test'
  });
  let directorySequence = 0;
  let attributionSequence = 0;
  let referralSequence = 0;
  const directory = () =>
    new PostgresWorkspaceDirectoryStore(
      database,
      database.getPool(),
      () => evaluatedAt,
      () =>
        `workspace-directory-entry_partner-${++directorySequence}` as `workspace-directory-entry_${string}`
    );
  const attribution = () =>
    new PostgresBusinessAttributionStore(
      database,
      database.getPool(),
      () => evaluatedAt,
      () => `partnerreferral${++attributionSequence}`
    );
  const referral = () =>
    new PostgresPartnerReferralStore(
      database,
      database.getPool(),
      () => evaluatedAt,
      () => `partnerreferral${++referralSequence}`
    );
  const ratePolicies = {
    resolve: (input: Readonly<{ applicability: Record<string, string>; asOf: string }>) =>
      Promise.resolve({
        schemaVersion: 1 as const,
        policyId: 'rate-policy_partner-referral-v1',
        version: 1,
        kind: 'REFERRAL_COMMISSION' as const,
        lifecycle: 'ACTIVE' as const,
        applicability: input.applicability,
        calculation: { kind: 'PERCENTAGE' as const, basisPoints: 1000 },
        effectiveFrom: evaluatedAt,
        sourceRef: 'policy-config:partner-referral-v1',
        recordedAt: evaluatedAt
      })
  };
  const service = () =>
    new PartnerReferralService(
      directory(),
      attribution(),
      ratePolicies,
      referral(),
      () => evaluatedAt
    );

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_partner_referral_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Referral A','referral-a'),($2,'Referral B','referral-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30_000);

  beforeEach(async () => {
    directorySequence = 0;
    attributionSequence = 0;
    referralSequence = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_partner_commission_eligibility_commands,lite_partner_commission_eligibility_candidates,lite_partner_referral_program_commands,lite_partner_referral_programs,lite_business_attribution_commands,lite_business_attribution_links,lite_workspace_directory_commands,lite_workspace_directory_heads,lite_workspace_directory_versions CASCADE'
      );
  });

  afterAll(async () => database.close());

  it('replays exact partner-to-Formal-Matter eligibility after restart and isolates Workspace reads', async () => {
    const partner = await directory().create({
      workspaceId,
      actorPrincipalId: 'user_manager',
      idempotencyKey: 'partner-create',
      entryKind: 'ORGANIZATION',
      displayName: 'Referral Partner A',
      aliases: ['Partner A'],
      roles: ['OTHER'],
      externalIdentityReferences: []
    });
    const programCommand = {
      workspaceId,
      actorPrincipalId: 'user_manager',
      idempotencyKey: 'program-create',
      referralCode: 'partner-a',
      partner: {
        id: partner.workspaceDirectoryEntryId,
        version: partner.version,
        fingerprintSha256: digest(partner)
      }
    };
    const program = await service().createProgram(programCommand);
    await expect(service().createProgram(programCommand)).resolves.toEqual(program);

    const siteInbound = await attribution().create({
      workspaceId,
      actorPrincipalId: 'user_operator',
      idempotencyKey: 'site-inbound-referral',
      motionKind: 'SITE_INBOUND',
      sourceRefs: [
        {
          owner: 'SITE',
          kind: 'SITE_REFERRAL_CODE',
          id: 'site_markreg|partner-a',
          version: 1,
          fingerprintSha256: 'a'.repeat(64),
          observedAt: evaluatedAt
        }
      ],
      touchpointRefs: [],
      downstreamRef: {
        owner: 'MARKREG',
        kind: 'FORMAL_MATTER',
        id: 'formal-matter_referred',
        version: 1,
        fingerprintSha256: 'b'.repeat(64),
        observedAt: evaluatedAt
      },
      attributionState: 'ATTRIBUTED',
      evidenceBasis: 'EXACT_LINEAGE',
      evaluatedAt
    });
    const eligibilityCommand = {
      workspaceId,
      actorPrincipalId: 'user_manager',
      idempotencyKey: 'eligibility-evaluate',
      program: {
        id: program.partnerReferralProgramId,
        version: 1 as const,
        fingerprintSha256: program.programFingerprintSha256
      },
      siteInboundAttribution: {
        id: siteInbound.businessAttributionLinkId,
        version: 1 as const,
        fingerprintSha256: siteInbound.businessAttributionFingerprintSha256
      }
    };
    const candidate = await service().evaluate(eligibilityCommand);
    await expect(service().evaluate(eligibilityCommand)).resolves.toEqual(candidate);
    await expect(
      referral().findCandidate(workspaceId, candidate.partnerCommissionEligibilityCandidateId)
    ).resolves.toEqual(candidate);
    await expect(
      referral().findCandidate(otherWorkspaceId, candidate.partnerCommissionEligibilityCandidateId)
    ).resolves.toBeUndefined();
    expect(candidate).toMatchObject({
      outcome: 'ELIGIBLE_FOR_COMMISSION_REVIEW',
      partner: { id: partner.workspaceDirectoryEntryId },
      downstreamRef: { owner: 'MARKREG', kind: 'FORMAL_MATTER' },
      authorityConsequences: {
        conversionCreated: false,
        commissionAmountCalculated: false,
        paymentSuccessClaimed: false,
        settlementClaimed: false,
        payoutCompleted: false,
        customerDataAccessGranted: false
      }
    });
    expect(program.authorityConsequences).toEqual({
      legalIdentityVerified: false,
      partnerEnrolledAutonomously: false,
      customerDataAccessGranted: false,
      paymentAuthorized: false,
      settlementCreated: false,
      payoutCreated: false
    });
  });
});
