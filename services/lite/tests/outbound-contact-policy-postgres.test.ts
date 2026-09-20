import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresOutboundContactPolicyStore } from '../src/outbound-contact-policy.js';
const url = process.env.LITE_OUTBOUND_CONTACT_TEST_DATABASE_URL;
const required = process.env.LITE_OUTBOUND_CONTACT_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('LITE_OUTBOUND_CONTACT_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111',
  otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const target = { owner: 'LITE', kind: 'PROSPECT', id: 'candidate_1', version: 3 };
const policyRef = { policyId: 'workspace-outreach-policy', version: 2 };
const endpoint = 'a'.repeat(64);
const send = 'b'.repeat(64);
suite('PostgreSQL outbound contact policy owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'outbound-contact-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_outbound_contact_test'
  });
  let tick = 0,
    id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 16, 0, 0, tick++)).toISOString();
  const store = () =>
    new PostgresOutboundContactPolicyStore(database, database.getPool(), now, () => `id${++id}`);
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
    await migrate(database.getPool(), 'lite_outbound_contact_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Outbound A','outbound-a'),($2,'Outbound B','outbound-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30000);
  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_outbound_contact_policy_commands,lite_outbound_contact_suppression_heads,lite_outbound_contact_suppression_versions,lite_outbound_contact_basis_heads,lite_outbound_contact_basis_versions CASCADE'
      );
  });
  afterAll(async () => database.close());
  const assertion = (key = 'basis-1', w = workspaceId) => ({
    workspaceId: w,
    actorPrincipalId: 'user_admin',
    idempotencyKey: key,
    targetRef: target,
    endpointFingerprintSha256: endpoint,
    purpose: 'PROSPECT_OUTREACH' as const,
    policyRef,
    basisState: 'ASSERTED_ALLOWED' as const,
    evidenceRefs: ['review:1']
  });
  it('replays exact basis writes across store restart, isolates Workspaces and conflicts on payload drift', async () => {
    const first = store();
    const command = assertion();
    const created = await first.assertBasis(command);
    expect(await store().assertBasis(command)).toEqual(created);
    expect(created.authorityConsequences).toEqual({
      legalConsentVerifiedByMarkOrbit: false,
      externalSendAuthorized: false,
      customerTruthMutated: false
    });
    await expect(
      first.assertBasis({ ...command, basisState: 'ASSERTED_BLOCKED' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const other = await first.assertBasis(assertion('basis-1', otherWorkspaceId));
    expect(other.workspaceId).toBe(otherWorkspaceId);
    const unknown = await first.evaluate({
      workspaceId: otherWorkspaceId,
      actorPrincipalId: 'reader',
      targetRef: { ...target, id: 'different' },
      endpointFingerprintSha256: endpoint,
      purpose: 'PROSPECT_OUTREACH',
      policyRef,
      reviewedSendFingerprintSha256: send
    });
    expect(unknown.outcome).toBe('UNKNOWN');
  });
  it('fails closed by default, allows only exact current reviewed basis, and makes active suppression win', async () => {
    const s = store();
    const before = await s.evaluate({
      workspaceId,
      actorPrincipalId: 'reader',
      targetRef: target,
      endpointFingerprintSha256: endpoint,
      purpose: 'PROSPECT_OUTREACH',
      policyRef,
      reviewedSendFingerprintSha256: send
    });
    expect(before).toMatchObject({
      outcome: 'UNKNOWN',
      reason: 'NO_CURRENT_ASSERTION',
      authorityConsequences: { protectedActionAuthorized: false, externalMessageSent: false }
    });
    await s.assertBasis(assertion());
    const ready = await store().evaluate({
      workspaceId,
      actorPrincipalId: 'reader',
      targetRef: target,
      endpointFingerprintSha256: endpoint,
      purpose: 'PROSPECT_OUTREACH',
      policyRef,
      reviewedSendFingerprintSha256: send
    });
    expect(ready.outcome).toBe('READY_FOR_HUMAN_SEND');
    const sameState = await store().evaluate({
      workspaceId,
      actorPrincipalId: 'reader',
      targetRef: target,
      endpointFingerprintSha256: endpoint,
      purpose: 'PROSPECT_OUTREACH',
      policyRef,
      reviewedSendFingerprintSha256: send
    });
    expect(sameState.readinessFingerprintSha256).toBe(ready.readinessFingerprintSha256);
    expect(sameState.evaluatedAt).not.toBe(ready.evaluatedAt);
    const suppression = await store().setSuppression({
      workspaceId,
      actorPrincipalId: 'user_admin',
      idempotencyKey: 'suppress-1',
      endpointFingerprintSha256: endpoint,
      scope: 'ALL_OUTBOUND',
      reasonCode: 'RECIPIENT_OPT_OUT',
      sourceClass: 'MANAGED_COMMUNICATION',
      evidenceRefs: ['message:optout']
    });
    expect(
      await store().evaluate({
        workspaceId,
        actorPrincipalId: 'reader',
        targetRef: target,
        endpointFingerprintSha256: endpoint,
        purpose: 'PROSPECT_OUTREACH',
        policyRef,
        reviewedSendFingerprintSha256: send
      })
    ).toMatchObject({ outcome: 'BLOCKED', reason: 'ACTIVE_SUPPRESSION' });
    await store().clearSuppression({
      workspaceId,
      actorPrincipalId: 'user_admin',
      idempotencyKey: 'clear-1',
      suppressionId: suppression.suppressionId,
      expectedVersion: suppression.version,
      sourceClass: 'WORKSPACE_USER',
      evidenceRefs: ['review:clear']
    });
    expect(
      (
        await store().evaluate({
          workspaceId,
          actorPrincipalId: 'reader',
          targetRef: target,
          endpointFingerprintSha256: endpoint,
          purpose: 'PROSPECT_OUTREACH',
          policyRef,
          reviewedSendFingerprintSha256: send
        })
      ).outcome
    ).toBe('READY_FOR_HUMAN_SEND');
  });
  it('fails closed after revocation and invalidates readiness fingerprints on policy/send drift', async () => {
    const s = store();
    const basis = await s.assertBasis(assertion());
    const first = await s.evaluate({
      workspaceId,
      actorPrincipalId: 'reader',
      targetRef: target,
      endpointFingerprintSha256: endpoint,
      purpose: 'PROSPECT_OUTREACH',
      policyRef,
      reviewedSendFingerprintSha256: send
    });
    const changedSend = await s.evaluate({
      workspaceId,
      actorPrincipalId: 'reader',
      targetRef: target,
      endpointFingerprintSha256: endpoint,
      purpose: 'PROSPECT_OUTREACH',
      policyRef,
      reviewedSendFingerprintSha256: 'c'.repeat(64)
    });
    expect(changedSend.readinessFingerprintSha256).not.toBe(first.readinessFingerprintSha256);
    expect(
      await s.evaluate({
        workspaceId,
        actorPrincipalId: 'reader',
        targetRef: target,
        endpointFingerprintSha256: endpoint,
        purpose: 'PROSPECT_OUTREACH',
        policyRef: { ...policyRef, version: 3 },
        reviewedSendFingerprintSha256: send
      })
    ).toMatchObject({ outcome: 'UNKNOWN', reason: 'POLICY_MISMATCH' });
    await s.revokeBasis({
      workspaceId,
      actorPrincipalId: 'user_admin',
      idempotencyKey: 'revoke-1',
      assertionId: basis.assertionId,
      expectedVersion: basis.version
    });
    expect(
      await s.evaluate({
        workspaceId,
        actorPrincipalId: 'reader',
        targetRef: target,
        endpointFingerprintSha256: endpoint,
        purpose: 'PROSPECT_OUTREACH',
        policyRef,
        reviewedSendFingerprintSha256: send
      })
    ).toMatchObject({ outcome: 'UNKNOWN', reason: 'ASSERTION_NOT_ACTIVE' });
  });
  it('persists SMS policy independently from EMAIL and keeps global suppression channel-scoped', async () => {
    const s = store();
    const smsBasis = await s.assertBasis({
      ...assertion('sms-basis'),
      channel: 'SMS',
      purpose: 'WORKSPACE_NOTIFICATION'
    });
    expect(smsBasis).toMatchObject({
      channel: 'SMS',
      purpose: 'WORKSPACE_NOTIFICATION',
      basisState: 'ASSERTED_ALLOWED'
    });
    expect(
      await store().evaluate({
        workspaceId,
        actorPrincipalId: 'reader',
        targetRef: target,
        endpointFingerprintSha256: endpoint,
        channel: 'SMS',
        purpose: 'WORKSPACE_NOTIFICATION',
        policyRef,
        reviewedSendFingerprintSha256: send
      })
    ).toMatchObject({
      channel: 'SMS',
      outcome: 'READY_FOR_HUMAN_SEND',
      authorityConsequences: {
        legalConsentVerifiedByMarkOrbit: false,
        externalMessageSent: false,
        protectedActionAuthorized: false
      }
    });

    await s.setSuppression({
      workspaceId,
      actorPrincipalId: 'user_admin',
      idempotencyKey: 'email-global',
      endpointFingerprintSha256: endpoint,
      channel: 'EMAIL',
      scope: 'ALL_OUTBOUND',
      reasonCode: 'WORKSPACE_DO_NOT_CONTACT',
      sourceClass: 'WORKSPACE_USER',
      evidenceRefs: ['review:email-global']
    });
    expect(await s.currentGlobalSuppressions(workspaceId, endpoint, 'SMS')).toHaveLength(0);

    await s.setSuppression({
      workspaceId,
      actorPrincipalId: 'user_admin',
      idempotencyKey: 'sms-global',
      endpointFingerprintSha256: endpoint,
      channel: 'SMS',
      scope: 'ALL_OUTBOUND',
      reasonCode: 'RECIPIENT_OPT_OUT',
      sourceClass: 'WORKSPACE_USER',
      evidenceRefs: ['review:sms-global']
    });
    expect(await store().currentGlobalSuppressions(workspaceId, endpoint, 'SMS')).toHaveLength(1);
    expect(
      await store().evaluate({
        workspaceId,
        actorPrincipalId: 'reader',
        targetRef: target,
        endpointFingerprintSha256: endpoint,
        channel: 'SMS',
        purpose: 'WORKSPACE_NOTIFICATION',
        policyRef,
        reviewedSendFingerprintSha256: send
      })
    ).toMatchObject({ outcome: 'BLOCKED', reason: 'ACTIVE_SUPPRESSION' });

    const rows = await database.getPool().query(
      `SELECT channel, document_json->>'channel' AS document_channel
         FROM lite_outbound_contact_basis_versions
        WHERE workspace_id=$1`,
      [workspaceId]
    );
    expect(rows.rows).toContainEqual({ channel: 'SMS', document_channel: 'SMS' });
  });

  it('normalizes omitted legacy channel to EMAIL for idempotent replay', async () => {
    const s = store();
    const legacy = assertion('legacy-default');
    const created = await s.assertBasis(legacy);
    expect(await store().assertBasis({ ...legacy, channel: 'EMAIL' })).toEqual(created);
    expect(created.channel).toBe('EMAIL');
  });

});
