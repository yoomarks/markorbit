import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import { PostgresProviderWorkReadRepository } from '../src/provider-work-read-model-postgres.js';
import { ProviderWorkReadModelService } from '../src/provider-work-read-model.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_PROVIDER_WORK_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_PROVIDER_WORK_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherProviderWorkspaceId = '33333333-3333-4333-8333-333333333333';
const originatingWorkspaceId = '11111111-1111-4111-8111-111111111111';
const fingerprint = 'a'.repeat(64);
const clock = '2026-09-01T12:00:00.000Z';

suite('Provider Workspace own-work PostgreSQL projection', () => {
  const namespace = 'mgsn_provider_work_read_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });

  const service = () =>
    new ProviderWorkReadModelService(
      new PostgresProviderWorkReadRepository(database.getPool()),
      new PostgresProviderRegistryRepository(database, database.getPool()),
      () => clock
    );

  const principal = (workspaceId = providerWorkspaceId) => ({
    workspaceId,
    userId: `user-${workspaceId}`,
    membershipId: `membership-${workspaceId}`
  });

  async function seedProvider(suffix: string, workspaceId: string, status = 'ACTIVE') {
    const providerId = `provider_read_${suffix}`;
    const capabilityId = `provider-supply-capability_read_${suffix}`;
    const now = '2026-08-01T00:00:00.000Z';
    const providerRecord = {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId: workspaceId,
      displayName: `Private Provider ${suffix}`,
      operationalStatus: status,
      version: 1,
      createdBy: 'private-operator',
      updatedBy: 'private-operator',
      createdAt: now,
      updatedAt: now
    };
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
         provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,
         created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,$4,1,$5::jsonb,'private-operator','private-operator',$6,$6)`,
      [
        providerId,
        workspaceId,
        `Private Provider ${suffix}`,
        status,
        JSON.stringify(providerRecord),
        now
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_provider_supply_capabilities(
         provider_supply_capability_id,version,provider_id,provider_workspace_id,status,jurisdictions,
         service_types,effective_from,effective_until,capacity_units,availability_units,
         verification_state,evidence_references,source_fingerprint_sha256,capability_record,is_current,
         created_by,updated_by,created_at,updated_at
       ) VALUES($1,1,$2,$3,'ACTIVE',ARRAY['US'],ARRAY['TRADEMARK_FILING'],$4,NULL,1,1,
         'VERIFIED_FOR_SUPPLY','[]'::jsonb,$5,'{}'::jsonb,true,'private-operator','private-operator',$4,$4)`,
      [capabilityId, providerId, workspaceId, now, fingerprint]
    );
    return { providerId, capabilityId };
  }

  async function seedAllocation(input: {
    suffix: string;
    providerId: string;
    capabilityId: string;
    status?: 'ACTIVE' | 'CANCELLED' | 'SUPERSEDED';
    updatedAt: string;
    acceptance?: 'ACCEPTED' | 'DECLINED';
    withReturn?: boolean;
  }) {
    const packageId = `service-package_read_${input.suffix}`;
    const evaluationId = `eligibility-evaluation_read_${input.suffix}`;
    const allocationId = `allocation_read_${input.suffix}`;
    const packageFingerprint = createHash('sha256').update(input.suffix).digest('hex');
    await database.getPool().query(
      `INSERT INTO mgsn_service_packages(
         service_package_id,workspace_id,version,status,execution_source_fingerprint_sha256,
         service_package_fingerprint_sha256,jurisdiction,service_type,source_record,
         service_package_record,created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,1,'ADMITTED',$3,$3,'US','TRADEMARK_FILING','{}'::jsonb,'{}'::jsonb,
         'private-operator','private-operator',$4,$4)`,
      [packageId, originatingWorkspaceId, packageFingerprint, input.updatedAt]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_eligibility_evaluations(
         eligibility_evaluation_id,workspace_id,version,service_package_id,service_package_version,
         service_package_fingerprint_sha256,provider_id,provider_version,
         provider_supply_capability_id,provider_supply_capability_version,
         provider_supply_capability_fingerprint_sha256,policy_version,outcome,checks,
         deterministic_fingerprint_sha256,evaluation_record,evaluated_at,created_by
       ) VALUES($1,$2,1,$3,1,$4,$5,1,$6,1,$4,'test-v1','ELIGIBLE','[]'::jsonb,$4,'{}'::jsonb,$7,'private-operator')`,
      [
        evaluationId,
        originatingWorkspaceId,
        packageId,
        packageFingerprint,
        input.providerId,
        input.capabilityId,
        input.updatedAt
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_allocations(
         allocation_id,version,is_current,workspace_id,service_package_id,service_package_version,
         service_package_fingerprint_sha256,eligibility_evaluation_id,eligibility_evaluation_version,
         eligibility_fingerprint_sha256,provider_id,provider_version,provider_supply_capability_id,
         provider_supply_capability_version,provider_supply_capability_fingerprint_sha256,allocated_by,
         rationale,status,allocation_record,created_at,updated_at
       ) VALUES($1,1,true,$2,$3,1,$4,$5,1,$4,$6,1,$7,1,$4,'private-allocator',
         'private rationale',$8,'{}'::jsonb,$9,$9)`,
      [
        allocationId,
        originatingWorkspaceId,
        packageId,
        packageFingerprint,
        evaluationId,
        input.providerId,
        input.capabilityId,
        input.status ?? 'ACTIVE',
        input.updatedAt
      ]
    );
    if (input.acceptance) {
      const acceptanceId = `provider-acceptance_read_${input.suffix}`;
      await database.getPool().query(
        `INSERT INTO mgsn_provider_acceptances(
           provider_acceptance_id,workspace_id,version,allocation_id,allocation_version,
           service_package_id,service_package_version,provider_id,provider_workspace_id,
           provider_actor_id,decision,acknowledgement,response_fingerprint_sha256,
           acceptance_record,responded_at
         ) VALUES($1,$2,1,$3,1,$4,1,$5,$6,'private-provider-actor',$7,
           'private acknowledgement',$8,'{}'::jsonb,$9)`,
        [
          acceptanceId,
          originatingWorkspaceId,
          allocationId,
          packageId,
          input.providerId,
          providerWorkspaceId,
          input.acceptance,
          'b'.repeat(64),
          input.updatedAt
        ]
      );
      if (input.withReturn) {
        await database.getPool().query(
          `INSERT INTO mgsn_provider_returns(
             provider_return_id,version,is_current,workspace_id,service_package_id,
             service_package_version,allocation_id,allocation_version,provider_acceptance_id,
             provider_acceptance_version,provider_id,provider_workspace_id,provider_actor_id,
             work_status_claim,return_fingerprint_sha256,status,supersedes_provider_return_id,
             supersedes_version,return_record,submitted_at
           ) VALUES($1,1,true,$2,$3,1,$4,1,$5,1,$6,$7,'private-provider-actor',
             'private work claim',$8,'CURRENT',NULL,NULL,'{"artifacts":["private"]}'::jsonb,$9)`,
          [
            `provider-return_read_${input.suffix}`,
            originatingWorkspaceId,
            packageId,
            allocationId,
            acceptanceId,
            input.providerId,
            providerWorkspaceId,
            'c'.repeat(64),
            input.updatedAt
          ]
        );
      }
    }
    return { packageId, allocationId };
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
    await database.getPool().query('TRUNCATE mgsn_providers RESTART IDENTITY CASCADE');
  });

  afterAll(() => database.close());

  it('binds normalized Provider ownership, preserves history, and orders deterministically', async () => {
    const own = await seedProvider('own', providerWorkspaceId, 'SUSPENDED');
    const other = await seedProvider('other', otherProviderWorkspaceId);
    await seedAllocation({
      suffix: 'z_active',
      ...own,
      updatedAt: '2026-09-01T10:00:00.000Z'
    });
    await seedAllocation({
      suffix: 'a_cancelled',
      ...own,
      status: 'CANCELLED',
      updatedAt: '2026-09-01T11:00:00.000Z'
    });
    await seedAllocation({
      suffix: 'b_superseded',
      ...own,
      status: 'SUPERSEDED',
      updatedAt: '2026-09-01T11:00:00.000Z'
    });
    await seedAllocation({
      suffix: 'other',
      ...other,
      updatedAt: '2026-09-01T12:00:00.000Z'
    });

    const result = await service().list(principal());

    expect(result.items.map((item) => item.allocation.allocationId)).toEqual([
      'allocation_read_a_cancelled',
      'allocation_read_b_superseded',
      'allocation_read_z_active'
    ]);
    expect(result.items.map((item) => item.allocation.status)).toEqual([
      'CANCELLED',
      'SUPERSEDED',
      'ACTIVE'
    ]);
    expect(result.items.every((item) => item.provider.providerId === own.providerId)).toBe(true);
    const firstPage = await service().list(principal(), { limit: 2 });
    expect(firstPage.items.map((item) => item.allocation.allocationId)).toEqual([
      'allocation_read_a_cancelled',
      'allocation_read_b_superseded'
    ]);
    expect(firstPage.page.nextCursor).toBeTypeOf('string');
    const secondPage = await service().list(principal(), {
      limit: 2,
      cursor: firstPage.page.nextCursor!
    });
    expect(secondPage.items.map((item) => item.allocation.allocationId)).toEqual([
      'allocation_read_z_active'
    ]);
    await expect(service().read(principal(), 'allocation_read_other')).resolves.toMatchObject({
      decision: 'NOT_FOUND_OR_NOT_AUTHORIZED'
    });
  });

  it('projects known absence, bounded Acceptance/Return references, and restart-stable fingerprints', async () => {
    const own = await seedProvider('own', providerWorkspaceId);
    await seedAllocation({ suffix: 'absent', ...own, updatedAt: '2026-09-01T09:00:00.000Z' });
    const current = await seedAllocation({
      suffix: 'accepted',
      ...own,
      acceptance: 'ACCEPTED',
      withReturn: true,
      updatedAt: '2026-09-01T10:00:00.000Z'
    });

    const first = await service().list(principal());
    const restarted = await service().list(principal());
    const accepted = first.items.find(
      (item) => item.allocation.allocationId === current.allocationId
    )!;
    const absent = first.items.find((item) => item.responseState.kind === 'KNOWN_ABSENT')!;

    expect(absent.returnState.kind).toBe('KNOWN_ABSENT');
    expect(accepted.responseState).toMatchObject({ kind: 'KNOWN_RESPONSE', decision: 'ACCEPTED' });
    expect(accepted.returnState).toMatchObject({
      kind: 'KNOWN_RETURN',
      providerReturnRemainsClaimEvidenceNotOfficialTruth: true
    });
    expect(accepted.incomingDataAuthority).toMatchObject({
      state: 'UNKNOWN',
      reason: 'AUTHORITY_STATE_NOT_ESTABLISHED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
    expect(restarted.items.map((item) => item.projectionFingerprintSha256)).toEqual(
      first.items.map((item) => item.projectionFingerprintSha256)
    );
    expect(JSON.stringify(first)).not.toMatch(
      /private rationale|private-allocator|private acknowledgement|private work claim|Private Provider/
    );
  });

  it('fails closed instead of dropping a malformed exact Service Package lineage', async () => {
    const own = await seedProvider('own', providerWorkspaceId);
    const seeded = await seedAllocation({
      suffix: 'malformed',
      ...own,
      updatedAt: '2026-09-01T10:00:00.000Z'
    });
    await database
      .getPool()
      .query(
        'UPDATE mgsn_service_packages SET service_package_fingerprint_sha256=$2 WHERE service_package_id=$1',
        [seeded.packageId, 'd'.repeat(64)]
      );

    await expect(service().list(principal())).rejects.toMatchObject({
      code: 'SOURCE_INCONSISTENT',
      status: 503
    });
    await expect(
      service().read(principal(), seeded.allocationId as `allocation_${string}`)
    ).resolves.toMatchObject({ decision: 'SOURCE_UNAVAILABLE' });
  });
});
