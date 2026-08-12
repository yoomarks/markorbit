import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  serializeReadyPackageContentExportV2,
  type ReadyPackageContentExportV2,
  type ReadyPackageV2DeliveryRequestV1
} from '@markorbit/contracts/knowledge-ready-package-v2';
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
        'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_knowledge_v2_delivery', await migrations());
    await new PostgresWorkspaceRepository(database.getPool()).create({
      workspaceId,
      name: 'Knowledge V2 Delivery',
      slug: 'knowledge-v2-delivery'
    });
  });
  afterAll(async () => database.close());

  it('owns and reapplies migration 0048 deterministically', async () => {
    const owned = await migrations();
    expect(owned.at(-1)?.name).toBe('core_knowledge_v2_deliveries');
    await migrate(database.getPool(), 'core_knowledge_v2_delivery', owned);
    expect(
      (await migrationStatus(database.getPool(), 'core_knowledge_v2_delivery', owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'core_knowledge_v2_delivery', owned);
  });

  it('persists one logical delivery and replays it after a database restart', async () => {
    const original = candidate();
    const first = await new PostgresKnowledgeV2DeliveryRepository(database.getPool()).createOrFind(
      original
    );
    expect(first.created).toBe(true);
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const replay = await new PostgresKnowledgeV2DeliveryRepository(database.getPool()).createOrFind({
      ...candidate(),
      receivedAt: '2026-08-12T02:11:00.000Z'
    });
    expect(replay.created).toBe(false);
    expect(replay.delivery).toEqual(first.delivery);
    const count = await database
      .getPool()
      .query<{ count: number }>(
        "SELECT count(*)::int AS count FROM knowledge_v2_deliveries WHERE idempotency_key='ready-package-v2-delivery:rvd_01H00000000000000000000023'"
      );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('allows only one concurrent creation for the same frozen idempotency identity', async () => {
    await database.getPool().query('DELETE FROM knowledge_v2_deliveries');
    const repository = new PostgresKnowledgeV2DeliveryRepository(database.getPool());
    const results = await Promise.all([
      repository.createOrFind(candidate('1'.repeat(64))),
      repository.createOrFind(candidate('1'.repeat(64)))
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.delivery.deliveryId)).size).toBe(1);
    expect(new Set(results.map((result) => result.delivery.requestSha256)).size).toBe(1);
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
    const count = await database
      .getPool()
      .query<{ count: number }>('SELECT count(*)::int AS count FROM knowledge_v2_deliveries');
    expect(count.rows[0]!.count).toBe(1);
  });
});
