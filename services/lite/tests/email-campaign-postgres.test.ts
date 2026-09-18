import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noEmailCampaignAuthorityConsequencesV1,
  type CampaignAudienceSnapshotV1,
  type CampaignBrandProjectionV1,
  type CampaignContentProjectionV1,
  type CampaignReviewDecisionV1,
  type EmailCampaignV1
} from '@markorbit/contracts/email-campaign';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresEmailCampaignStore } from '../src/email-campaign.js';

const url = process.env.LITE_EMAIL_CAMPAIGN_TEST_DATABASE_URL;
const required = process.env.LITE_EMAIL_CAMPAIGN_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_EMAIL_CAMPAIGN_TEST_DATABASE_URL is required when LITE_EMAIL_CAMPAIGN_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceA = '14141414-1414-4414-8414-141414141414';
const workspaceB = '15151515-1515-4515-8515-151515151515';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);
const hashE = 'e'.repeat(64);

function audience(workspaceId = workspaceA): CampaignAudienceSnapshotV1 {
  return {
    schemaVersion: 1,
    audienceSnapshotId: 'campaign-audience_test',
    workspaceId,
    version: 1,
    channel: 'EMAIL',
    reviewedSendFingerprintSha256: hashC,
    entries: [
      {
        targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'prospect_01', version: 2 },
        endpointFingerprintSha256: hashB,
        purpose: 'PROSPECT_OUTREACH',
        policyRef: { policyId: 'policy_us-b2b', version: 2 },
        readiness: {
          evaluatedAt: '2026-09-18T09:10:00.000Z',
          readinessFingerprintSha256: hashD,
          reviewedSendFingerprintSha256: hashC,
          outcome: 'READY_FOR_HUMAN_SEND',
          reason: 'CURRENT_ALLOWED_ASSERTION',
          basisAssertionRef: {
            assertionId: 'outbound-contact-basis_prospect-01',
            version: 1
          },
          suppressionRefs: []
        }
      }
    ],
    audienceFingerprintSha256: hashA,
    capturedAt: '2026-09-18T09:11:00.000Z',
    legalConsentVerifiedByMarkOrbit: false,
    externalSendAuthorized: false
  };
}

function content(workspaceId = workspaceA): CampaignContentProjectionV1 {
  return {
    schemaVersion: 1,
    contentProjectionId: 'campaign-content_test',
    workspaceId,
    version: 1,
    publishPackageRef: {
      publishPackageId: 'publish-package_campaign-test',
      version: 3,
      fingerprintSha256: hashA
    },
    subject: 'Reviewed campaign subject',
    preheader: 'Bounded preheader',
    reviewedSendFingerprintSha256: hashC,
    bodyOwnedByPublishPackage: true,
    projectionFingerprintSha256: hashB,
    createdAt: '2026-09-18T09:12:00.000Z',
    externalSendAuthorized: false
  };
}

function brand(workspaceId = workspaceA): CampaignBrandProjectionV1 {
  return {
    schemaVersion: 1,
    brandProjectionId: 'campaign-brand_test',
    workspaceId,
    version: 1,
    source: {
      kind: 'SITE_CONFIGURATION',
      siteId: 'site_agency-test',
      configurationVersion: 4,
      sourceRef: 'site-config:agency-test:4'
    },
    presentation: {
      displayName: 'Agency Brand',
      logoAssetRef: 'asset_logo-test',
      primaryColor: '#111111',
      accentColor: '#eeeeee',
      colorMode: 'LIGHT'
    },
    brandProjectionFingerprintSha256: hashD,
    capturedAt: '2026-09-18T09:13:00.000Z',
    canonicalWorkspaceBrandCreated: false
  };
}

function campaign(
  workspaceId = workspaceA,
  version = 1,
  overrides: Partial<
    Pick<EmailCampaignV1, 'status' | 'campaignFingerprintSha256' | 'updatedAt'>
  > = {}
): EmailCampaignV1 {
  return {
    schemaVersion: 1,
    campaignId: 'email-campaign_test',
    workspaceId,
    version,
    featureKey: 'EMAIL_CAMPAIGN',
    purpose: 'PROSPECT_OUTREACH',
    audience: {
      audienceSnapshotId: 'campaign-audience_test',
      version: 1,
      fingerprintSha256: hashA
    },
    content: {
      contentProjectionId: 'campaign-content_test',
      version: 1,
      fingerprintSha256: hashB
    },
    brand: {
      brandProjectionId: 'campaign-brand_test',
      version: 1,
      fingerprintSha256: hashD
    },
    campaignFingerprintSha256:
      overrides.campaignFingerprintSha256 ?? (version === 1 ? hashA : hashE),
    status: overrides.status ?? 'READY_FOR_HUMAN_REVIEW',
    humanReviewRequired: true,
    createdAt: '2026-09-18T09:14:00.000Z',
    updatedAt:
      overrides.updatedAt ??
      (version === 1 ? '2026-09-18T09:14:00.000Z' : '2026-09-18T10:14:00.000Z'),
    authority: noEmailCampaignAuthorityConsequencesV1
  };
}

function review(workspaceId = workspaceA): CampaignReviewDecisionV1 {
  return {
    schemaVersion: 1,
    campaignReviewDecisionId: 'campaign-review_test',
    workspaceId,
    version: 1,
    campaign: { campaignId: 'email-campaign_test', version: 1 },
    expectedCampaignFingerprintSha256: hashA,
    outcome: 'APPROVED_FOR_DELIVERY_PREPARATION',
    reviewerPrincipalId: 'principal_01',
    rationale: 'Reviewed audience, content and brand projection.',
    reviewedAt: '2026-09-18T09:15:00.000Z',
    deliveryPreparationOnly: true,
    authority: noEmailCampaignAuthorityConsequencesV1
  };
}

suite('PostgreSQL Email Campaign preparation owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-email-campaign-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_email_campaign_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 8, 18, 12, tick++)).toISOString();

  function store() {
    return new PostgresEmailCampaignStore(database, database.getPool(), now);
  }

  async function savePreparation(service: PostgresEmailCampaignStore, workspaceId = workspaceA) {
    const a = audience(workspaceId);
    const c = content(workspaceId);
    const b = brand(workspaceId);
    const cp = campaign(workspaceId);
    await service.saveAudienceSnapshot({
      value: a,
      expectedVersion: 0,
      idempotencyKey: `audience-${workspaceId}`
    });
    await service.saveContentProjection({
      value: c,
      expectedVersion: 0,
      idempotencyKey: `content-${workspaceId}`
    });
    await service.saveBrandProjection({
      value: b,
      expectedVersion: 0,
      idempotencyKey: `brand-${workspaceId}`
    });
    await service.saveCampaign({
      value: cp,
      expectedVersion: 0,
      idempotencyKey: `campaign-${workspaceId}`
    });
    return { a, c, b, cp };
  }

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_email_campaign_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Campaign A','campaign-a'),
       ($2,'Campaign B','campaign-b')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceA, workspaceB]
    );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query(
      `TRUNCATE
         lite_campaign_commands,
         lite_campaign_review_decision_versions,
         lite_email_campaign_versions,
         lite_campaign_brand_projection_versions,
         lite_campaign_content_projection_versions,
         lite_campaign_audience_snapshot_versions
       CASCADE`
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it('survives store reconstruction with the exact reviewed Campaign aggregate', async () => {
    const first = store();
    const prepared = await savePreparation(first);
    const approved = review();
    await first.saveReviewDecision({
      value: approved,
      expectedVersion: 0,
      idempotencyKey: 'review-a'
    });

    const restarted = store();
    const aggregate = await restarted.loadReviewedAggregate(
      workspaceA,
      prepared.cp.campaignId,
      1,
      approved.campaignReviewDecisionId,
      1
    );

    expect(aggregate).toEqual({
      campaign: prepared.cp,
      audience: prepared.a,
      content: prepared.c,
      brand: prepared.b,
      review: approved
    });
    expect(
      Object.values(aggregate.campaign.authority).every((value) => value === false)
    ).toBe(true);
    expect(aggregate.review.deliveryPreparationOnly).toBe(true);
    expect(aggregate.review.authority.externalSendAuthorized).toBe(false);
  });

  it('replays identical commands and rejects idempotency reuse with changed input', async () => {
    const service = store();
    const value = audience();
    const command = { value, expectedVersion: 0, idempotencyKey: 'audience-replay' };
    const created = await service.saveAudienceSnapshot(command);
    expect(await store().saveAudienceSnapshot(command)).toEqual(created);

    await expect(
      service.saveAudienceSnapshot({
        value: { ...value, audienceFingerprintSha256: hashE },
        expectedVersion: 0,
        idempotencyKey: 'audience-replay'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('appends Campaign v2 while preserving the exact reviewed v1 history', async () => {
    const service = store();
    const prepared = await savePreparation(service);
    const approved = review();
    await service.saveReviewDecision({
      value: approved,
      expectedVersion: 0,
      idempotencyKey: 'review-v1'
    });

    const second = campaign(workspaceA, 2, {
      status: 'CHANGES_REQUIRED',
      campaignFingerprintSha256: hashE,
      updatedAt: '2026-09-18T10:14:00.000Z'
    });
    await service.saveCampaign({
      value: second,
      expectedVersion: 1,
      idempotencyKey: 'campaign-v2'
    });

    const restarted = store();
    expect(await restarted.getLatestCampaign(workspaceA, second.campaignId)).toEqual(second);
    expect(await restarted.getCampaignVersion(workspaceA, second.campaignId, 1)).toEqual(
      prepared.cp
    );
    const historical = await restarted.loadReviewedAggregate(
      workspaceA,
      prepared.cp.campaignId,
      1,
      approved.campaignReviewDecisionId,
      1
    );
    expect(historical.campaign).toEqual(prepared.cp);
    expect(historical.review).toEqual(approved);
  });

  it('isolates exact identities and idempotency keys by Workspace', async () => {
    await savePreparation(store(), workspaceA);
    await savePreparation(store(), workspaceB);

    expect((await store().getLatestCampaign(workspaceA, 'email-campaign_test')).workspaceId).toBe(
      workspaceA
    );
    expect((await store().getLatestCampaign(workspaceB, 'email-campaign_test')).workspaceId).toBe(
      workspaceB
    );

    await expect(
      store().getCampaignVersion(
        '16161616-1616-4616-8616-161616161616',
        'email-campaign_test',
        1
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists latest Campaign heads deterministically without leaking old versions', async () => {
    const service = store();
    await savePreparation(service);
    const second = campaign(workspaceA, 2, {
      status: 'REVIEWED_READY_FOR_DELIVERY_PREPARATION',
      campaignFingerprintSha256: hashE
    });
    await service.saveCampaign({
      value: second,
      expectedVersion: 1,
      idempotencyKey: 'campaign-list-v2'
    });

    expect(await service.listLatestCampaigns(workspaceA)).toEqual([second]);
    expect(
      await service.listLatestCampaigns(workspaceA, {
        statuses: ['READY_FOR_HUMAN_REVIEW']
      })
    ).toEqual([]);
    expect(
      await service.listLatestCampaigns(workspaceA, {
        statuses: ['REVIEWED_READY_FOR_DELIVERY_PREPARATION']
      })
    ).toEqual([second]);
  });

  it('fails closed when queryable Campaign columns drift from document_json', async () => {
    const service = store();
    const prepared = await savePreparation(service);
    await database
      .getPool()
      .query(
        `UPDATE lite_email_campaign_versions
            SET campaign_fingerprint_sha256=$1
          WHERE workspace_id=$2 AND campaign_id=$3 AND version=1`,
        [hashE, workspaceA, prepared.cp.campaignId]
      );

    await expect(
      service.getCampaignVersion(workspaceA, prepared.cp.campaignId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('rejects raw email material before Audience persistence', async () => {
    const value = audience();
    const unsafe: CampaignAudienceSnapshotV1 = {
      ...value,
      entries: [
        {
          ...value.entries[0],
          targetRef: { ...value.entries[0].targetRef, id: 'person@example.com' }
        }
      ]
    };

    await expect(
      store().saveAudienceSnapshot({
        value: unsafe,
        expectedVersion: 0,
        idempotencyKey: 'unsafe-audience'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    const count = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_campaign_audience_snapshot_versions');
    expect((count.rows[0] as { count: number }).count).toBe(0);
  });

  it('rejects a Review whose fingerprint does not bind the exact persisted Campaign', async () => {
    await savePreparation(store());
    await expect(
      store().saveReviewDecision({
        value: { ...review(), expectedCampaignFingerprintSha256: hashE },
        expectedVersion: 0,
        idempotencyKey: 'review-mismatch'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
