import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  ContentKit,
  VisualBriefId,
  VisualOutputReferenceId
} from '@markorbit/contracts/daily-workspace';
import {
  PostgresVisualBridgeStore,
  VisualBridgeService,
  type ContentKitReader,
  type LiteVisualRequestEnvelope,
  type VisualEngineConsumerPort
} from '../src/visual-bridge.js';

const url = process.env.LITE_VISUAL_BRIDGE_TEST_DATABASE_URL;
const required = process.env.LITE_VISUAL_BRIDGE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_VISUAL_BRIDGE_TEST_DATABASE_URL is required when LITE_VISUAL_BRIDGE_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '81818181-8181-4818-8818-818181818181';
const otherWorkspaceId = '82828282-8282-4828-8828-828282828282';

const kit: ContentKit = {
  schemaVersion: 1,
  contentKitId: 'content-kit_visual',
  workspaceId,
  version: 3,
  contentPick: { id: 'content-pick_visual', version: 1 },
  contentOpportunity: { id: 'content-opportunity_visual', version: 1 },
  sources: [],
  whyItMatters: 'A filing-fee change affects practitioner planning.',
  whyPublish: 'Explain the filing-fee change with source-grounded context.',
  angles: [
    {
      angleId: 'angle_visual',
      title: 'What practitioners should review before the fee change',
      thesis: 'Review filing plans before the new schedule applies.',
      audience: 'US trademark practitioners',
      evidenceNotes: []
    }
  ],
  audience: 'US trademark practitioners',
  platformVariants: [],
  draftReferences: [],
  publishPackageReferences: [],
  visualBriefReferences: [],
  externalPublishExecuted: false,
  createdAt: '2026-08-18T08:00:00.000Z',
  updatedAt: '2026-08-18T08:05:00.000Z'
};

suite('PostgreSQL Lite Visual Bridge', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-visual-bridge-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_visual_bridge_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let briefId = 0;
  let outputId = 0;
  let tick = 0;
  let consumerCalls = 0;
  const requests: LiteVisualRequestEnvelope[] = [];
  const now = () => new Date(Date.UTC(2026, 7, 18, 8, 10, tick++)).toISOString();
  const nextBriefId = () => `visual-brief_test-${++briefId}` as VisualBriefId;
  const nextOutputId = () => `visual-output_test-${++outputId}` as VisualOutputReferenceId;
  const contentKits: ContentKitReader = {
    find(requestWorkspaceId, subjectUserId, contentPickId) {
      if (requestWorkspaceId !== workspaceId) throw new Error('unexpected workspace');
      if (subjectUserId !== 'user_visual') throw new Error('unexpected user');
      if (contentPickId !== kit.contentPick.id) throw new Error('unexpected content pick');
      return Promise.resolve(structuredClone(kit));
    }
  };
  const consumer: VisualEngineConsumerPort = {
    start(request) {
      consumerCalls += 1;
      requests.push(structuredClone(request));
      return Promise.resolve({
        requestReference: 'illustration-request://visual-test-1',
        status: 'PLANNING_REQUIRED'
      });
    }
  };
  const store = () =>
    new PostgresVisualBridgeStore(database, database.getPool(), now, nextBriefId, nextOutputId);
  const service = (visualStore: PostgresVisualBridgeStore) =>
    new VisualBridgeService(contentKits, visualStore, consumer, 'markorbit-lite-editorial-v1');

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_visual_bridge_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Visual Bridge Test','visual-bridge-test'),
       ($2,'Visual Bridge Other','visual-bridge-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    briefId = 0;
    outputId = 0;
    tick = 0;
    consumerCalls = 0;
    requests.length = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_visual_bridge_commands,lite_visual_output_references,lite_visual_requests,lite_visual_briefs,lite_content_opportunities,lite_today_recommendations CASCADE'
      );
    await database.getPool().query(
      `INSERT INTO lite_today_recommendations(
        workspace_id,today_recommendation_id,version,recommendation_fingerprint_sha256,
        document_json,created_at,updated_at
      ) VALUES($1,'today-recommendation_visual',1,$2,'{}'::jsonb,$3,$3)`,
      [workspaceId, 'a'.repeat(64), kit.createdAt]
    );
    await database.getPool().query(
      `INSERT INTO lite_content_opportunities(
        workspace_id,content_opportunity_id,version,source_recommendation_id,
        source_recommendation_version,content_opportunity_fingerprint_sha256,
        document_json,created_at,updated_at
      ) VALUES($1,$2,$3,'today-recommendation_visual',1,$4,'{}'::jsonb,$5,$5)`,
      [
        workspaceId,
        kit.contentOpportunity.id,
        kit.contentOpportunity.version,
        'a'.repeat(64),
        kit.createdAt
      ]
    );
  });

  afterAll(() => database.close());

  it('persists a reuse-first brief, idempotent planning request, and later opaque delivery reference', async () => {
    const visualStore = store();
    const visualService = service(visualStore);
    const created = await visualService.createBrief({
      workspaceId,
      subjectUserId: 'user_visual',
      contentPickId: kit.contentPick.id,
      expectedContentKit: { id: kit.contentKitId, version: kit.version },
      requestedIpPackage: 'MOKI',
      outputKind: 'XIAOHONGSHU_COVER',
      sceneIntent: 'MOKI points at a simple filing-fee timeline.',
      idempotencyKey: 'visual-brief-1'
    });

    expect(created.brief).toMatchObject({
      contentKit: { id: kit.contentKitId, version: kit.version },
      outputKind: 'XIAOHONGSHU_COVER',
      aspectRatio: '3:4',
      requestedIpPackage: 'MOKI',
      reuseFirstRequired: true,
      paidExecutionAuthorized: false
    });
    expect(created.visualBriefFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      (
        await database.getPool().query<{
          content_opportunity_id: string;
          content_opportunity_version: number;
        }>(
          `SELECT content_opportunity_id,content_opportunity_version
           FROM lite_visual_briefs
           WHERE workspace_id=$1 AND visual_brief_id=$2 AND version=$3`,
          [workspaceId, created.brief.visualBriefId, created.brief.version]
        )
      ).rows[0]
    ).toEqual({
      content_opportunity_id: kit.contentOpportunity.id,
      content_opportunity_version: kit.contentOpportunity.version
    });
    expect(
      await visualStore.listByContentKit(workspaceId, {
        id: kit.contentKitId,
        version: kit.version
      })
    ).toEqual([{ id: created.brief.visualBriefId, version: 1 }]);

    const command = {
      workspaceId,
      visualBrief: { id: created.brief.visualBriefId, version: 1 },
      expectedVisualBriefFingerprintSha256: created.visualBriefFingerprintSha256,
      idempotencyKey: 'visual-request-1'
    } as const;
    const planning = await visualService.startRequest(command);
    const replay = await visualService.startRequest(command);

    expect(replay).toEqual(planning);
    expect(consumerCalls).toBe(1);
    expect(requests[0]).toMatchObject({
      api_version: 'lite-illustration-request/v1',
      operation: 'request.start',
      input: {
        ip_id: 'MOKI',
        style_id: 'markorbit-lite-editorial-v1',
        scene_intent: 'MOKI points at a simple filing-fee timeline.'
      }
    });
    expect(planning.output).toMatchObject({
      owner: 'VISUAL_ENGINE',
      requestReference: 'illustration-request://visual-test-1',
      status: 'PLANNING_REQUIRED',
      providerExecutionAuthorizedByLite: false,
      paidExecutionAuthorizedByLite: false
    });
    expect(planning.output.outputReference).toBeUndefined();

    const restarted = store();
    expect(
      await restarted.findBrief(workspaceId, {
        id: created.brief.visualBriefId,
        version: 1
      })
    ).toEqual(created);
    expect(
      await restarted.findBrief(otherWorkspaceId, {
        id: created.brief.visualBriefId,
        version: 1
      })
    ).toBeUndefined();
    expect(
      await restarted.findOutput(workspaceId, {
        id: planning.output.visualOutputReferenceId,
        version: 1
      })
    ).toEqual(planning.output);

    const ready = await restarted.recordOutput({
      workspaceId,
      visualBrief: { id: created.brief.visualBriefId, version: 1 },
      requestReference: planning.requestReference,
      status: 'READY',
      outputReference: 'delivery://visual-test-final-1',
      qcStatus: 'PASS',
      createdAt: '2026-08-18T08:30:00.000Z',
      idempotencyKey: 'visual-output-1'
    });
    expect(ready).toMatchObject({
      owner: 'VISUAL_ENGINE',
      outputReference: 'delivery://visual-test-final-1',
      status: 'READY',
      qcStatus: 'PASS',
      providerExecutionAuthorizedByLite: false,
      paidExecutionAuthorizedByLite: false
    });
  });

  it('rejects stale/idempotency drift and raw output paths', async () => {
    const visualStore = store();
    const visualService = service(visualStore);
    const first = await visualService.createBrief({
      workspaceId,
      subjectUserId: 'user_visual',
      contentPickId: kit.contentPick.id,
      expectedContentKit: { id: kit.contentKitId, version: kit.version },
      requestedIpPackage: 'MOKI',
      outputKind: 'MOMENTS_SOCIAL_CARD',
      sceneIntent: 'MOKI shows the filing-fee change.',
      idempotencyKey: 'visual-brief-conflict'
    });
    await expect(
      visualService.createBrief({
        workspaceId,
        subjectUserId: 'user_visual',
        contentPickId: kit.contentPick.id,
        expectedContentKit: { id: kit.contentKitId, version: kit.version },
        requestedIpPackage: 'MOKI',
        outputKind: 'MOMENTS_SOCIAL_CARD',
        sceneIntent: 'A different scene intent.',
        idempotencyKey: 'visual-brief-conflict'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });

    const planning = await visualService.startRequest({
      workspaceId,
      visualBrief: { id: first.brief.visualBriefId, version: 1 },
      expectedVisualBriefFingerprintSha256: first.visualBriefFingerprintSha256,
      idempotencyKey: 'visual-request-conflict'
    });
    await expect(
      visualStore.recordOutput({
        workspaceId,
        visualBrief: { id: first.brief.visualBriefId, version: 1 },
        requestReference: planning.requestReference,
        status: 'READY',
        outputReference: '/tmp/raw/provider/output.png',
        createdAt: '2026-08-18T08:45:00.000Z',
        idempotencyKey: 'visual-output-raw'
      })
    ).rejects.toMatchObject({ code: 'VISUAL_CONSUMER_REJECTED', status: 502 });
  });
});
