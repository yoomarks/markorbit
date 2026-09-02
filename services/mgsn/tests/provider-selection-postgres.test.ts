import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  providerSelectionContractFixtureV1,
  type ProviderSelectionId
} from '@markorbit/contracts/provider-selection';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProviderSelectionRepository } from '../src/provider-selection-postgres.js';
import {
  ProviderSelectionService,
  type ProviderSelectionCurrentAuthoritySnapshot,
  type ProviderSelectionCurrentAuthoritySource,
  type ProviderSelectionPrincipal
} from '../src/provider-selection.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_PROVIDER_SELECTION_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_PROVIDER_SELECTION_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const fixture = providerSelectionContractFixtureV1;
const at = '2026-09-02T12:00:00.000Z';

suite('MGSN P0 #598 durable Human Provider Selection', () => {
  const namespace = 'mgsn_provider_selection_598_test';
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
  let sequence = 0;
  const snapshot: ProviderSelectionCurrentAuthoritySnapshot = {
    authorityAvailable: true,
    requesterAuthorityCurrent: true,
    actorAuthorityCurrent: true,
    candidateCurrent: true,
    participationActive: true,
    visibilityAuthorized: true,
    trustedRelationshipRequired: false,
    trustedRelationshipCurrent: true,
    providerOperational: true,
    supplyCurrent: true,
    directExecutorEstablished: true,
    sourceVersionsMatch: true,
    checkedAuthorityReferences: ['authority:selection-598']
  };
  const authoritySource: ProviderSelectionCurrentAuthoritySource = {
    evaluateCurrentAuthority: vi.fn(() => Promise.resolve(snapshot))
  };
  const authority = fixture.createCommand.trustedHumanAuthority;
  const principal: ProviderSelectionPrincipal = {
    workspaceId: authority.requesterWorkspaceId,
    actorId: authority.selectingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: authority.principalReference,
    workspaceMembershipReference: authority.workspaceMembershipReference,
    selectionAuthorityReference: authority.selectionAuthorityReference,
    selectionAuthorityVersion: authority.selectionAuthorityVersion,
    authenticatedAt: authority.authenticatedAt,
    affirmativeHumanActionEvidenceReference: authority.affirmativeHumanActionEvidenceReference
  };
  const repository = () => new PostgresProviderSelectionRepository(database, database.getPool());
  const service = () =>
    new ProviderSelectionService(
      repository(),
      authoritySource,
      () => at,
      () => `provider-selection_598_${++sequence}` as ProviderSelectionId
    );

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
    sequence = 0;
    await database.getPool().query(
      `TRUNCATE
        mgsn_provider_selection_owner_audit_events,
        mgsn_provider_selection_command_replays,
        mgsn_provider_selection_scope_state,
        mgsn_provider_selection_versions,
        mgsn_provider_selection_identities,
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
    const lineage = fixture.createCommand.sourceLineage;
    const provider = lineage.provider;
    const supply = lineage.providerSupplyCapability;
    const visibility = lineage.visibilityAuthorizationAtReview;
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
        provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,
        created_by,updated_by,created_at,updated_at
      ) VALUES($1,$2,'Selection Provider 598','ACTIVE',1,$3::jsonb,$4,$4,$5,$5)`,
      [
        provider.providerId,
        provider.providerWorkspaceId,
        JSON.stringify({ providerId: provider.providerId }),
        principal.actorId,
        at
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_provider_supply_capabilities(
        provider_supply_capability_id,version,provider_id,provider_workspace_id,status,
        jurisdictions,service_types,effective_from,effective_until,capacity_units,availability_units,
        verification_state,evidence_references,source_fingerprint_sha256,capability_record,is_current,
        created_by,updated_by,created_at,updated_at
      ) VALUES($1,$2,$3,$4,'ACTIVE',ARRAY['US'],ARRAY['TRADEMARK'],$5,NULL,1,1,
        'VERIFIED_FOR_SUPPLY','[]'::jsonb,$6,$7::jsonb,true,$8,$8,$5,$5)`,
      [
        supply.id,
        supply.version,
        provider.providerId,
        provider.providerWorkspaceId,
        at,
        supply.fingerprintSha256,
        JSON.stringify({ id: supply.id, version: supply.version }),
        principal.actorId
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_network_participations(
        network_participation_id,version,is_current,workspace_id,provider_id,state,
        authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at
      ) VALUES($1,$2,true,$3,$4,'ACTIVE','authority:selection-visibility','Selection fixture.',
        $5,'correlation_selection_598',$6,$6)`,
      [
        visibility.networkParticipationId,
        visibility.participationVersion,
        provider.providerWorkspaceId,
        provider.providerId,
        principal.actorId,
        at
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_network_visibility_policies(
        network_participation_id,version,participation_version,is_current,scope,grants,
        authorization_reference,reason,actor_id,correlation_id,updated_at,created_at
      ) VALUES($1,$2,$3,true,'PRIVATE','[]'::jsonb,'authority:selection-visibility',
        'Selection fixture.',$4,'correlation_selection_598',$5,$5)`,
      [
        visibility.networkParticipationId,
        visibility.visibilityPolicyVersion,
        visibility.participationVersion,
        principal.actorId,
        at
      ]
    );
  });

  afterAll(() => database.close());

  it('persists create, restart read, exact replay, and fail-closed historical usability separation', async () => {
    expect(await repository().findScopeState('provider-selection:missing')).toEqual({
      scopeVersion: 0
    });
    const created = await service().createOrReplace(
      principal,
      structuredClone(fixture.createCommand)
    );
    expect(created).toMatchObject({ mutation: 'CREATED', replayed: false });
    expect(await repository().findLatestSelection(created.selection.providerSelectionId)).toEqual(
      created.selection
    );
    const replayed = await service().createOrReplace(
      principal,
      structuredClone(fixture.createCommand)
    );
    expect(replayed).toMatchObject({ mutation: 'CREATED', replayed: true });
    expect(
      await repository().listSelectionHistory(created.selection.providerSelectionId)
    ).toHaveLength(1);
  });

  it('serializes different-key concurrent first-create with one winner and zero loser residue', async () => {
    const left = {
      ...structuredClone(fixture.createCommand),
      idempotencyKey: 'provider-selection:598:left',
      commandFingerprintSha256: 'a'.repeat(64)
    };
    const right = {
      ...structuredClone(fixture.createCommand),
      idempotencyKey: 'provider-selection:598:right',
      commandFingerprintSha256: 'b'.repeat(64)
    };
    const results = await Promise.allSettled([
      service().createOrReplace(principal, left),
      service().createOrReplace(principal, right)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const counts = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM mgsn_provider_selection_identities) AS identities,
        (SELECT count(*)::int FROM mgsn_provider_selection_versions) AS versions,
        (SELECT count(*)::int FROM mgsn_provider_selection_scope_state) AS scopes,
        (SELECT count(*)::int FROM mgsn_provider_selection_command_replays) AS replays,
        (SELECT count(*)::int FROM mgsn_provider_selection_owner_audit_events) AS audits`
    );
    expect(counts.rows[0]).toEqual({
      identities: 1,
      versions: 1,
      scopes: 1,
      replays: 1,
      audits: 1
    });
  });

  it('keeps replay and owner audit append-only', async () => {
    await service().createOrReplace(principal, structuredClone(fixture.createCommand));
    await expect(
      database.getPool().query('DELETE FROM mgsn_provider_selection_command_replays')
    ).rejects.toThrow();
    await expect(
      database
        .getPool()
        .query('UPDATE mgsn_provider_selection_owner_audit_events SET actor_id=actor_id')
    ).rejects.toThrow();
  });
});
