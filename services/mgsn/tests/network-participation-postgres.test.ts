import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  ChangeNetworkParticipationStateCommandV1,
  NetworkParticipationSnapshotV1,
  OptInNetworkParticipationCommandV1,
  ReplaceVisibilityPolicyCommandV1
} from '@markorbit/contracts/network-participation';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresNetworkParticipationRepository } from '../src/network-participation-postgres.js';
import {
  NetworkParticipationService,
  type NetworkParticipationCommit,
  type NetworkParticipationPrincipal
} from '../src/network-participation.js';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_NETWORK_PARTICIPATION_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_NETWORK_PARTICIPATION_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const providerId = 'provider_network_449' as const;
const actorId = 'user_network_owner' as const;
const principal: NetworkParticipationPrincipal = { workspaceId, actorId };
const at = '2026-09-01T01:00:00.000Z';

suite('MGSN P0 #449 durable Network Participation', () => {
  const namespace = 'mgsn_network_participation_449_test';
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
  let participationSequence = 0;
  const repository = () => new PostgresNetworkParticipationRepository(database, database.getPool());
  const service = () =>
    new NetworkParticipationService(
      repository(),
      new PostgresProviderRegistryRepository(database, database.getPool()),
      () => at,
      () => `network-participation_449_${++participationSequence}`
    );
  const optIn = (
    overrides: Partial<OptInNetworkParticipationCommandV1> = {}
  ): OptInNetworkParticipationCommandV1 => ({
    schemaVersion: 1,
    providerId,
    authorizationReference: 'authorization:owner-opt-in',
    reason: 'Provider Workspace owner explicitly joins the network.',
    idempotencyKey: 'opt-in-449',
    correlationId: 'correlation_network_449',
    ...overrides
  });
  const state = (
    current: Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }>,
    action: 'PAUSE' | 'RESUME' | 'REVOKE',
    key = action.toLowerCase()
  ): ChangeNetworkParticipationStateCommandV1 => ({
    schemaVersion: 1,
    action,
    networkParticipationId: current.networkParticipationId,
    providerId,
    expectedParticipationVersion: current.participationVersion,
    expectedVisibilityPolicyVersion: current.visibilityPolicy.version,
    authorizationReference: `authorization:${key}`,
    reason: `${action} is explicitly reviewed by the Provider Workspace owner.`,
    idempotencyKey: key,
    correlationId: `correlation_${key}`
  });
  const visible = (
    current: Exclude<NetworkParticipationSnapshotV1, { networkParticipationId: null }>,
    key = 'visibility-expand'
  ): ReplaceVisibilityPolicyCommandV1 => ({
    schemaVersion: 1,
    networkParticipationId: current.networkParticipationId,
    providerId,
    expectedParticipationVersion: current.participationVersion,
    expectedVisibilityPolicyVersion: current.visibilityPolicy.version,
    replacement: {
      scope: 'BOUNDED_PUBLIC',
      grants: [
        {
          dataClass: 'SUPPLY_PROFILE',
          fields: ['serviceTypes'],
          scope: 'BOUNDED_PUBLIC',
          audience: { kind: 'BOUNDED_NETWORK' },
          purpose: 'PROVIDER_DISCOVERY',
          authorityReferences: ['authorization:bounded-network']
        }
      ]
    },
    authorizationReference: 'authorization:visibility-reviewed',
    reason: 'Owner reviewed the exact bounded discovery projection.',
    idempotencyKey: key,
    correlationId: `correlation_${key}`
  });

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
    participationSequence = 0;
    await database.getPool().query(
      `TRUNCATE
         mgsn_network_participation_audit,
         mgsn_network_participation_commands,
         mgsn_network_visibility_policies,
         mgsn_network_participations,
         mgsn_provider_registry_audit,
         mgsn_provider_registry_commands,
         mgsn_provider_supply_capabilities,
         mgsn_providers
       RESTART IDENTITY CASCADE`
    );
    const provider = {
      providerId,
      providerWorkspaceId: workspaceId,
      displayName: 'Network Provider 449',
      operationalStatus: 'ACTIVE',
      version: 1,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: at,
      updatedAt: at
    };
    await database
      .getPool()
      .query(
        'INSERT INTO mgsn_providers(provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$7,$8,$8)',
        [
          provider.providerId,
          provider.providerWorkspaceId,
          provider.displayName,
          provider.operationalStatus,
          provider.version,
          JSON.stringify(provider),
          actorId,
          at
        ]
      );
  });

  afterAll(() => database.close());

  it('is restart-safe across no-row, ACTIVE, PAUSED, REVOKED, and fresh PRIVATE rejoin', async () => {
    expect(await service().read(principal, providerId)).toMatchObject({
      state: 'NOT_PARTICIPATING',
      visibilityPolicy: { scope: 'PRIVATE', grants: [] }
    });
    const active = (await service().optIn(principal, optIn())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    expect(await service().read(principal, providerId)).toEqual(active);
    const paused = (await service().changeState(
      principal,
      state(active, 'PAUSE')
    )) as typeof active;
    expect(await service().read(principal, providerId)).toEqual(paused);
    const revoked = (await service().changeState(
      principal,
      state(paused, 'REVOKE')
    )) as typeof active;
    expect(await service().read(principal, providerId)).toEqual(revoked);
    await expect(
      database.getPool().query(
        `INSERT INTO mgsn_network_participations(network_participation_id,version,is_current,workspace_id,provider_id,state,authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at)
         VALUES($1,4,false,$2,$3,'ACTIVE','authorization:invalid-revival','Invalid revival.',$4,'correlation_invalid_revival',$5,$5)`,
        [revoked.networkParticipationId, workspaceId, providerId, actorId, at]
      )
    ).rejects.toThrow(/cannot be revived/);
    const rejoined = (await service().optIn(
      principal,
      optIn({ idempotencyKey: 'fresh-rejoin' })
    )) as typeof active;
    expect(rejoined.networkParticipationId).not.toBe(revoked.networkParticipationId);
    expect(rejoined).toMatchObject({
      participationVersion: 1,
      state: 'ACTIVE',
      visibilityPolicy: { version: 1, scope: 'PRIVATE', grants: [] }
    });
    expect(
      await repository().listParticipationHistory(revoked.networkParticipationId)
    ).toHaveLength(3);
  });

  it('keeps Participation and policy version lineages independent and contracts visibility durably', async () => {
    const active = (await service().optIn(principal, optIn())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const expanded = (await service().replaceVisibilityPolicy(
      principal,
      visible(active)
    )) as typeof active;
    expect(expanded.participationVersion).toBe(1);
    expect(expanded.visibilityPolicy).toMatchObject({ version: 2, scope: 'BOUNDED_PUBLIC' });
    const contracted = await service().replaceVisibilityPolicy(principal, {
      ...visible(expanded, 'visibility-contract'),
      replacement: { scope: 'PRIVATE', grants: [] }
    });
    expect(await service().read(principal, providerId)).toEqual(contracted);
    expect(contracted).toMatchObject({
      participationVersion: 1,
      visibilityPolicy: { version: 3, scope: 'PRIVATE', grants: [] }
    });
    expect(
      (await repository().listVisibilityPolicyHistory(active.networkParticipationId)).map(
        (policy) => policy.scope
      )
    ).toEqual(['PRIVATE', 'BOUNDED_PUBLIC', 'PRIVATE']);
  });

  it('serializes same-key exact replay and rejects a changed concurrent fingerprint', async () => {
    const exact = await Promise.all([
      service().optIn(principal, optIn({ idempotencyKey: 'same-exact' })),
      service().optIn(principal, optIn({ idempotencyKey: 'same-exact' }))
    ]);
    expect(exact[1]).toEqual(exact[0]);
    const winnerId = exact[0].networkParticipationId!;
    expect(await repository().listParticipationHistory(winnerId)).toHaveLength(1);
    expect(await repository().listVisibilityPolicyHistory(winnerId)).toHaveLength(1);
    expect(await repository().listAuditHistory(winnerId)).toHaveLength(1);
    expect(
      await database
        .getPool()
        .query('SELECT count(*)::int AS count FROM mgsn_network_participation_commands')
    ).toMatchObject({ rows: [{ count: 1 }] });

    await database
      .getPool()
      .query(
        'TRUNCATE mgsn_network_participation_audit,mgsn_network_participation_commands,mgsn_network_visibility_policies,mgsn_network_participations RESTART IDENTITY CASCADE'
      );
    const changed = await Promise.allSettled([
      service().optIn(principal, optIn({ idempotencyKey: 'same-changed' })),
      service().optIn(
        principal,
        optIn({ idempotencyKey: 'same-changed', reason: 'Changed concurrent payload.' })
      )
    ]);
    expect(changed.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = changed.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(
      await database
        .getPool()
        .query('SELECT count(*)::int AS count FROM mgsn_network_participation_commands')
    ).toMatchObject({ rows: [{ count: 1 }] });
  });

  it('allows only one different-key first opt-in and only one concurrent fresh rejoin', async () => {
    const first = await Promise.allSettled([
      service().optIn(principal, optIn({ idempotencyKey: 'different-a' })),
      service().optIn(principal, optIn({ idempotencyKey: 'different-b' }))
    ]);
    expect(first.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(first.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'STALE_PARTICIPATION' }
    });
    const winner = first.find((result) => result.status === 'fulfilled')!.value as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const revoked = (await service().changeState(
      principal,
      state(winner, 'REVOKE', 'revoke-before-rejoin')
    )) as typeof winner;
    const rejoin = await Promise.allSettled([
      service().optIn(principal, optIn({ idempotencyKey: 'rejoin-a' })),
      service().optIn(principal, optIn({ idempotencyKey: 'rejoin-b' }))
    ]);
    expect(rejoin.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await repository().listParticipationHistory(revoked.networkParticipationId)
    ).toHaveLength(2);
    const rows = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM mgsn_network_participations WHERE is_current');
    expect(rows.rows).toEqual([{ count: 1 }]);
  });

  it('uses exact policy CAS and makes revoke races fail closed', async () => {
    const active = (await service().optIn(principal, optIn())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const policyRace = await Promise.allSettled([
      service().replaceVisibilityPolicy(principal, visible(active, 'policy-a')),
      service().replaceVisibilityPolicy(principal, visible(active, 'policy-b'))
    ]);
    expect(policyRace.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(policyRace.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'STALE_VISIBILITY_POLICY' }
    });
    const current = (await service().read(principal, providerId)) as typeof active;
    const paused = (await service().changeState(
      principal,
      state(current, 'PAUSE', 'pause-before-race')
    )) as typeof active;
    const revokeRace = await Promise.allSettled([
      service().changeState(principal, state(paused, 'REVOKE', 'revoke-race')),
      service().changeState(principal, state(paused, 'RESUME', 'resume-race'))
    ]);
    expect(revokeRace.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(revokeRace.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'STALE_PARTICIPATION' }
    });
    const final = await service().read(principal, providerId);
    if (final.state === 'REVOKED')
      await expect(
        service().replaceVisibilityPolicy(principal, visible(final, 'revoked-cannot-expand'))
      ).rejects.toMatchObject({ code: 'PARTICIPATION_REVOKED' });
  });

  it('rolls back a late audit failure without partial authority or replay', async () => {
    const active = (await service().optIn(principal, optIn())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    const nextAt = '2026-09-01T01:05:00.000Z';
    const mutation: NetworkParticipationCommit = {
      workspaceId,
      providerId,
      expectedCurrentParticipationId: active.networkParticipationId,
      expectedCurrentParticipationVersion: 1,
      expectedCurrentVisibilityPolicyVersion: 1,
      participation: {
        schemaVersion: 1,
        networkParticipationId: active.networkParticipationId,
        workspaceId,
        providerId,
        version: 2,
        state: 'PAUSED',
        authorizationReference: 'authorization:rollback',
        reason: 'Prove a late transaction failure rolls back.',
        actorId,
        correlationId: 'correlation_rollback',
        occurredAt: nextAt,
        createdAt: nextAt
      },
      replay: {
        scopeKey: `network-participation:${workspaceId}:${providerId}`,
        idempotencyKey: 'rollback-command',
        fingerprint: 'a'.repeat(64),
        commandType: 'PAUSE',
        response: {
          ...active,
          participationVersion: 2,
          state: 'PAUSED',
          authorizationReference: 'authorization:rollback',
          checkedAt: nextAt
        }
      },
      audit: {
        schemaVersion: 1,
        networkParticipationId: active.networkParticipationId,
        workspaceId,
        providerId,
        trustedActorId: actorId,
        authorityReference: 'authorization:rollback',
        reason: 'Prove a late transaction failure rolls back.',
        previousParticipationState: 'ACTIVE',
        newParticipationState: 'PAUSED',
        previousParticipationVersion: 1,
        newParticipationVersion: 2,
        previousVisibilityPolicyVersion: 1,
        newVisibilityPolicyVersion: 999,
        affectedDataClasses: [],
        occurredAt: nextAt,
        correlationId: 'correlation_rollback'
      }
    };
    await expect(repository().commit(mutation)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
    expect(await service().read(principal, providerId)).toEqual(active);
    expect(await repository().listParticipationHistory(active.networkParticipationId)).toHaveLength(
      1
    );
    expect(
      await repository().findReplay(mutation.replay.scopeKey, 'rollback-command')
    ).toBeUndefined();
    expect(await repository().listAuditHistory(active.networkParticipationId)).toHaveLength(1);
  });

  it('preserves command/audit append-only triggers and fails closed on malformed stored grants', async () => {
    const active = (await service().optIn(principal, optIn())) as Exclude<
      NetworkParticipationSnapshotV1,
      { networkParticipationId: null }
    >;
    await expect(
      database.getPool().query("UPDATE mgsn_network_participation_commands SET reason='tampered'")
    ).rejects.toThrow(/append-only/);
    await expect(
      database.getPool().query('DELETE FROM mgsn_network_participation_audit')
    ).rejects.toThrow(/append-only/);
    await database
      .getPool()
      .query(
        "UPDATE mgsn_network_visibility_policies SET scope='BOUNDED_PUBLIC',grants='[{}]'::jsonb WHERE network_participation_id=$1 AND is_current",
        [active.networkParticipationId]
      );
    await expect(service().read(principal, providerId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    });
  });

  it('keeps Provider operational state separate and isolates the exact Workspace binding', async () => {
    expect(await service().read(principal, providerId)).toMatchObject({
      state: 'NOT_PARTICIPATING',
      visibilityPolicy: { scope: 'PRIVATE' }
    });
    await expect(
      service().read({ workspaceId: otherWorkspaceId, actorId }, providerId)
    ).rejects.toMatchObject({ code: 'PROVIDER_WORKSPACE_MISMATCH' });
    expect(
      await database
        .getPool()
        .query('SELECT count(*)::int AS count FROM mgsn_network_participations')
    ).toMatchObject({ rows: [{ count: 0 }] });
  });
});
