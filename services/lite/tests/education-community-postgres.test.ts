import { createHash } from 'node:crypto';
import path from 'node:path';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresBusinessAttributionStore } from '../src/business-attribution.js';
import {
  EducationCommunityService,
  PostgresEducationCommunityWorkItemReader
} from '../src/education-community.js';
import { PostgresLiteWorkItemStore } from '../src/lite-work-item.js';
import { PostgresOutboundContactPolicyStore } from '../src/outbound-contact-policy.js';

const url = process.env.LITE_EDUCATION_COMMUNITY_TEST_DATABASE_URL;
const required = process.env.LITE_EDUCATION_COMMUNITY_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('LITE_EDUCATION_COMMUNITY_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const campaignWorkspaceId = '11111111-1111-4111-8111-111111111111';
const activatedWorkspaceId = '22222222-2222-4222-8222-222222222222';
const endpoint = 'a'.repeat(64);
const claim = 'opaque-claim-token-1226';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}
function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

suite('PostgreSQL education/community acquisition journey', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'education-community-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_education_community_test'
  });
  let id = 0;
  let clock = '2026-09-17T00:00:00.000Z';
  const now = () => clock;
  const outbound = () =>
    new PostgresOutboundContactPolicyStore(
      database,
      database.getPool(),
      now,
      () => `education${++id}`
    );
  const attribution = () =>
    new PostgresBusinessAttributionStore(
      database,
      database.getPool(),
      now,
      () => `education${++id}`
    );
  const workItems = () =>
    new PostgresLiteWorkItemStore(
      database,
      database.getPool(),
      now,
      () => `lite-work-item_education${++id}`
    );
  const service = () =>
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
      () => `education${++id}`
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
    await migrate(database.getPool(), 'lite_education_community_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Campaign','campaign'),($2,'Activated','activated') ON CONFLICT(workspace_id) DO NOTHING`,
        [campaignWorkspaceId, activatedWorkspaceId]
      );
  }, 30_000);
  beforeEach(async () => {
    id = 0;
    clock = '2026-09-17T00:00:00.000Z';
    await database
      .getPool()
      .query(
        'TRUNCATE lite_education_community_commands,lite_education_community_journey_heads,lite_education_community_journey_versions,lite_education_community_cohorts,lite_business_attribution_commands,lite_business_attribution_links,lite_outbound_contact_policy_commands,lite_outbound_contact_suppression_heads,lite_outbound_contact_suppression_versions,lite_outbound_contact_basis_heads,lite_outbound_contact_basis_versions,lite_work_item_commands,lite_work_items CASCADE'
      );
  });
  afterAll(async () => database.close());

  it('preserves source through governed invitation, real first value and seven-day retained use after restart', async () => {
    const s = service();
    const cohort = await s.createCohort({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: 'cohort',
      name: 'Founder clinic',
      source: {
        owner: 'EVENTS',
        kind: 'LIVE_CLINIC',
        id: 'clinic_2026-09',
        version: 1,
        fingerprintSha256: 'b'.repeat(64),
        observedAt: clock
      }
    });
    const registered = await s.register({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: 'register',
      cohortId: cohort.educationCommunityCohortId,
      participantRef: 'registrant_opaque-1',
      endpointFingerprintSha256: endpoint
    });

    const policyRef = { policyId: 'education-invitation-policy', version: 1 };
    await outbound().assertBasis({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: 'basis',
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
      evidenceRefs: ['registration:reviewed-without-inferred-consent']
    });
    const invited = await s.prepareInvitation({
      workspaceId: campaignWorkspaceId,
      actorPrincipalId: 'growth_admin',
      idempotencyKey: 'invite',
      journeyId: registered.educationCommunityJourneyId,
      expectedVersion: 1,
      invitationClaimToken: claim,
      policyRef,
      reviewedSendFingerprintSha256: 'd'.repeat(64)
    });
    expect(invited.invitation?.readiness.outcome).toBe('READY_FOR_HUMAN_SEND');
    expect(invited.authorityConsequences.externalInvitationSent).toBe(false);

    clock = '2026-09-18T00:00:00.000Z';
    const activated = await service().activate({
      workspaceId: activatedWorkspaceId,
      actorPrincipalId: 'new_workspace_admin',
      idempotencyKey: 'activate',
      invitationClaimToken: claim
    });
    expect(activated.stage).toBe('WORKSPACE_ACTIVATED');

    clock = '2026-09-18T01:00:00.000Z';
    const firstItem = await workItems().createManual({
      workspaceId: activatedWorkspaceId,
      actorPrincipalId: 'new_workspace_admin',
      idempotencyKey: 'first-item',
      taskType: 'GENERAL_FOLLOW_UP',
      title: 'Create first trademark work item',
      priority: 'NOTICE'
    });
    const first = await service().recordFirstValue({
      workspaceId: activatedWorkspaceId,
      actorPrincipalId: 'new_workspace_admin',
      idempotencyKey: 'first-value',
      journeyId: registered.educationCommunityJourneyId,
      expectedVersion: 3,
      workItem: {
        id: firstItem.liteWorkItemId,
        version: firstItem.version,
        fingerprintSha256: digest(firstItem)
      }
    });
    expect(first.stage).toBe('FIRST_VALUE_RECORDED');

    clock = '2026-09-25T01:00:00.000Z';
    const retainedItem = await workItems().createManual({
      workspaceId: activatedWorkspaceId,
      actorPrincipalId: 'new_workspace_admin',
      idempotencyKey: 'retained-item',
      taskType: 'GENERAL_FOLLOW_UP',
      title: 'Continue trademark work',
      priority: 'NOTICE'
    });
    const retainedCommand = {
      workspaceId: activatedWorkspaceId,
      actorPrincipalId: 'new_workspace_admin',
      idempotencyKey: 'retained-use',
      journeyId: registered.educationCommunityJourneyId,
      expectedVersion: 4,
      workItem: {
        id: retainedItem.liteWorkItemId,
        version: retainedItem.version,
        fingerprintSha256: digest(retainedItem)
      }
    };
    const retained = await service().recordRetainedUse(retainedCommand);
    expect(retained).toMatchObject({
      stage: 'RETAINED',
      acquisitionAttribution: { version: 1 },
      authorityConsequences: {
        marketingConsentInferred: false,
        partnerQualified: false,
        distributorActivated: false,
        mgsnProviderEnrolled: false
      }
    });
    await expect(service().recordRetainedUse(retainedCommand)).resolves.toEqual(retained);
    await expect(service().current(retained.educationCommunityJourneyId)).resolves.toEqual(
      retained
    );
    await expect(
      attribution().find(activatedWorkspaceId, retained.acquisitionAttribution!.id)
    ).resolves.toMatchObject({
      motionKind: 'EDUCATION_COMMUNITY',
      evidenceBasis: 'HUMAN_CONFIRMED',
      sourceRefs: [
        { owner: 'EVENTS', kind: 'LIVE_CLINIC', id: 'clinic_2026-09' },
        { owner: 'LITE', kind: 'EDUCATION_COMMUNITY_COHORT' }
      ],
      downstreamRef: {
        owner: 'CORE',
        kind: 'WORKSPACE_ACTIVATION',
        id: activatedWorkspaceId
      }
    });
    const stored = await database
      .getPool()
      .query<{ document: string }>(
        'SELECT document_json::text AS document FROM lite_education_community_journey_versions ORDER BY version'
      );
    const storedDocuments = stored.rows.map((row) => String(row.document)).join('\n');
    expect(storedDocuments).not.toContain(claim);
    expect(storedDocuments).not.toContain('@');
  });
});
