import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  providerSelectionContractFixtureV1,
  type CreateOrReplaceProviderSelectionCommandV1,
  type ProviderSelectionId,
  type RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';
import { ManagedDatabase } from '@markorbit/persistence';
import { createDurableMgsnServices } from '../src/durable-runtime.js';
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
  const scopeKey = [
    'provider-selection',
    fixture.createCommand.requesterWorkspaceId,
    fixture.createCommand.scope.owner,
    encodeURIComponent(fixture.createCommand.scope.reference)
  ].join(':');
  const repository = () => new PostgresProviderSelectionRepository(database, database.getPool());
  const serviceWith = (source: ProviderSelectionCurrentAuthoritySource = authoritySource) =>
    new ProviderSelectionService(
      repository(),
      source,
      () => at,
      () => `provider-selection_598_${++sequence}` as ProviderSelectionId
    );

  function createCommand(
    overrides: Partial<CreateOrReplaceProviderSelectionCommandV1> = {}
  ): CreateOrReplaceProviderSelectionCommandV1 {
    return { ...structuredClone(fixture.createCommand), ...overrides };
  }

  function replacementCommand(
    current: Awaited<ReturnType<ProviderSelectionService['createOrReplace']>>
  ): CreateOrReplaceProviderSelectionCommandV1 {
    const base = fixture.createCommand;
    const candidateId =
      'provider-discovery-candidate_selection-598-replacement' as typeof base.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId;
    const candidateFingerprintSha256 = '8'.repeat(64);
    return {
      ...structuredClone(base),
      sourceLineage: {
        ...structuredClone(base.sourceLineage),
        discoveryCandidate: {
          ...structuredClone(base.sourceLineage.discoveryCandidate),
          providerDiscoveryCandidateId: candidateId,
          candidateFingerprintSha256
        }
      },
      acknowledgement: {
        ...structuredClone(base.acknowledgement),
        reviewedCandidateId: candidateId,
        reviewedCandidateFingerprintSha256: candidateFingerprintSha256
      },
      expectedCurrent: {
        kind: 'EXACT',
        providerSelectionId: current.selection.providerSelectionId,
        version: current.selection.version,
        expectedScopeVersion: current.selection.scopeVersion
      },
      idempotencyKey: 'provider-selection:598:replace',
      commandFingerprintSha256: 'c'.repeat(64),
      correlationId: 'correlation_selection_598_replace'
    };
  }

  function revokeCommand(
    current: Awaited<ReturnType<ProviderSelectionService['createOrReplace']>>
  ): RevokeProviderSelectionCommandV1 {
    return {
      ...structuredClone(fixture.revokeCommand),
      target: {
        providerSelectionId: current.selection.providerSelectionId,
        version: current.selection.version,
        scopeVersion: current.selection.scopeVersion
      },
      idempotencyKey: 'provider-selection:598:revoke',
      commandFingerprintSha256: 'd'.repeat(64),
      correlationId: 'correlation_selection_598_revoke'
    };
  }

  async function counts() {
    const result = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM mgsn_provider_selection_identities) AS identities,
        (SELECT count(*)::int FROM mgsn_provider_selection_versions) AS versions,
        (SELECT count(*)::int FROM mgsn_provider_selection_scope_state) AS scopes,
        (SELECT count(*)::int FROM mgsn_provider_selection_command_replays) AS replays,
        (SELECT count(*)::int FROM mgsn_provider_selection_owner_audit_events) AS audits`
    );
    return result.rows[0] as {
      identities: number;
      versions: number;
      scopes: number;
      replays: number;
      audits: number;
    };
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
    sequence = 0;
    vi.clearAllMocks();
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

  it('persists create, restart read and exact replay', async () => {
    expect(await repository().findScopeState('provider-selection:missing')).toEqual({
      scopeVersion: 0
    });
    const created = await serviceWith().createOrReplace(principal, createCommand());
    expect(created).toMatchObject({ mutation: 'CREATED', replayed: false });
    expect(await repository().findLatestSelection(created.selection.providerSelectionId)).toEqual(
      created.selection
    );
    expect(await repository().findScopeState(scopeKey)).toEqual({
      scopeVersion: 1,
      current: created.selection
    });
    const replayed = await serviceWith().createOrReplace(principal, createCommand());
    expect(replayed).toMatchObject({ mutation: 'CREATED', replayed: true });
    expect(replayed.selection).toEqual(created.selection);
    expect(
      await repository().listSelectionHistory(created.selection.providerSelectionId)
    ).toHaveLength(1);
  });

  it('atomically replaces the exact current Selection and preserves immutable old history', async () => {
    const service = serviceWith();
    const current = await service.createOrReplace(principal, createCommand());
    const replaced = await service.createOrReplace(principal, replacementCommand(current));
    const oldHistory = await repository().listSelectionHistory(
      current.selection.providerSelectionId
    );

    expect(replaced).toMatchObject({ mutation: 'REPLACED', replayed: false });
    expect(replaced.selection).toMatchObject({ status: 'CURRENT', version: 1, scopeVersion: 2 });
    expect(replaced.selection.providerSelectionId).not.toBe(current.selection.providerSelectionId);
    expect(oldHistory).toHaveLength(2);
    expect(oldHistory.at(-1)).toMatchObject({
      status: 'SUPERSEDED',
      version: 2,
      scopeVersion: 2,
      supersededBy: {
        providerSelectionId: replaced.selection.providerSelectionId,
        version: 1,
        scopeVersion: 2
      }
    });
    expect(await repository().findScopeState(scopeKey)).toEqual({
      scopeVersion: 2,
      current: replaced.selection
    });
  });

  it('persists exact revoke across restart and historical create replay cannot restore CURRENT', async () => {
    const service = serviceWith();
    const current = await service.createOrReplace(principal, createCommand());
    const revoked = await service.revoke(principal, revokeCommand(current));

    expect(revoked.selection).toMatchObject({
      status: 'REVOKED',
      version: 2,
      scopeVersion: 2,
      revocationReasonCode: 'HUMAN_WITHDRAWAL'
    });
    expect(await repository().findScopeState(scopeKey)).toEqual({ scopeVersion: 2 });
    expect(await repository().findLatestSelection(current.selection.providerSelectionId)).toEqual(
      revoked.selection
    );

    const replayedCreate = await serviceWith().createOrReplace(principal, createCommand());
    expect(replayedCreate).toMatchObject({ replayed: true, mutation: 'CREATED' });
    expect(replayedCreate.selection.status).toBe('CURRENT');
    expect(await repository().findScopeState(scopeKey)).toEqual({ scopeVersion: 2 });
  });

  it('rejects stale replacement with zero history, replay, audit or pointer residue', async () => {
    const service = serviceWith();
    const current = await service.createOrReplace(principal, createCommand());
    const replacement = replacementCommand(current);
    const stale: CreateOrReplaceProviderSelectionCommandV1 = {
      ...replacement,
      expectedCurrent: {
        ...replacement.expectedCurrent,
        expectedScopeVersion: current.selection.scopeVersion + 1
      }
    };
    const before = await counts();

    await expect(service.createOrReplace(principal, stale)).rejects.toMatchObject({
      code: 'STALE_SELECTION',
      status: 409
    });
    expect(await counts()).toEqual(before);
    expect(await repository().findScopeState(scopeKey)).toEqual({
      scopeVersion: 1,
      current: current.selection
    });
  });

  it('serializes different-key concurrent first-create with one winner and zero loser residue', async () => {
    const left: CreateOrReplaceProviderSelectionCommandV1 = {
      ...createCommand(),
      idempotencyKey: 'provider-selection:598:left',
      commandFingerprintSha256: 'a'.repeat(64)
    };
    const right: CreateOrReplaceProviderSelectionCommandV1 = {
      ...createCommand(),
      idempotencyKey: 'provider-selection:598:right',
      commandFingerprintSha256: 'b'.repeat(64)
    };
    const results = await Promise.allSettled([
      serviceWith().createOrReplace(principal, left),
      serviceWith().createOrReplace(principal, right)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await counts()).toEqual({
      identities: 1,
      versions: 1,
      scopes: 1,
      replays: 1,
      audits: 1
    });
  });

  it('serializes concurrent replace and revoke against the same exact current target', async () => {
    const seed = await serviceWith().createOrReplace(principal, createCommand());
    const results = await Promise.allSettled([
      serviceWith().createOrReplace(principal, replacementCommand(seed)),
      serviceWith().revoke(principal, revokeCommand(seed))
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const state = await repository().findScopeState(scopeKey);
    expect(state.scopeVersion).toBe(2);
    expect(await repository().listAuditHistory(scopeKey)).toHaveLength(2);
    expect((await counts()).replays).toBe(2);
  });

  it('keeps persisted CURRENT lifecycle separate from current usability, including durable runtime default', async () => {
    const created = await serviceWith().createOrReplace(principal, createCommand());
    const deniedSource: ProviderSelectionCurrentAuthoritySource = {
      evaluateCurrentAuthority: () => Promise.resolve({ ...snapshot, visibilityAuthorized: false })
    };
    const denied = await serviceWith(deniedSource).validateCurrent(principal, {
      scope: created.selection.scope,
      providerSelectionId: created.selection.providerSelectionId,
      purpose: 'CONTROLLED_HANDOFF_REVIEW'
    });
    expect(denied).toMatchObject({
      decision: 'DENY',
      currentlyUsable: false,
      denialReason: 'VISIBILITY_NO_LONGER_AUTHORIZED'
    });

    const durable = createDurableMgsnServices({
      database,
      coreUrl: 'http://127.0.0.1:1',
      executionUrl: 'http://127.0.0.1:1',
      internalServiceSecret: 'selection-598-test-secret'
    });
    const unavailable = await durable.providerSelection.validateCurrent(principal, {
      scope: created.selection.scope,
      providerSelectionId: created.selection.providerSelectionId,
      purpose: 'ALLOCATION_PREREQUISITE_REVIEW'
    });
    expect(unavailable).toMatchObject({
      decision: 'DENY',
      currentlyUsable: false,
      denialReason: 'AUTHORITY_UNAVAILABLE'
    });
  });

  it('fails closed when a valid FK current pointer contradicts canonical lifecycle', async () => {
    const service = serviceWith();
    const current = await service.createOrReplace(principal, createCommand());
    await service.createOrReplace(principal, replacementCommand(current));
    await database.getPool().query(
      `UPDATE mgsn_provider_selection_scope_state
       SET current_provider_selection_id=$2,current_selection_version=2,current_selection_scope_version=2
       WHERE scope_key=$1`,
      [scopeKey, current.selection.providerSelectionId]
    );

    await expect(repository().findScopeState(scopeKey)).rejects.toMatchObject({
      code: 'AUTHORITY_UNAVAILABLE',
      status: 503
    });
  });

  it('keeps replay and owner audit append-only', async () => {
    await serviceWith().createOrReplace(principal, createCommand());
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
