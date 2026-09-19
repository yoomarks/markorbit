import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type { ChannelNotificationAutomationGovernanceEvidenceV1 } from '@markorbit/contracts/channel-notification-automation';
import {
  PostgresNotificationAutomationRuleStore,
  type NotificationAutomationGovernanceVerificationRequestV1,
  type NotificationAutomationGovernanceVerifierV1
} from '../src/notification-automation-rule.js';

const url = process.env.LITE_NOTIFICATION_AUTOMATION_TEST_DATABASE_URL;
const required = process.env.LITE_NOTIFICATION_AUTOMATION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_NOTIFICATION_AUTOMATION_TEST_DATABASE_URL is required when LITE_NOTIFICATION_AUTOMATION_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceA = '14141414-1414-4414-8414-141414141414';
const workspaceB = '15151515-1515-4515-8515-151515151515';

class ExactGovernanceVerifier implements NotificationAutomationGovernanceVerifierV1 {
  calls = 0;

  verify(
    request: Readonly<NotificationAutomationGovernanceVerificationRequestV1>
  ): Promise<Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>> {
    this.calls += 1;
    return Promise.resolve({
      owner: 'CORE',
      kind: 'GOVERNED_HUMAN_ACTION_RECEIPT',
      action: request.action,
      workspaceId: request.workspaceId,
      notificationRuleId: request.notificationRuleId,
      authorizedRuleVersion: request.candidateRuleVersion,
      authorizedRuleFingerprintSha256: request.candidateRuleFingerprintSha256,
      evidenceRef: request.governanceEvidenceRef,
      evidenceFingerprintSha256: request.action === 'ACTIVATE' ? 'a'.repeat(64) : 'b'.repeat(64),
      verifiedAt: '2026-09-19T09:59:00.000Z'
    });
  }
}

suite('PostgreSQL Notification Automation Rule owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-notification-automation-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_notification_automation_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 19, 10, 0, tick++)).toISOString();
  const ids = () =>
    `channel-notification-rule_test-${++id}` as `channel-notification-rule_${string}`;

  const create = (key: string, workspaceId = workspaceA) => ({
    workspaceId,
    actorPrincipalId: 'principal_rule_owner',
    idempotencyKey: key,
    triggerSelector: {
      owner: 'MARKREG',
      eventType: 'FORMAL_MATTER_STATUS_CHANGED',
      subjectKind: 'WORKSPACE_DIRECTORY_ENTRY'
    },
    content: {
      publishPackageId: 'publish-package_notification-test' as const,
      version: 2,
      fingerprintSha256: '1'.repeat(64)
    },
    senderProfile: {
      senderProfileId: 'email-sender-profile_notification-test' as const,
      version: 3,
      fingerprintSha256: '2'.repeat(64)
    },
    ratePolicyRef: 'notification-rate-policy_default'
  });

  function store(
    verifier: NotificationAutomationGovernanceVerifierV1 = new ExactGovernanceVerifier()
  ) {
    return new PostgresNotificationAutomationRuleStore(
      database,
      database.getPool(),
      verifier,
      now,
      ids
    );
  }

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_notification_automation_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
       ($1,'Notification A','notification-a'),
       ($2,'Notification B','notification-b')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceA, workspaceB]
    );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database.getPool().query(
      `TRUNCATE
         lite_notification_automation_rule_commands,
         lite_notification_automation_rule_heads,
         lite_notification_automation_rule_versions
       CASCADE`
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it('persists DRAFT creation, exact replay, history, and Workspace isolation', async () => {
    const first = store();
    const command = create('draft-a');
    const draft = await first.createDraft(command);

    expect(draft).toMatchObject({
      workspaceId: workspaceA,
      version: 1,
      status: 'DRAFT',
      createdByPrincipalId: 'principal_rule_owner'
    });
    expect(draft.authority.externalSendAuthorized).toBe(false);
    expect(draft.authority.protectedActionAuthorized).toBe(false);
    expect(await store().createDraft(command)).toEqual(draft);
    expect(await store().getExact(workspaceA, draft.notificationRuleId, 1)).toEqual(draft);
    expect(await store().getLatest(workspaceA, draft.notificationRuleId)).toEqual(draft);
    expect(await store().getLatest(workspaceB, draft.notificationRuleId)).toBeUndefined();

    const other = await first.createDraft(create('draft-a', workspaceB));
    expect(other.workspaceId).toBe(workspaceB);
    expect(other.notificationRuleId).not.toBe(draft.notificationRuleId);

    await expect(
      first.createDraft({
        ...command,
        ratePolicyRef: 'notification-rate-policy_changed'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('fails closed when activation has no governance verifier', async () => {
    const noVerifier = new PostgresNotificationAutomationRuleStore(
      database,
      database.getPool(),
      undefined,
      now,
      ids
    );
    const draft = await noVerifier.createDraft(create('no-verifier-draft'));

    await expect(
      noVerifier.activate({
        workspaceId: workspaceA,
        notificationRuleId: draft.notificationRuleId,
        expectedVersion: 1,
        actorPrincipalId: 'principal_activator',
        idempotencyKey: 'no-verifier-activate',
        governanceEvidenceRef: 'governed-human-action-receipt_activate'
      })
    ).rejects.toMatchObject({ code: 'GOVERNANCE_VERIFIER_UNAVAILABLE' });

    expect((await noVerifier.getLatest(workspaceA, draft.notificationRuleId))?.status).toBe(
      'DRAFT'
    );
  });

  it('activates only with exact verified human-action evidence and replays without re-verifying', async () => {
    const verifier = new ExactGovernanceVerifier();
    const service = store(verifier);
    const draft = await service.createDraft(create('activate-draft'));
    const command = {
      workspaceId: workspaceA,
      notificationRuleId: draft.notificationRuleId,
      expectedVersion: 1,
      actorPrincipalId: 'principal_activator',
      idempotencyKey: 'activate-rule',
      governanceEvidenceRef: 'governed-human-action-receipt_activate'
    };
    const active = await service.activate(command);

    expect(active).toMatchObject({
      version: 2,
      status: 'ACTIVE',
      updatedByPrincipalId: 'principal_activator'
    });
    expect(active.activationEvidence).toMatchObject({
      action: 'ACTIVATE',
      authorizedRuleVersion: 2,
      authorizedRuleFingerprintSha256: active.spec.ruleFingerprintSha256
    });
    expect(active.spec.content).toEqual(draft.spec.content);
    expect(active.spec.senderProfile).toEqual(draft.spec.senderProfile);
    expect(active.spec.ruleFingerprintSha256).not.toBe(draft.spec.ruleFingerprintSha256);
    expect(verifier.calls).toBe(1);

    expect(await store(verifier).activate(command)).toEqual(active);
    expect(verifier.calls).toBe(1);
  });

  it('keeps immutable ACTIVE/SUSPENDED/ACTIVE/REVOKED history with fresh governance evidence', async () => {
    const verifier = new ExactGovernanceVerifier();
    const service = store(verifier);
    const draft = await service.createDraft(create('lifecycle-draft'));
    const active = await service.activate({
      workspaceId: workspaceA,
      notificationRuleId: draft.notificationRuleId,
      expectedVersion: 1,
      actorPrincipalId: 'principal_activator',
      idempotencyKey: 'lifecycle-activate-1',
      governanceEvidenceRef: 'governed-human-action-receipt_activate-1'
    });
    const suspended = await service.suspend({
      workspaceId: workspaceA,
      notificationRuleId: draft.notificationRuleId,
      expectedVersion: 2,
      actorPrincipalId: 'principal_operator',
      idempotencyKey: 'lifecycle-suspend'
    });
    const resumed = await service.activate({
      workspaceId: workspaceA,
      notificationRuleId: draft.notificationRuleId,
      expectedVersion: 3,
      actorPrincipalId: 'principal_activator',
      idempotencyKey: 'lifecycle-activate-2',
      governanceEvidenceRef: 'governed-human-action-receipt_activate-2'
    });
    const revoked = await service.revoke({
      workspaceId: workspaceA,
      notificationRuleId: draft.notificationRuleId,
      expectedVersion: 4,
      actorPrincipalId: 'principal_revoker',
      idempotencyKey: 'lifecycle-revoke',
      governanceEvidenceRef: 'governed-human-action-receipt_revoke'
    });

    expect([draft.status, active.status, suspended.status, resumed.status, revoked.status]).toEqual(
      ['DRAFT', 'ACTIVE', 'SUSPENDED', 'ACTIVE', 'REVOKED']
    );
    expect(suspended.activationEvidence).toEqual(active.activationEvidence);
    expect(resumed.activationEvidence?.authorizedRuleVersion).toBe(4);
    expect(revoked.revocationEvidence).toMatchObject({
      action: 'REVOKE',
      authorizedRuleVersion: 5,
      authorizedRuleFingerprintSha256: revoked.spec.ruleFingerprintSha256
    });
    expect(await service.getExact(workspaceA, draft.notificationRuleId, 2)).toEqual(active);
    expect(await service.getExact(workspaceA, draft.notificationRuleId, 3)).toEqual(suspended);
    expect(await service.getExact(workspaceA, draft.notificationRuleId, 4)).toEqual(resumed);
    expect(await service.getExact(workspaceA, draft.notificationRuleId, 5)).toEqual(revoked);

    await expect(
      service.activate({
        workspaceId: workspaceA,
        notificationRuleId: draft.notificationRuleId,
        expectedVersion: 5,
        actorPrincipalId: 'principal_activator',
        idempotencyKey: 'revoked-reactivate',
        governanceEvidenceRef: 'governed-human-action-receipt_activate-after-revoke'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('prevents two ACTIVE rules from owning the exact same notification intent', async () => {
    const service = store();
    const left = await service.createDraft(create('intent-left'));
    const right = await service.createDraft(create('intent-right'));

    await service.activate({
      workspaceId: workspaceA,
      notificationRuleId: left.notificationRuleId,
      expectedVersion: 1,
      actorPrincipalId: 'principal_activator',
      idempotencyKey: 'intent-left-activate',
      governanceEvidenceRef: 'governed-human-action-receipt_left'
    });
    await expect(
      service.activate({
        workspaceId: workspaceA,
        notificationRuleId: right.notificationRuleId,
        expectedVersion: 1,
        actorPrincipalId: 'principal_activator',
        idempotencyKey: 'intent-right-activate',
        governanceEvidenceRef: 'governed-human-action-receipt_right'
      })
    ).rejects.toMatchObject({ code: 'ACTIVE_INTENT_CONFLICT' });

    expect(await service.listLatest(workspaceA, { status: 'ACTIVE' })).toHaveLength(1);
    expect((await service.getLatest(workspaceA, right.notificationRuleId))?.status).toBe('DRAFT');
  });

  it('rejects stale transitions and raw-email-like durable references', async () => {
    const service = store();
    const draft = await service.createDraft(create('stale-draft'));
    await service.activate({
      workspaceId: workspaceA,
      notificationRuleId: draft.notificationRuleId,
      expectedVersion: 1,
      actorPrincipalId: 'principal_activator',
      idempotencyKey: 'stale-activate',
      governanceEvidenceRef: 'governed-human-action-receipt_stale'
    });

    await expect(
      service.suspend({
        workspaceId: workspaceA,
        notificationRuleId: draft.notificationRuleId,
        expectedVersion: 1,
        actorPrincipalId: 'principal_operator',
        idempotencyKey: 'stale-suspend'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    await expect(
      service.createDraft({
        ...create('raw-email'),
        ratePolicyRef: 'person@example.com'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('fails closed on persisted column drift and command-replay drift', async () => {
    const service = store();
    const command = create('integrity-draft');
    const draft = await service.createDraft(command);

    await database.getPool().query(
      `UPDATE lite_notification_automation_rule_versions
          SET trigger_event_type='TAMPERED_EVENT'
        WHERE workspace_id=$1 AND notification_rule_id=$2 AND version=1`,
      [workspaceA, draft.notificationRuleId]
    );

    await expect(service.getExact(workspaceA, draft.notificationRuleId, 1)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE'
    });
    await expect(service.createDraft(command)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE'
    });
  });

  it('keeps the persistence schema reference-only for endpoint/message/provider material', async () => {
    const columns = await database.getPool().query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name IN (
            'lite_notification_automation_rule_versions',
            'lite_notification_automation_rule_heads',
            'lite_notification_automation_rule_commands'
          )
        ORDER BY column_name`
    );
    const names = columns.rows.map((row) => row.column_name);
    expect(
      names.some((name) => /recipient|email_address|message_body|credential|secret/iu.test(name))
    ).toBe(false);
    expect(names).toContain('publish_package_fingerprint_sha256');
    expect(names).toContain('sender_profile_fingerprint_sha256');
    expect(names).toContain('rule_fingerprint_sha256');
  });
});
