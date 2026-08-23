import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  serializeReadyPackageContentExportV2,
  serializeReadyPackageV2DeliveryRequestV1,
  type ReadyPackageContentExportV2,
  type ReadyPackageV2DeliveryRequestV1
} from '@markorbit/contracts';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  verifyMigrations
} from '@markorbit/persistence';
import { PostgresWorkspaceRepository } from '../src/identity.js';
import {
  PostgresKnowledgeV2DeliveryRepository,
  type KnowledgeV2Delivery
} from '../src/knowledge-v2-delivery.js';

const url = process.env.KNOWLEDGE_V2_DELIVERY_TEST_DATABASE_URL;
const required = process.env.KNOWLEDGE_V2_DELIVERY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'KNOWLEDGE_V2_DELIVERY_POSTGRES_TEST_REQUIRED=1 requires KNOWLEDGE_V2_DELIVERY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const migrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_knowledge_v2_delivery',
    DB_APPLICATION_NAME: 'markorbit-core-knowledge-v2-delivery-tests'
  });
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
let database: ManagedDatabase;
const workspaceId = '018f0000-0000-7000-8000-000000000223';

function exported(): ReadyPackageContentExportV2 {
  const content = '# Durable V2\n';
  const contentSha = sha256(Buffer.from(content, 'utf8'));
  return {
    contractVersion: '2.0',
    objectType: 'READY_PACKAGE_CONTENT_EXPORT',
    readyPackageId: 'rdp_01H00000000000000000000023',
    knowledgeWorkspaceId: 'wsp_01H00000000000000000000023',
    readyPackageDigest: 'd'.repeat(64),
    canonicalDocument: {
      documentId: 'cdd_01H00000000000000000000023',
      promotedAt: '2026-08-12T02:00:00.000Z'
    },
    provenance: {
      origin: {
        kind: 'VAULT_IMPORT',
        inspectionRunId: 'vin_01H00000000000000000000023',
        importIntentId: 'vmi_01H00000000000000000000023',
        importExecutionId: 'vie_01H00000000000000000000023',
        vaultStagingDocumentId: 'vst_01H00000000000000000000023',
        verificationId: 'vsv_01H00000000000000000000023',
        verificationOutcome: 'PASS_WITH_WARNINGS',
        finalizationId: 'vsf_01H00000000000000000000023',
        rootFingerprintSha256: 'e'.repeat(64),
        binding: {
          bindingId: 'vlt_01H00000000000000000000023',
          revision: 2,
          relativeRoot: 'workspace'
        },
        vaultRelativePath: 'workspace/durable.md',
        bindingRelativePath: 'durable.md',
        observedAt: '2026-08-12T01:00:00.000Z',
        reviewedAt: '2026-08-12T01:10:00.000Z',
        importedAt: '2026-08-12T01:20:00.000Z',
        verifiedAt: '2026-08-12T01:30:00.000Z'
      },
      legalTruthVerified: false
    },
    content: {
      sha256: contentSha,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      contentAddressedRef: `cas:sha256:${contentSha}`,
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      content
    }
  };
}

function request(): ReadyPackageV2DeliveryRequestV1 {
  const contentExport = exported();
  return {
    protocolVersion: '1.0',
    objectType: 'READY_PACKAGE_V2_DELIVERY_REQUEST',
    deliveryId: 'rvd_01H00000000000000000000023',
    readyPackageId: contentExport.readyPackageId,
    knowledgeWorkspaceId: contentExport.knowledgeWorkspaceId,
    target: { service: 'MARKORBIT_CORE', workspaceId },
    readyPackageDigest: contentExport.readyPackageDigest,
    contentExportSha256: sha256(serializeReadyPackageContentExportV2(contentExport)),
    contentExport,
    submittedAt: '2026-08-12T02:10:00.000Z'
  };
}

function candidate(requestSha256 = 'f'.repeat(64)): KnowledgeV2Delivery {
  const value = request();
  return {
    deliveryId: value.deliveryId,
    idempotencyKey: `ready-package-v2-delivery:${value.deliveryId}`,
    targetWorkspaceId: workspaceId,
    knowledgeWorkspaceId: value.knowledgeWorkspaceId,
    readyPackageId: value.readyPackageId,
    readyPackageDigest: value.readyPackageDigest,
    contentExportSha256: value.contentExportSha256,
    requestSha256,
    request: value,
    submittedAt: value.submittedAt,
    receivedAt: '2026-08-12T02:10:01.000Z',
    status: 'RECEIVED'
  };
}

integration('PostgreSQL ReadyPackage V2 delivery ledger', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP FUNCTION IF EXISTS protect_knowledge_v2_delivery_immutable_evidence() CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_knowledge_v2_delivery', await migrations());
    await new PostgresWorkspaceRepository(database.getPool()).create({
      workspaceId,
      name: 'Knowledge V2 Delivery',
      slug: 'knowledge-v2-delivery'
    });
  });
  afterAll(async () => database.close());

  it('owns 0048 and additive 0063 without silently upgrading historical RECEIVED rows', async () => {
    const owned = await migrations();
    expect(owned.some((migration) => migration.name === 'core_knowledge_v2_deliveries')).toBe(true);
    expect(
      owned.some((migration) => migration.name === 'core_knowledge_v2_delivery_acceptance')
    ).toBe(true);
    const migrationSql = await readFile(
      path.join(migrationsDirectory, '0063_core_knowledge_v2_delivery_acceptance.sql'),
      'utf8'
    );
    expect(migrationSql).not.toMatch(/UPDATE\s+knowledge_v2_deliveries/iu);
    await migrate(database.getPool(), 'core_knowledge_v2_delivery', owned);
    expect(
      (await migrationStatus(database.getPool(), 'core_knowledge_v2_delivery', owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'core_knowledge_v2_delivery', owned);
  });

  it('persists one durable ACCEPTED result with immutable evidence and replays it after restart', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const original = candidate();
    const first = await new PostgresKnowledgeV2DeliveryRepository(database.getPool()).createOrFind(
      original
    );
    expect(first.created).toBe(true);
    expect(first.delivery.status).toBe('ACCEPTED');
    expect(first.delivery.acceptedAt).toEqual(expect.any(String));
    expect(first.delivery.acceptanceEvidence).toMatchObject({
      evidenceVersion: 'CORE_KNOWLEDGE_V2_ACCEPTANCE_V1',
      contentExportContractVersion: '2.0',
      requestSha256: original.requestSha256,
      provenance: { legalTruthVerified: false }
    });

    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const replay = await new PostgresKnowledgeV2DeliveryRepository(database.getPool()).createOrFind(
      {
        ...candidate(),
        receivedAt: '2026-08-12T02:11:00.000Z'
      }
    );
    expect(replay.created).toBe(false);
    expect(replay.delivery).toEqual(first.delivery);
    const count = await database
      .getPool()
      .query<{ count: number }>(
        "SELECT count(*)::int AS count FROM knowledge_v2_deliveries WHERE idempotency_key='ready-package-v2-delivery:rvd_01H00000000000000000000023'"
      );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('revalidates an exact retry before upgrading a durable historical RECEIVED row', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const legacy = candidate(sha256(JSON.stringify(request(), null, 2)));
    await database.getPool().query(
      `INSERT INTO knowledge_v2_deliveries(
        delivery_id,idempotency_key,target_workspace_id,knowledge_workspace_id,ready_package_id,
        ready_package_digest,content_export_sha256,request_sha256,request_json,submitted_at,
        received_at,status
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'RECEIVED')`,
      [
        legacy.deliveryId,
        legacy.idempotencyKey,
        legacy.targetWorkspaceId,
        legacy.knowledgeWorkspaceId,
        legacy.readyPackageId,
        legacy.readyPackageDigest,
        legacy.contentExportSha256,
        legacy.requestSha256,
        serializeReadyPackageV2DeliveryRequestV1(legacy.request),
        legacy.submittedAt,
        legacy.receivedAt
      ]
    );
    const before = await database
      .getPool()
      .query<{ status: string; accepted_at: Date | null }>(
        'SELECT status,accepted_at FROM knowledge_v2_deliveries WHERE delivery_id=$1',
        [legacy.deliveryId]
      );
    expect(before.rows[0]).toMatchObject({ status: 'RECEIVED', accepted_at: null });

    const reconciled = await new PostgresKnowledgeV2DeliveryRepository(
      database.getPool()
    ).createOrFind(legacy);
    expect(reconciled.created).toBe(false);
    expect(reconciled.delivery.status).toBe('ACCEPTED');
    expect(reconciled.delivery.acceptanceEvidence).toMatchObject({
      requestSha256: legacy.requestSha256,
      canonicalDocument: { documentId: legacy.request.contentExport.canonicalDocument.documentId },
      provenance: { legalTruthVerified: false }
    });
  });

  it('does not upgrade historical RECEIVED when the retry exact-request SHA differs', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const legacy = candidate('4'.repeat(64));
    await database.getPool().query(
      `INSERT INTO knowledge_v2_deliveries(
        delivery_id,idempotency_key,target_workspace_id,knowledge_workspace_id,ready_package_id,
        ready_package_digest,content_export_sha256,request_sha256,request_json,submitted_at,
        received_at,status
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'RECEIVED')`,
      [
        legacy.deliveryId,
        legacy.idempotencyKey,
        legacy.targetWorkspaceId,
        legacy.knowledgeWorkspaceId,
        legacy.readyPackageId,
        legacy.readyPackageDigest,
        legacy.contentExportSha256,
        legacy.requestSha256,
        serializeReadyPackageV2DeliveryRequestV1(legacy.request),
        legacy.submittedAt,
        legacy.receivedAt
      ]
    );
    const replay = await new PostgresKnowledgeV2DeliveryRepository(database.getPool()).createOrFind(
      candidate('5'.repeat(64))
    );
    expect(replay.delivery.status).toBe('RECEIVED');
    expect(replay.delivery.acceptedAt).toBeUndefined();
    expect(replay.delivery.acceptanceEvidence).toBeUndefined();
  });

  it('allows only one concurrent durable acceptance for the same frozen identity', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const repository = new PostgresKnowledgeV2DeliveryRepository(database.getPool());
    const results = await Promise.all([
      repository.createOrFind(candidate('1'.repeat(64))),
      repository.createOrFind(candidate('1'.repeat(64)))
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.delivery.deliveryId)).size).toBe(1);
    expect(new Set(results.map((result) => result.delivery.requestSha256)).size).toBe(1);
    expect(new Set(results.map((result) => result.delivery.status))).toEqual(new Set(['ACCEPTED']));
    expect(new Set(results.map((result) => result.delivery.acceptedAt)).size).toBe(1);
  });

  it('preserves the first exact-request identity under a concurrent conflicting retry', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const repository = new PostgresKnowledgeV2DeliveryRepository(database.getPool());
    const results = await Promise.all([
      repository.createOrFind(candidate('2'.repeat(64))),
      repository.createOrFind(candidate('3'.repeat(64)))
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.delivery.requestSha256)).size).toBe(1);
    expect(new Set(results.map((result) => result.delivery.status))).toEqual(new Set(['ACCEPTED']));
    const count = await database
      .getPool()
      .query<{ count: number }>('SELECT count(*)::int AS count FROM knowledge_v2_deliveries');
    expect(count.rows[0]!.count).toBe(1);
  });

  it('enforces frozen input and terminal ACCEPTED evidence immutability in PostgreSQL', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const repository = new PostgresKnowledgeV2DeliveryRepository(database.getPool());
    await repository.createOrFind(candidate('6'.repeat(64)));
    await expect(
      database
        .getPool()
        .query(
          "UPDATE knowledge_v2_deliveries SET ready_package_digest=$2 WHERE delivery_id=$1",
          [request().deliveryId, '7'.repeat(64)]
        )
    ).rejects.toThrow(/frozen input is immutable/u);
    await expect(
      database
        .getPool()
        .query("UPDATE knowledge_v2_deliveries SET status='RECEIVED' WHERE delivery_id=$1", [
          request().deliveryId
        ])
    ).rejects.toThrow(/terminal status is immutable/u);
    await expect(
      database
        .getPool()
        .query(
          "UPDATE knowledge_v2_deliveries SET acceptance_evidence=jsonb_set(acceptance_evidence,'{tampered}','true'::jsonb) WHERE delivery_id=$1",
          [request().deliveryId]
        )
    ).rejects.toThrow(/acceptance evidence is immutable/u);
  });
});
