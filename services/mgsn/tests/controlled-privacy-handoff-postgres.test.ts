import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  controlledHandoffContractFixtureV1,
  type AuthorizeOrReplaceControlledHandoffCommandV1,
  type ControlledHandoffId,
  type RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import {
  providerSelectionContractFixtureV1,
  type ProviderSelectionId
} from '@markorbit/contracts/provider-selection';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  ControlledPrivacyHandoffService,
  type ControlledHandoffCurrentAuthoritySnapshot,
  type ControlledHandoffCurrentAuthoritySource,
  type ControlledHandoffPrincipal
} from '../src/controlled-privacy-handoff.js';
import { PostgresControlledHandoffRepository } from '../src/controlled-privacy-handoff-postgres.js';
import { createDurableMgsnServices } from '../src/durable-runtime.js';
import { PostgresProviderSelectionRepository } from '../src/provider-selection-postgres.js';
import {
  ProviderSelectionService,
  type ProviderSelectionCurrentAuthoritySnapshot,
  type ProviderSelectionPrincipal
} from '../src/provider-selection.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_CONTROLLED_HANDOFF_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_CONTROLLED_HANDOFF_POSTGRES_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const fixture = controlledHandoffContractFixtureV1;
const selectionFixture = providerSelectionContractFixtureV1;
const selectionAt = '2026-09-01T05:12:00.000Z';
const handoffAt = '2026-09-01T09:45:00.000Z';

suite('MGSN P0 #625 durable Controlled Privacy Handoff', () => {
  const namespace = 'mgsn_controlled_handoff_625_test';
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
  let handoffSequence = 0;

  const selectionSnapshot: ProviderSelectionCurrentAuthoritySnapshot = {
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
    checkedAuthorityReferences: ['authority:selection-625']
  };

  const handoffSnapshot: ControlledHandoffCurrentAuthoritySnapshot = {
    authorityAvailable: true,
    selectionCurrent: true,
    selectionScopeMatch: true,
    sourceVersionsMatch: true,
    sourceAccessCurrent: true,
    participationActive: true,
    visibilityAuthorized: true,
    directExecutorEstablished: true,
    hiddenIntermediaryDetected: false,
    evidenceArtifactAccessAuthorized: false,
    checkedAuthorityReferences: ['authority:handoff-625']
  };

  const selectionAuthority = selectionFixture.createCommand.trustedHumanAuthority;
  const selectionPrincipal: ProviderSelectionPrincipal = {
    workspaceId: selectionAuthority.requesterWorkspaceId,
    actorId: selectionAuthority.selectingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: selectionAuthority.principalReference,
    workspaceMembershipReference: selectionAuthority.workspaceMembershipReference,
    selectionAuthorityReference: selectionAuthority.selectionAuthorityReference,
    selectionAuthorityVersion: selectionAuthority.selectionAuthorityVersion,
    authenticatedAt: selectionAuthority.authenticatedAt,
    affirmativeHumanActionEvidenceReference: selectionAuthority.affirmativeHumanActionEvidenceReference
  };

  const handoffAuthority = fixture.authorizeCommand.trustedHumanAuthority;
  const handoffPrincipal: ControlledHandoffPrincipal = {
    workspaceId: handoffAuthority.originatingWorkspaceId,
    actorId: handoffAuthority.authorizingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: handoffAuthority.principalReference,
    workspaceMembershipReference: handoffAuthority.workspaceMembershipReference,
    handoffAuthorityReference: handoffAuthority.handoffAuthorityReference,
    handoffAuthorityVersion: handoffAuthority.handoffAuthorityVersion,
    authenticatedAt: handoffAuthority.authenticatedAt,
    affirmativeHumanActionEvidenceReference: handoffAuthority.affirmativeHumanActionEvidenceReference
  };

  const repository = () =>
    new PostgresControlledHandoffRepository(database, database.getPool());
  const handoffSource = (
    overrides: Partial<ControlledHandoffCurrentAuthoritySnapshot> = {}
  ): ControlledHandoffCurrentAuthoritySource => ({
    evaluateCurrentAuthority: vi.fn(() => Promise.resolve({ ...handoffSnapshot, ...overrides }))
  });
  const serviceWith = (source: ControlledHandoffCurrentAuthoritySource = handoffSource()) =>
    new ControlledPrivacyHandoffService(
      repository(),
      source,
      () => handoffAt,
      () => `controlled-handoff_625_${++handoffSequence}` as ControlledHandoffId
    );

  function authorizeCommand(
    overrides: Partial<AuthorizeOrReplaceControlledHandoffCommandV1> = {}
  ): AuthorizeOrReplaceControlledHandoffCommandV1 {
    return { ...structuredClone(fixture.authorizeCommand), ...overrides };
  }

  function replacementCommand(
    current: Awaited<ReturnType<ControlledPrivacyHandoffService['authorizeOrReplace']>>
  ): AuthorizeOrReplaceControlledHandoffCommandV1 {
    return authorizeCommand({
      expectedCurrent: {
        kind: 'EXACT',
        controlledHandoffId: current.envelope.controlledHandoffId,
        version: current.envelope.version
      },
      idempotencyKey: 'controlled-handoff:625:replace',
      commandFingerprintSha256: '4'.repeat(64),
      correlationId: 'correlation_controlled-handoff-625-replace'
    });
  }

  function revokeCommand(
    current: Awaited<ReturnType<ControlledPrivacyHandoffService['authorizeOrReplace']>>
  ): RevokeControlledHandoffCommandV1 {
    return {
      ...structuredClone(fixture.revokeCommand),
      target: {
        controlledHandoffId: current.envelope.controlledHandoffId,
        version: current.envelope.version
      },
      idempotencyKey: 'controlled-handoff:625:revoke',
      commandFingerprintSha256: '6'.repeat(64),
      correlationId: 'correlation_controlled-handoff-625-revoke'
    };
  }

  function slotKey(command = fixture.authorizeCommand) {
    return [
      'controlled-handoff',
      command.originatingWorkspaceId,
      command.sourceLineage.selectionLineage.selection.providerSelectionId,
      command.recipient.providerId,
      encodeURIComponent(command.purpose.contextReference)
    ].join(':');
  }

  async function counts() {
    const result = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM mgsn_controlled_handoff_identities) AS identities,
        (SELECT count(*)::int FROM mgsn_controlled_handoff_versions) AS versions,
        (SELECT count(*)::int FROM mgsn_controlled_handoff_slot_state) AS slots,
        (SELECT count(*)::int FROM mgsn_controlled_handoff_command_replays) AS replays,
        (SELECT count(*)::int FROM mgsn_controlled_handoff_owner_audit_events) AS audits`
    );
    return result.rows[0] as {
      identities: number;
      versions: number;
      slots: number;
      replays: number;
      audits: number;
    };
  }

  async function seedSelection() {
    const provider = selectionFixture.createCommand.sourceLineage.provider;
    const supply = selectionFixture.createCommand.sourceLineage.providerSupplyCapability;
    const visibility = selectionFixture.createCommand.sourceLineage.visibilityAuthorizationAtReview;
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
        provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,
        created_by,updated_by,created_at,updated_at
      ) VALUES($1,$2,'Controlled Handoff Provider 625','ACTIVE',1,$3::jsonb,$4,$4,$5,$5)`,
      [
        provider.providerId,
        provider.providerWorkspaceId,
        JSON.stringify({ providerId: provider.providerId }),
        selectionPrincipal.actorId,
        selectionAt
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
        selectionAt,
        supply.fingerprintSha256,
        JSON.stringify({ id: supply.id, version: supply.version }),
        selectionPrincipal.actorId
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_network_participations(
        network_participation_id,version,is_current,workspace_id,provider_id,state,
        authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at
      ) VALUES($1,$2,true,$3,$4,'ACTIVE','authority:handoff-visibility','Handoff fixture.',
        $5,'correlation_handoff_625',$6,$6)`,
      [
        visibility.networkParticipationId,
        visibility.participationVersion,
        provider.providerWorkspaceId,
        provider.providerId,
        selectionPrincipal.actorId,
        selectionAt
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_network_visibility_policies(
        network_participation_id,version,participation_version,is_current,scope,grants,
        authorization_reference,reason,actor_id,correlation_id,updated_at,created_at
      ) VALUES($1,$2,$3,true,'PRIVATE','[]'::jsonb,'authority:handoff-visibility',
        'Handoff fixture.',$4,'correlation_handoff_625',$5,$5)`,
      [
        visibility.networkParticipationId,
        visibility.visibilityPolicyVersion,
        visibility.participationVersion,
        selectionPrincipal.actorId,
        selectionAt
      ]
    );
    const selectionRepository = new PostgresProviderSelectionRepository(database, database.getPool());
    const selectionService = new ProviderSelectionService(
      selectionRepository,
      { evaluateCurrentAuthority: () => Promise.resolve(selectionSnapshot) },
      () => selectionAt,
      () => 'provider-selection_fixture-394' as ProviderSelectionId
    );
    await selectionService.createOrReplace(
      selectionPrincipal,
      structuredClone(selectionFixture.createCommand)
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
    handoffSequence = 0;
    vi.clearAllMocks();
    await database.getPool().query(
      `TRUNCATE
        mgsn_controlled_handoff_owner_audit_events,
        mgsn_controlled_handoff_command_replays,
        mgsn_controlled_handoff_slot_state,
        mgsn_controlled_handoff_versions,
        mgsn_controlled_handoff_identities,
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
    await seedSelection();
  });

  afterAll(() => database.close());

  it('persists first authorization, restart state and exact historical replay', async () => {
    expect(await repository().findSlotState('controlled-handoff:missing')).toEqual({
      current: undefined,
      version: 0
    });
    const service = serviceWith();
    const created = await service.authorizeOrReplace(handoffPrincipal, authorizeCommand());
    expect(created).toMatchObject({ mutation: 'AUTHORIZED', replayed: false });
    expect(await repository().findLatest(created.envelope.controlledHandoffId)).toEqual(created.envelope);
    expect(await repository().findSlotState(slotKey())).toEqual({
      current: created.envelope,
      version: 1
    });

    const replayed = await serviceWith().authorizeOrReplace(handoffPrincipal, authorizeCommand());
    expect(replayed).toMatchObject({ mutation: 'AUTHORIZED', replayed: true });
    expect(replayed.envelope).toEqual(created.envelope);
    expect(await counts()).toEqual({ identities: 1, versions: 1, slots: 1, replays: 1, audits: 1 });
  });

  it('appends exact replacement on the same identity and preserves immutable history', async () => {
    const service = serviceWith();
    const current = await service.authorizeOrReplace(handoffPrincipal, authorizeCommand());
    const replaced = await service.authorizeOrReplace(handoffPrincipal, replacementCommand(current));
    const history = await repository().listHistory(current.envelope.controlledHandoffId);

    expect(replaced).toMatchObject({ mutation: 'REPLACED', replayed: false });
    expect(replaced.envelope.controlledHandoffId).toBe(current.envelope.controlledHandoffId);
    expect(replaced.envelope.version).toBe(2);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(current.envelope);
    expect(history[1]).toEqual(replaced.envelope);
    expect(await repository().findSlotState(slotKey())).toEqual({ current: replaced.envelope, version: 2 });
  });

  it('rejects stale replacement with zero durable residue', async () => {
    const service = serviceWith();
    const current = await service.authorizeOrReplace(handoffPrincipal, authorizeCommand());
    const stale = replacementCommand(current);
    stale.expectedCurrent = {
      kind: 'EXACT',
      controlledHandoffId: current.envelope.controlledHandoffId,
      version: current.envelope.version + 1
    };
    const before = await counts();
    await expect(service.authorizeOrReplace(handoffPrincipal, stale)).rejects.toMatchObject({
      code: 'STALE_HANDOFF',
      status: 409
    });
    expect(await counts()).toEqual(before);
  });

  it('persists terminal revoke, never restores current by replay, and re-enters with a fresh identity', async () => {
    const service = serviceWith();
    const current = await service.authorizeOrReplace(handoffPrincipal, authorizeCommand());
    const revoked = await service.revoke(handoffPrincipal, revokeCommand(current));

    expect(revoked.envelope).toMatchObject({ status: 'REVOKED', version: 2 });
    expect(await repository().findSlotState(slotKey())).toEqual({ current: undefined, version: 2 });
    expect(await repository().listHistory(current.envelope.controlledHandoffId)).toHaveLength(2);

    const replayedCreate = await serviceWith().authorizeOrReplace(handoffPrincipal, authorizeCommand());
    expect(replayedCreate).toMatchObject({ mutation: 'AUTHORIZED', replayed: true });
    expect(await repository().findSlotState(slotKey())).toEqual({ current: undefined, version: 2 });

    const freshCommand = authorizeCommand({
      idempotencyKey: 'controlled-handoff:625:fresh-after-revoke',
      commandFingerprintSha256: 'b'.repeat(64),
      correlationId: 'correlation_controlled-handoff-625-fresh'
    });
    const fresh = await serviceWith().authorizeOrReplace(handoffPrincipal, freshCommand);
    expect(fresh.envelope.controlledHandoffId).not.toBe(current.envelope.controlledHandoffId);
    expect(fresh.envelope.version).toBe(1);
    expect(await repository().findSlotState(slotKey())).toEqual({ current: fresh.envelope, version: 3 });
  });

  it('serializes different-key first authorization and replace-vs-revoke races', async () => {
    const left = authorizeCommand({
      idempotencyKey: 'controlled-handoff:625:left',
      commandFingerprintSha256: '1'.repeat(64)
    });
    const right = authorizeCommand({
      idempotencyKey: 'controlled-handoff:625:right',
      commandFingerprintSha256: '3'.repeat(64)
    });
    const first = await Promise.allSettled([
      serviceWith().authorizeOrReplace(handoffPrincipal, left),
      serviceWith().authorizeOrReplace(handoffPrincipal, right)
    ]);
    expect(first.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(first.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await counts()).toEqual({ identities: 1, versions: 1, slots: 1, replays: 1, audits: 1 });

    const current = (first.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<ControlledPrivacyHandoffService['authorizeOrReplace']>>>).value;
    const raced = await Promise.allSettled([
      serviceWith().authorizeOrReplace(handoffPrincipal, replacementCommand(current)),
      serviceWith().revoke(handoffPrincipal, revokeCommand(current))
    ]);
    expect(raced.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(raced.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await counts()).versions).toBe(2);
    expect((await counts()).replays).toBe(2);
    expect((await counts()).audits).toBe(2);
  });

  it('keeps persisted AUTHORIZED history separate from current consumption authority', async () => {
    const created = await serviceWith().authorizeOrReplace(handoffPrincipal, authorizeCommand());
    const attempt = structuredClone(fixture.validForExactConsumption.attempt);

    const denied = await serviceWith(handoffSource({ visibilityAuthorized: false })).validateCurrent(
      { workspaceId: handoffPrincipal.workspaceId },
      { envelope: { controlledHandoffId: created.envelope.controlledHandoffId, version: 1 }, purpose: 'HANDOFF_CONSUMPTION', attempt }
    );
    expect(denied).toMatchObject({
      decision: 'DENY',
      currentlyUsable: false,
      currentExactDisclosurePermitted: false,
      denialReason: 'VISIBILITY_NO_LONGER_AUTHORIZED'
    });

    const expiredAttempt = { ...attempt, attemptedAt: created.envelope.validUntil };
    const expired = await serviceWith().validateCurrent(
      { workspaceId: handoffPrincipal.workspaceId },
      { envelope: { controlledHandoffId: created.envelope.controlledHandoffId, version: 1 }, purpose: 'HANDOFF_CONSUMPTION', attempt: expiredAttempt }
    );
    expect(expired).toMatchObject({ decision: 'DENY', denialReason: 'HANDOFF_EXPIRED' });

    const artifactAttempt = { ...attempt, artifactRetrievalRequested: true };
    const artifactDenied = await serviceWith().validateCurrent(
      { workspaceId: handoffPrincipal.workspaceId },
      { envelope: { controlledHandoffId: created.envelope.controlledHandoffId, version: 1 }, purpose: 'HANDOFF_CONSUMPTION', attempt: artifactAttempt }
    );
    expect(artifactDenied).toMatchObject({
      decision: 'DENY',
      denialReason: 'EVIDENCE_ARTIFACT_ACCESS_NOT_AUTHORIZED'
    });

    const durable = createDurableMgsnServices({
      database,
      coreUrl: 'http://127.0.0.1:1',
      executionUrl: 'http://127.0.0.1:1',
      internalServiceSecret: 'handoff-625-test-secret'
    });
    const unavailable = await durable.controlledHandoff.validateCurrent(
      { workspaceId: handoffPrincipal.workspaceId },
      { envelope: { controlledHandoffId: created.envelope.controlledHandoffId, version: 1 }, purpose: 'HANDOFF_CONSUMPTION', attempt }
    );
    expect(unavailable).toMatchObject({ decision: 'DENY', denialReason: 'AUTHORITY_UNAVAILABLE' });
  });

  it('enforces append-only guards and fails closed on deliberately corrupted normalized lineage', async () => {
    const created = await serviceWith().authorizeOrReplace(handoffPrincipal, authorizeCommand());
    await expect(
      database.getPool().query(
        `UPDATE mgsn_controlled_handoff_command_replays SET correlation_id='tampered' WHERE slot_key=$1`,
        [slotKey()]
      )
    ).rejects.toBeTruthy();
    await expect(
      database.getPool().query(
        `DELETE FROM mgsn_controlled_handoff_owner_audit_events WHERE slot_key=$1`,
        [slotKey()]
      )
    ).rejects.toBeTruthy();

    await database.getPool().query(
      'ALTER TABLE mgsn_controlled_handoff_versions DISABLE TRIGGER mgsn_controlled_handoff_versions_append_only'
    );
    try {
      await database.getPool().query(
        `UPDATE mgsn_controlled_handoff_versions
         SET selection_fingerprint_sha256=$1
         WHERE controlled_handoff_id=$2 AND version=1`,
        ['0'.repeat(64), created.envelope.controlledHandoffId]
      );
    } finally {
      await database.getPool().query(
        'ALTER TABLE mgsn_controlled_handoff_versions ENABLE TRIGGER mgsn_controlled_handoff_versions_append_only'
      );
    }
    await expect(repository().findLatest(created.envelope.controlledHandoffId)).rejects.toMatchObject({
      code: 'AUTHORITY_UNAVAILABLE',
      status: 503
    });
  });
});
