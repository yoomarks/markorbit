import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import {
  ProviderRegistryService,
  isSupplyOperationallyEligibleAt,
  providerRegistryAuthorityConsequences,
  type CoreWorkspaceIdentityReference,
  type ProviderRegistryError
} from '../src/provider-registry.js';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_PROVIDER_REGISTRY_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_PROVIDER_REGISTRY_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceA = '11111111-1111-4111-8111-111111111111';
const workspaceB = '22222222-2222-4222-8222-222222222222';
const actor = 'user_mgsn_operator';

suite('M4-WP-03 durable MGSN Provider Registry', () => {
  const namespace = 'mgsn_provider_registry_wp03_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const core = new Map<string, CoreWorkspaceIdentityReference>();
  let providerSequence = 0;
  let capabilitySequence = 0;
  let clock = '2026-08-09T06:30:00.000Z';
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/mgsn-service'
    );
  const repository = () => new PostgresProviderRegistryRepository(database, database.getPool());
  const service = () =>
    new ProviderRegistryService(
      repository(),
      {
        getWorkspace: (workspaceId) => {
          const value = core.get(workspaceId);
          return Promise.resolve(value ? structuredClone(value) : undefined);
        }
      },
      () => clock,
      () => `provider_wp03_${++providerSequence}`,
      () => `provider-supply-capability_wp03_${++capabilitySequence}`
    );
  const createProvider = (value = service(), key = 'provider-create', workspaceId = workspaceA) =>
    value.createProvider({
      providerWorkspaceId: workspaceId,
      displayName: workspaceId === workspaceA ? 'Orbit Provider A' : 'Orbit Provider B',
      actorId: actor,
      idempotencyKey: key
    });
  const createCapability = async (value = service(), key = 'supply-create') => {
    const provider = await createProvider(value, `${key}-provider`);
    const capability = await value.createSupplyCapability({
      providerId: provider.providerId,
      jurisdictions: ['US', 'TH', 'US'],
      serviceTypes: ['TRADEMARK_FILING', 'OFFICE_ACTION', 'TRADEMARK_FILING'],
      effectiveFrom: '2026-08-01T00:00:00.000Z',
      effectiveUntil: '2026-12-31T00:00:00.000Z',
      capacityUnits: 12,
      availabilityUnits: 7,
      evidenceReferences: ['evidence_b', 'evidence_a', 'evidence_b'],
      verificationState: 'VERIFIED_FOR_SUPPLY',
      actorId: actor,
      idempotencyKey: key
    });
    return { provider, capability, value };
  };

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
    providerSequence = 0;
    capabilitySequence = 0;
    clock = '2026-08-09T06:30:00.000Z';
    core.clear();
    core.set(workspaceA, { workspaceId: workspaceA, status: 'ACTIVE' });
    core.set(workspaceB, { workspaceId: workspaceB, status: 'ACTIVE' });
    await database.getPool().query(
      `TRUNCATE
         mgsn_provider_registry_audit,
         mgsn_provider_registry_commands,
         mgsn_provider_supply_capabilities,
         mgsn_providers
       RESTART IDENTITY CASCADE`
    );
  });

  afterAll(() => database.close());

  it('owns and verifies migration 0028 in the independent MGSN database boundary', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual(
      expect.arrayContaining(['0028_mgsn_provider_registry'])
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
    const relations = await database
      .getPool()
      .query<{ name: string }>(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'mgsn_%' ORDER BY tablename"
      );
    expect(relations.rows.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'mgsn_provider_registry_audit',
        'mgsn_provider_registry_commands',
        'mgsn_provider_supply_capabilities',
        'mgsn_providers'
      ])
    );
  });

  it('binds one Provider to an active Core Workspace identity and rejects silent duplication', async () => {
    const value = service();
    const provider = await createProvider(value);
    expect(provider).toMatchObject({
      providerWorkspaceId: workspaceA,
      displayName: 'Orbit Provider A',
      operationalStatus: 'ACTIVE',
      version: 1,
      createdBy: actor,
      updatedBy: actor
    });
    await expect(
      value.createProvider({
        providerWorkspaceId: workspaceA,
        displayName: 'Duplicate Provider Identity',
        actorId: actor,
        idempotencyKey: 'provider-duplicate'
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_IDENTITY_EXISTS', status: 409 });
    await expect(repository().findProviderByWorkspaceId(workspaceA)).resolves.toEqual(provider);
  });

  it('fails closed for missing or archived Core Workspace identities before writing MGSN truth', async () => {
    core.delete(workspaceB);
    await expect(createProvider(service(), 'missing-core', workspaceB)).rejects.toMatchObject({
      code: 'CORE_WORKSPACE_NOT_FOUND'
    });
    core.set(workspaceB, { workspaceId: workspaceB, status: 'ARCHIVED' });
    await expect(createProvider(service(), 'archived-core', workspaceB)).rejects.toMatchObject({
      code: 'CORE_WORKSPACE_INACTIVE'
    });
    expect(await repository().listProviders()).toHaveLength(0);
  });

  it('persists provider create/status idempotency, suspension and optimistic version checks across recreation', async () => {
    const first = service();
    const created = await createProvider(first, 'provider-durable');
    await expect(createProvider(service(), 'provider-durable')).resolves.toEqual(created);
    await expect(
      service().createProvider({
        providerWorkspaceId: workspaceA,
        displayName: 'Conflicting Replay',
        actorId: actor,
        idempotencyKey: 'provider-durable'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    clock = '2026-08-09T06:31:00.000Z';
    const suspended = await service().setProviderOperationalStatus({
      providerId: created.providerId,
      expectedVersion: 1,
      operationalStatus: 'SUSPENDED',
      actorId: actor,
      idempotencyKey: 'provider-suspend'
    });
    expect(suspended).toMatchObject({ operationalStatus: 'SUSPENDED', version: 2 });
    await expect(repository().findProviderById(created.providerId)).resolves.toEqual(suspended);
    await expect(
      service().setProviderOperationalStatus({
        providerId: created.providerId,
        expectedVersion: 1,
        operationalStatus: 'ACTIVE',
        actorId: actor,
        idempotencyKey: 'provider-stale'
      })
    ).rejects.toMatchObject({ code: 'STALE_PROVIDER' });

    core.set(workspaceA, { workspaceId: workspaceA, status: 'ARCHIVED' });
    await expect(
      service().setProviderOperationalStatus({
        providerId: created.providerId,
        expectedVersion: 2,
        operationalStatus: 'ACTIVE',
        actorId: actor,
        idempotencyKey: 'provider-reactivate-archived'
      })
    ).rejects.toMatchObject({ code: 'CORE_WORKSPACE_INACTIVE' });
  });

  it('stores normalized bounded Supply Capability inputs without projecting user Capability truth', async () => {
    const { capability } = await createCapability();
    expect(capability).toMatchObject({
      version: 1,
      status: 'ACTIVE',
      jurisdictions: ['TH', 'US'],
      serviceTypes: ['OFFICE_ACTION', 'TRADEMARK_FILING'],
      capacityUnits: 12,
      availabilityUnits: 7,
      verificationState: 'VERIFIED_FOR_SUPPLY',
      evidenceReferences: ['evidence_a', 'evidence_b']
    });
    expect(capability.sourceFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(providerRegistryAuthorityConsequences).toMatchObject({
      providerSupplyCapabilityRecorded: true,
      userCapabilityVerifiedAutomatically: false,
      professionalQualifiedAutomatically: false,
      providerAllocated: false,
      filingSubmitted: false,
      officialTruthCreated: false
    });
  });

  it('revises Supply Capability by immutable version while preserving exact historical evidence and replay', async () => {
    const { capability, value } = await createCapability();
    clock = '2026-08-09T06:32:00.000Z';
    const command = {
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedVersion: 1,
      status: 'ACTIVE' as const,
      jurisdictions: ['US', 'TH'],
      serviceTypes: ['TRADEMARK_FILING'],
      effectiveFrom: '2026-08-01T00:00:00.000Z',
      effectiveUntil: '2027-01-31T00:00:00.000Z',
      capacityUnits: 15,
      availabilityUnits: 5,
      evidenceReferences: ['evidence_c'],
      verificationState: 'EVIDENCE_RECORDED' as const,
      actorId: actor,
      idempotencyKey: 'supply-revise'
    };
    const revised = await value.reviseSupplyCapability(command);
    expect(revised).toMatchObject({ version: 2, capacityUnits: 15, availabilityUnits: 5 });
    expect(revised.sourceFingerprintSha256).not.toBe(capability.sourceFingerprintSha256);
    await expect(
      service().getSupplyCapability(capability.providerSupplyCapabilityId, 1)
    ).resolves.toEqual(capability);
    await expect(
      service().getSupplyCapability(capability.providerSupplyCapabilityId)
    ).resolves.toEqual(revised);
    await expect(service().reviseSupplyCapability(command)).resolves.toEqual(revised);
    await expect(
      service().reviseSupplyCapability({
        ...command,
        availabilityUnits: 4
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      service().reviseSupplyCapability({
        ...command,
        idempotencyKey: 'supply-stale'
      })
    ).rejects.toMatchObject({ code: 'STALE_SUPPLY_CAPABILITY' });
  });

  it('makes suspended/inactive supply operationally ineligible without allocating or appointing anyone', async () => {
    const { provider, capability, value } = await createCapability();
    expect(isSupplyOperationallyEligibleAt(provider, capability, '2026-08-10T00:00:00.000Z')).toBe(
      true
    );
    const suspendedProvider = await value.setProviderOperationalStatus({
      providerId: provider.providerId,
      expectedVersion: 1,
      operationalStatus: 'SUSPENDED',
      actorId: actor,
      idempotencyKey: 'eligibility-suspend-provider'
    });
    expect(
      isSupplyOperationallyEligibleAt(suspendedProvider, capability, '2026-08-10T00:00:00.000Z')
    ).toBe(false);
    expect(isSupplyOperationallyEligibleAt(provider, capability, '2027-02-01T00:00:00.000Z')).toBe(
      false
    );
    expect(providerRegistryAuthorityConsequences.legalProfessionalAppointmentCreated).toBe(false);
    expect(providerRegistryAuthorityConsequences.providerAllocated).toBe(false);
  });

  it('keeps provider-network audit evidence append-only', async () => {
    const provider = await createProvider();
    const audit = await database
      .getPool()
      .query<{ audit_id: string }>(
        'SELECT audit_id FROM mgsn_provider_registry_audit WHERE target_id=$1 ORDER BY audit_id LIMIT 1',
        [provider.providerId]
      );
    const auditId = audit.rows[0]?.audit_id;
    expect(auditId).toBeDefined();
    await expect(
      database
        .getPool()
        .query('UPDATE mgsn_provider_registry_audit SET action=$2 WHERE audit_id=$1', [
          auditId,
          'tampered'
        ])
    ).rejects.toThrow(/append-only/);
    await expect(
      database
        .getPool()
        .query('DELETE FROM mgsn_provider_registry_audit WHERE audit_id=$1', [auditId])
    ).rejects.toThrow(/append-only/);
  });

  it('maps MGSN database outage to canonical 503-class persistence semantics', async () => {
    const unavailable = new PostgresProviderRegistryRepository(database, {
      query: () => Promise.reject(new Error('database unavailable'))
    } as never);
    await expect(unavailable.findProviderById('provider_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    } satisfies Partial<ProviderRegistryError>);
  });
});
