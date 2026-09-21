import path from 'node:path';
import {
  seedWorkspacePackageFingerprintSha256V1,
  type SeedWorkspacePackageV1
} from '@markorbit/contracts/seed-workspace-package';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresBusinessAttributionStore } from '../src/business-attribution.js';
import {
  EducationCommunityService,
  PostgresEducationCommunityWorkItemReader
} from '../src/education-community.js';
import { PostgresOutboundContactPolicyStore } from '../src/outbound-contact-policy.js';
import {
  PostgresSeedWorkspacePackageStore,
  SeedWorkspaceClaimService
} from '../src/seed-workspace-package.js';

const url = process.env.LITE_EDUCATION_COMMUNITY_TEST_DATABASE_URL;
const required = process.env.LITE_EDUCATION_COMMUNITY_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('LITE_EDUCATION_COMMUNITY_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;

const campaignWorkspaceId = '11111111-1111-4111-8111-111111111111';
const activatedWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const endpoint = 'a'.repeat(64);

suite('PostgreSQL Seed Workspace Package owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'seed-workspace-package-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_seed_workspace_package_test'
  });
  let id = 0;
  let clock = '2026-09-21T00:00:00.000Z';
  const now = () => clock;
  const outbound = () =>
    new PostgresOutboundContactPolicyStore(database, database.getPool(), now, () => `seed${++id}`);
  const attribution = () =>
    new PostgresBusinessAttributionStore(database, database.getPool(), now, () => `seed${++id}`);
  const education = () =>
    new EducationCommunityService(
      database,
      database.getPool(),
      outbound(),
      new PostgresEducationCommunityWorkItemReader(database.getPool()),
      {
        resolve: (workspaceId: string) =>
          Promise.resolve({
            owner: 'CORE' as const,
            kind: 'WORKSPACE_ACTIVATION' as const,
            id: workspaceId,
            version: 1,
            fingerprintSha256: 'c'.repeat(64),
            observedAt: clock
          })
      },
      attribution(),
      now,
      () => `seed${++id}`
    );
  const packages = () => new PostgresSeedWorkspacePackageStore(database.getPool(), now);

  const prepared = (
    packageId: `seed-workspace-package_${string}`,
    expiresAt = '2026-10-21T00:00:00.000Z'
  ): SeedWorkspacePackageV1 => {
    const base: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'> = {
      schemaVersion: 1,
      seedWorkspacePackageId: packageId,
      version: 1,
      stage: 'PREPARED',
      preparedByWorkspaceId: campaignWorkspaceId,
      target: {
        kind: 'AGENCY',
        displayName: 'Example IP Agency',
        sourceRefs: [
          {
            owner: 'DATA_ENGINE',
            kind: 'CNIPA_AGENCY',
            id: 'cnipa-agency-001',
            version: 'snapshot-2026-09-21',
            fingerprintSha256: '1'.repeat(64),
            observedAt: '2026-09-20T00:00:00.000Z'
          }
        ]
      },
      collections: {
        representedApplicants: {
          owner: 'DATA_ENGINE',
          kind: 'REPRESENTED_APPLICANT_SET',
          id: 'represented-applicants-001',
          version: 1,
          fingerprintSha256: '2'.repeat(64),
          observedAt: '2026-09-20T00:00:00.000Z',
          count: 23
        },
        relatedTrademarks: {
          owner: 'DATA_ENGINE',
          kind: 'RELATED_TRADEMARK_SET',
          id: 'related-trademarks-001',
          version: 1,
          fingerprintSha256: '3'.repeat(64),
          observedAt: '2026-09-20T00:00:00.000Z',
          count: 87
        }
      },
      preparedAt: '2026-09-21T00:00:00.000Z',
      expiresAt,
      authorityConsequences: {
        accountCreated: false,
        workspaceActivated: false,
        organizationAuthorityEstablished: false,
        customerRelationshipEstablished: false,
        managedAssetEstablished: false,
        opportunityQualified: false,
        marketingConsentInferred: false,
        externalInvitationSent: false,
        externalActionAuthorized: false
      }
    };
    return {
      ...base,
      packageFingerprintSha256: seedWorkspacePackageFingerprintSha256V1(base)
    };
  };

  async function invite(
    packageId: `seed-workspace-package_${string}`,
    token: string,
    suffix: string
  ) {
    const service = education();
    const cohort = await service.createCohort({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: `cohort-${suffix}`,
      name: `Seed cohort ${suffix}`,
      source: {
        owner: 'LITE',
        kind: 'SEED_WORKSPACE_PACKAGE',
        id: packageId,
        version: 1,
        fingerprintSha256: '4'.repeat(64),
        observedAt: clock
      }
    });
    const registered = await service.register({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: `register-${suffix}`,
      cohortId: cohort.educationCommunityCohortId,
      participantRef: packageId,
      endpointFingerprintSha256: endpoint
    });
    const policyRef = { policyId: 'seed-invitation-policy', version: 1 };
    await outbound().assertBasis({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: `basis-${suffix}`,
      targetRef: {
        owner: 'LITE',
        kind: 'EDUCATION_COMMUNITY_PARTICIPANT',
        id: registered.educationCommunityJourneyId,
        version: 1
      },
      endpointFingerprintSha256: endpoint,
      purpose: 'EDUCATION_INVITATION',
      policyRef,
      basisState: 'ASSERTED_ALLOWED',
      evidenceRefs: ['seed-target-reviewed']
    });
    await service.prepareInvitation({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: `invite-${suffix}`,
      journeyId: registered.educationCommunityJourneyId,
      expectedVersion: 1,
      invitationClaimToken: token,
      policyRef,
      reviewedSendFingerprintSha256: '5'.repeat(64)
    });
    return registered.educationCommunityJourneyId;
  }

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
    await migrate(database.getPool(), 'lite_seed_workspace_package_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug)
       VALUES($1,'Campaign','campaign'),($2,'Activated','activated'),($3,'Other','other')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [campaignWorkspaceId, activatedWorkspaceId, otherWorkspaceId]
    );
  }, 30_000);

  beforeEach(async () => {
    id = 0;
    clock = '2026-09-21T00:00:00.000Z';
    await database.getPool().query(
      `TRUNCATE
         lite_seed_workspace_claims,
         lite_seed_workspace_packages,
         lite_education_community_commands,
         lite_education_community_journey_heads,
         lite_education_community_journey_versions,
         lite_education_community_cohorts,
         lite_business_attribution_commands,
         lite_business_attribution_links,
         lite_outbound_contact_policy_commands,
         lite_outbound_contact_suppression_heads,
         lite_outbound_contact_suppression_versions,
         lite_outbound_contact_basis_heads,
         lite_outbound_contact_basis_versions
       CASCADE`
    );
  });

  afterAll(async () => database.close());

  it('durably binds one prepared package to the existing invitation activation lineage', async () => {
    const store = packages();
    const value = prepared('seed-workspace-package_agency-001');
    await expect(store.savePrepared(value)).resolves.toEqual(value);
    await expect(store.savePrepared(value)).resolves.toEqual(value);

    const token = 'seed-claim-token-agency-001';
    await invite(value.seedWorkspacePackageId, token, 'one');

    clock = '2026-09-21T01:00:00.000Z';
    const claims = new SeedWorkspaceClaimService(store, education());
    const command = {
      packageId: value.seedWorkspacePackageId,
      workspaceId: activatedWorkspaceId,
      actorPrincipalId: 'workspace-admin-001',
      idempotencyKey: 'claim-one',
      invitationClaimToken: token
    };
    const result = await claims.claim(command);
    expect(result.journey.stage).toBe('WORKSPACE_ACTIVATED');
    expect(result.claim).toMatchObject({
      seedWorkspacePackageId: value.seedWorkspacePackageId,
      educationCommunityJourneyId: result.journey.educationCommunityJourneyId,
      activatedWorkspaceId,
      claimedByPrincipalId: 'workspace-admin-001'
    });

    await expect(new SeedWorkspaceClaimService(store, education()).claim(command)).resolves.toEqual(
      result
    );

    await expect(
      store.readForWorkspace(campaignWorkspaceId, value.seedWorkspacePackageId)
    ).resolves.toEqual(value);
    await expect(
      store.readForWorkspace(activatedWorkspaceId, value.seedWorkspacePackageId)
    ).resolves.toEqual(value);
    await expect(
      store.readForWorkspace(otherWorkspaceId, value.seedWorkspacePackageId)
    ).resolves.toBeNull();

    await expect(
      store.bindClaim({
        package: value,
        journey: result.journey,
        workspaceId: activatedWorkspaceId,
        actorPrincipalId: 'different-admin'
      })
    ).rejects.toMatchObject({
      code: 'SEED_CLAIM_CONFLICT',
      status: 409
    });
  });

  it('fails closed on immutable package conflicts and expiry before activation', async () => {
    const store = packages();
    const value = prepared('seed-workspace-package_expiring-001', '2026-09-21T00:30:00.000Z');
    await store.savePrepared(value);
    const conflictBase: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'> = {
      ...value,
      target: { ...value.target, displayName: 'Different Agency' }
    };
    delete (conflictBase as Partial<SeedWorkspacePackageV1>).packageFingerprintSha256;
    await expect(
      store.savePrepared({
        ...conflictBase,
        packageFingerprintSha256: seedWorkspacePackageFingerprintSha256V1(conflictBase)
      })
    ).rejects.toMatchObject({ code: 'SEED_PACKAGE_CONFLICT', status: 409 });

    const token = 'seed-claim-token-expiring-001';
    const journeyId = await invite(value.seedWorkspacePackageId, token, 'expiring');
    clock = '2026-09-21T00:31:00.000Z';

    await expect(
      new SeedWorkspaceClaimService(store, education()).claim({
        packageId: value.seedWorkspacePackageId,
        workspaceId: activatedWorkspaceId,
        actorPrincipalId: 'workspace-admin-002',
        idempotencyKey: 'claim-expired',
        invitationClaimToken: token
      })
    ).rejects.toMatchObject({
      code: 'SEED_PACKAGE_EXPIRED',
      status: 409
    });
    await expect(education().current(journeyId)).resolves.toMatchObject({
      stage: 'INVITATION_PREPARED'
    });
  });
});
