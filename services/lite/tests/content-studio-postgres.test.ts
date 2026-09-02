import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  ContentDraft,
  ContentOpportunity,
  ProductLoopSourceReference
} from '@markorbit/contracts/product-loop';
import type { VisualBrief, VisualOutputReference } from '@markorbit/contracts/daily-workspace';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  PostgresContentStudioReader,
  type ContentStudioWorkDetail,
  type ContentStudioWorkList
} from '../src/content-studio.js';
import type { VisualBriefRecord } from '../src/visual-bridge.js';
import { PostgresLiteContentPreparationStore } from '../src/content-preparation.js';
import { PostgresProductLoopFeedbackStore } from '../src/feedback.js';
import { DailyOrbitService, PostgresDailySignalReader } from '../src/daily-orbit.js';
import type { DailySignal } from '@markorbit/contracts/daily-workspace';
import { PostgresPreparedActionStore } from '../src/prepared-action.js';

const url = process.env.LITE_CONTENT_STUDIO_TEST_DATABASE_URL;
if (process.env.LITE_CONTENT_STUDIO_POSTGRES_TEST_REQUIRED === '1' && !url)
  throw new Error(
    'LITE_CONTENT_STUDIO_TEST_DATABASE_URL is required when LITE_CONTENT_STUDIO_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '37373737-3737-4373-8373-373737373737';
const otherWorkspaceId = '38383838-3838-4383-8383-383838383838';
const secret = 'lite-372-real-runtime-secret-0123456789';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  workspaceId,
  userId: 'user_studio_reader',
  sessionId: 'session_studio_reader',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  membershipId: 'membership_studio_reader',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const source: ProductLoopSourceReference = {
  schemaVersion: 1,
  owner: 'CORE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_studio',
  sourceVersion: '1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-08-31T00:00:00.000Z'
};

suite('#372 PostgreSQL Content Studio stable work reads', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-content-studio-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_content_studio_test'
  });
  const reader = new PostgresContentStudioReader(database);
  let runtime: ChildProcess | undefined;
  let baseUrl = '';
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 31, 0, 0, tick++)).toISOString();

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    await migrate(
      database.getPool(),
      'lite_content_studio_test',
      await loadMigrationsForOwner(
        path.resolve('../../infrastructure/persistence/migrations'),
        path.resolve('../../infrastructure/persistence/migration-owners.json'),
        '@markorbit/lite-service'
      )
    );
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
      ($1,'Studio test','studio-372-test'),($2,'Other Workspace','studio-372-other') ON CONFLICT DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
    runtime = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: path.resolve('.'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        LITE_DATABASE_URL: url!,
        PORT: '0',
        MO_INTERNAL_SERVICE_SECRET: secret
      }
    });
    const child = runtime;
    baseUrl = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Lite startup timed out: ${output}`)), 15000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Lite exited (${code}): ${output}`));
      });
      child.stderr?.on('data', (chunk) => {
        output += String(chunk);
      });
      child.stdout?.on('data', (chunk) => {
        output += String(chunk);
        const match = /listening on (http:\/\/127\.0\.0\.1:\d+)/u.exec(output);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      });
    });
  }, 20000);

  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_content_preparation_commands,lite_product_loop_feedback_commands,lite_product_loop_use_feedback,lite_publish_packages,lite_content_review_decisions,lite_content_drafts,lite_content_opportunities,lite_today_recommendations,lite_daily_signals CASCADE'
      );
  });

  afterAll(async () => {
    if (runtime && runtime.exitCode === null) {
      const exited = once(runtime, 'exit');
      runtime.kill();
      await exited;
    }
    await database.close();
  });

  function writer(key: string) {
    return new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      {
        resolve: () => Promise.resolve(source)
      },
      now,
      {
        recommendation: () => `today-recommendation_${key}`,
        opportunity: () => `content-opportunity_${key}`,
        draft: () => `content-draft_${key}`,
        review: () => `content-review-decision_${key}`,
        publishPackage: () => `publish-package_${key}`
      }
    );
  }

  async function work(key: string, scope = workspaceId) {
    const store = writer(key);
    const recommendation = await store.createRecommendation({
      workspaceId: scope,
      title: `Source ${key}`,
      explanation: 'Accepted source',
      sources: [source],
      idempotencyKey: `rec-${key}`
    });
    const opportunity = await store.acceptContentOpportunity({
      workspaceId: scope,
      recommendation: { id: recommendation.todayRecommendationId, version: 1 },
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      title: `Work ${key}`,
      rationale: 'Explain the source to practitioners',
      idempotencyKey: `opp-${key}`
    });
    return { store, opportunity };
  }

  async function lineage(key = 'a') {
    const { store, opportunity } = await work(key);
    const draft = await store.createDraft({
      workspaceId,
      contentOpportunity: { id: opportunity.contentOpportunityId, version: 1 },
      expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
      title: 'Draft title',
      body: 'First draft',
      idempotencyKey: `draft-${key}`
    });
    const ready = await store.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: 1,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: `ready-${key}`
    });
    const review = await store.recordReview({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: principal.userId,
      rationale: 'Reviewed exact version',
      idempotencyKey: `review-${key}`
    });
    const pkg = await store.preparePublishPackage({
      workspaceId,
      contentDraft: review.contentDraft as { id: ContentDraft['contentDraftId']; version: number },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: `package-${key}`
    });
    const feedback = await new PostgresProductLoopFeedbackStore(
      database,
      database.getPool(),
      now
    ).recordUseFeedback({
      workspaceId,
      publishPackage: { id: pkg.publishPackageId, version: pkg.version },
      expectedPublishPackageFingerprintSha256: pkg.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_PUBLISHED',
      recordedByPrincipalId: principal.userId,
      idempotencyKey: `feedback-${key}`
    });
    return { store, opportunity, draft, ready, review, pkg, feedback };
  }

  async function get<T>(suffix = '', actor = principal): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}/v1/content-studio/works${suffix}`, {
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(actor),
        'x-markorbit-workspace-id': actor.workspaceId
      }
    });
    return { status: response.status, body: (await response.json()) as T };
  }

  async function insertOpportunity(doc: ContentOpportunity) {
    await database.getPool().query(
      `INSERT INTO lite_content_opportunities
      (workspace_id,content_opportunity_id,version,source_recommendation_id,source_recommendation_version,content_opportunity_fingerprint_sha256,document_json,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
      [
        doc.workspaceId,
        doc.contentOpportunityId,
        doc.version,
        doc.sourceRecommendation.id,
        doc.sourceRecommendation.version,
        doc.contentOpportunityFingerprintSha256,
        JSON.stringify(doc),
        doc.createdAt,
        doc.updatedAt
      ]
    );
  }

  async function insertDraft(doc: ContentDraft) {
    await database.getPool().query(
      `INSERT INTO lite_content_drafts
      (workspace_id,content_draft_id,version,content_opportunity_id,content_opportunity_version,status,content_draft_fingerprint_sha256,document_json,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
      [
        doc.workspaceId,
        doc.contentDraftId,
        doc.version,
        doc.contentOpportunity.id,
        doc.contentOpportunity.version,
        doc.status,
        doc.contentDraftFingerprintSha256,
        JSON.stringify(doc),
        doc.createdAt,
        doc.updatedAt
      ]
    );
  }

  async function insertVisualBrief(
    opportunity: ContentOpportunity,
    key: string,
    options: Readonly<{ legacy?: boolean; scope?: string; createdAt?: string }> = {}
  ): Promise<VisualBriefRecord> {
    const scope = options.scope ?? opportunity.workspaceId;
    const createdAt = options.createdAt ?? now();
    const brief: VisualBrief = {
      schemaVersion: 1,
      visualBriefId: `visual-brief_${key}`,
      workspaceId: scope,
      version: 1,
      contentKit: { id: `content-kit_${key}`, version: 1 },
      title: `Visual ${key}`,
      keyMessage: 'Explain the durable source.',
      audience: 'Trademark practitioners',
      outputKind: 'MOMENTS_SOCIAL_CARD',
      aspectRatio: '1:1',
      styleIntent: 'Clear editorial visual',
      requestedIpPackage: 'MOKI',
      sceneIntent: `Scene ${key}`,
      reuseFirstRequired: true,
      paidExecutionAuthorized: false,
      createdAt
    };
    const record: VisualBriefRecord = {
      brief,
      visualBriefFingerprintSha256: 'b'.repeat(64),
      consumerIdentity: { ipId: 'MOKI', styleId: 'markorbit-lite-editorial-v1' }
    };
    await database.getPool().query(
      `INSERT INTO lite_visual_briefs(
        workspace_id,visual_brief_id,version,content_kit_id,content_kit_version,
        content_opportunity_id,content_opportunity_version,
        visual_brief_fingerprint_sha256,document_json,created_at
      ) VALUES($1,$2,1,$3,1,$4,$5,$6,$7::jsonb,$8)`,
      [
        scope,
        brief.visualBriefId,
        brief.contentKit.id,
        options.legacy ? null : opportunity.contentOpportunityId,
        options.legacy ? null : opportunity.version,
        record.visualBriefFingerprintSha256,
        JSON.stringify(record),
        createdAt
      ]
    );
    return record;
  }

  async function insertVisualOutput(
    record: VisualBriefRecord,
    key: string,
    createdAt = now()
  ): Promise<VisualOutputReference> {
    const output: VisualOutputReference = {
      schemaVersion: 1,
      visualOutputReferenceId: `visual-output_${key}`,
      workspaceId: record.brief.workspaceId,
      version: 1,
      visualBrief: { id: record.brief.visualBriefId, version: record.brief.version },
      owner: 'VISUAL_ENGINE',
      requestReference: `illustration-request://${key}`,
      outputReference: `delivery://${key}`,
      status: 'READY',
      qcStatus: 'PASS',
      providerExecutionAuthorizedByLite: false,
      paidExecutionAuthorizedByLite: false,
      createdAt
    };
    await database.getPool().query(
      `INSERT INTO lite_visual_output_references(
        workspace_id,visual_output_reference_id,version,visual_brief_id,visual_brief_version,
        request_reference,output_reference,status,qc_status,document_json,created_at
      ) VALUES($1,$2,1,$3,1,$4,$5,$6,$7,$8::jsonb,$9)`,
      [
        output.workspaceId,
        output.visualOutputReferenceId,
        output.visualBrief.id,
        output.requestReference,
        output.outputReference,
        output.status,
        output.qcStatus,
        JSON.stringify(output),
        createdAt
      ]
    );
    return output;
  }

  it('returns a truthful empty Workspace and accepted work without a Draft through actual main.ts HTTP', async () => {
    expect(await get<ContentStudioWorkList>()).toMatchObject({
      status: 200,
      body: { items: [], nextAfter: null }
    });
    const { opportunity } = await work('no-draft');
    const list = await get<ContentStudioWorkList>();
    expect(list.body).toMatchObject({ partial: false, warnings: [] });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      contentOpportunity: { id: opportunity.contentOpportunityId, version: 1 },
      latestDraft: null,
      latestDraftReview: null,
      latestPublishPackage: null,
      latestPackageFeedback: null
    });
    expect(
      await get<ContentStudioWorkDetail>(`/${opportunity.contentOpportunityId}`)
    ).toMatchObject({
      status: 200,
      body: {
        opportunity,
        drafts: [],
        reviewedDrafts: [],
        reviews: [],
        publishPackages: [],
        feedback: [],
        visualBriefs: [],
        visualOutputs: [],
        partial: false,
        warnings: []
      }
    });
  });

  it('reads exact ordered Visual Brief and Output lineage and survives reader restart', async () => {
    const { opportunity } = await work('visual-history');
    const later = await insertVisualBrief(opportunity, 'later', {
      createdAt: '2026-08-31T02:00:00.000Z'
    });
    const earlier = await insertVisualBrief(opportunity, 'earlier', {
      createdAt: '2026-08-31T01:00:00.000Z'
    });
    const laterOutput = await insertVisualOutput(later, 'later', '2026-08-31T04:00:00.000Z');
    const earlierOutput = await insertVisualOutput(earlier, 'earlier', '2026-08-31T03:00:00.000Z');

    const restarted = new PostgresContentStudioReader(database);
    const detail = await restarted.find(workspaceId, opportunity.contentOpportunityId);
    expect(detail.visualBriefs).toEqual([earlier, later]);
    expect(detail.visualOutputs).toEqual([earlierOutput, laterOutput]);
    expect(detail).toMatchObject({ partial: false, warnings: [] });
    expect((await restarted.list(workspaceId)).items[0]).toMatchObject({
      visualBriefCount: 2,
      visualOutputCount: 2
    });
  });

  it('isolates Visual lineage by exact ContentOpportunity version and Workspace', async () => {
    const { opportunity } = await work('visual-isolation');
    const v1Brief = await insertVisualBrief(opportunity, 'v1');
    await insertVisualOutput(v1Brief, 'v1');
    const nextRecommendation = await writer('visual-isolation-v2').createRecommendation({
      workspaceId,
      title: 'Version two source',
      explanation: 'Version isolation',
      sources: [source],
      idempotencyKey: 'rec-visual-isolation-v2'
    });
    const versionTwo: ContentOpportunity = {
      ...opportunity,
      version: 2,
      sourceRecommendation: { id: nextRecommendation.todayRecommendationId, version: 1 },
      updatedAt: now()
    };
    await insertOpportunity(versionTwo);
    const other = await work('visual-other', otherWorkspaceId);
    const otherBrief = await insertVisualBrief(other.opportunity, 'other', {
      scope: otherWorkspaceId
    });
    await insertVisualOutput(otherBrief, 'other');

    const detail = await reader.find(workspaceId, opportunity.contentOpportunityId);
    expect(detail.opportunity.version).toBe(2);
    expect(detail.visualBriefs).toEqual([]);
    expect(detail.visualOutputs).toEqual([]);
    expect(
      (await reader.find(otherWorkspaceId, other.opportunity.contentOpportunityId)).visualBriefs
    ).toEqual([otherBrief]);
  });

  it('fails closed for legacy NULL lineage while returning stable linked history', async () => {
    const { opportunity } = await work('mixed-visual');
    const linked = await insertVisualBrief(opportunity, 'linked');
    const linkedOutput = await insertVisualOutput(linked, 'linked');
    await insertVisualBrief(opportunity, 'legacy', { legacy: true });

    const detail = await reader.find(workspaceId, opportunity.contentOpportunityId);
    expect(detail.visualBriefs).toEqual([linked]);
    expect(detail.visualOutputs).toEqual([linkedOutput]);
    expect(detail).toMatchObject({
      partial: true,
      warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
    });
    expect(await reader.list(workspaceId)).toMatchObject({
      partial: true,
      warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
    });
  });

  it('does not infer a legacy NULL Visual Brief into an exact empty work', async () => {
    const owner = await work('legacy-owner');
    const emptyWork = await work('legacy-empty');
    await insertVisualBrief(owner.opportunity, 'legacy-only', { legacy: true });

    const detail = await reader.find(workspaceId, emptyWork.opportunity.contentOpportunityId);
    expect(detail.visualBriefs).toEqual([]);
    expect(detail.visualOutputs).toEqual([]);
    expect(detail).toMatchObject({
      partial: true,
      warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
    });
  });

  it('reconstructs exact lineage and keeps old reviewed versions separate from the latest Draft', async () => {
    const { store, opportunity, ready, review, pkg, feedback } = await lineage();
    const before = await reader.list(workspaceId);
    expect(before.items[0]?.latestDraftReview).toEqual(review);
    expect(before.items[0]?.latestPackageFeedback).toEqual(feedback);
    const revised = await store.reviseDraft({
      workspaceId,
      contentDraftId: ready.contentDraftId,
      expectedVersion: ready.version,
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      title: 'New unreviewed draft',
      body: 'Changed since review',
      idempotencyKey: 'revision-after-review'
    });
    const detail = await get<ContentStudioWorkDetail>(`/${opportunity.contentOpportunityId}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      opportunity,
      drafts: [revised],
      reviewedDrafts: [ready],
      reviews: [review],
      publishPackages: [pkg],
      feedback: [feedback]
    });
    expect(detail.body.drafts[0]).toMatchObject({ humanReviewRequired: true, published: false });
    expect(detail.body.publishPackages[0]?.externalPublishExecuted).toBe(false);
    expect(detail.body.feedback[0]).toMatchObject({
      outcome: 'USER_REPORTED_PUBLISHED',
      externalActionExecutedByMarkOrbit: false,
      externalOutcomeVerifiedByMarkOrbit: false
    });
    const list = await reader.list(workspaceId);
    expect(list.items[0]?.latestDraftReview).toBeNull();
    expect(list.items[0]?.latestPublishPackage?.contentDraft).toEqual(review.contentDraft);
  });

  it('resolves the latest version independently for multiple stored Draft identities', async () => {
    const { opportunity, ready } = await lineage();
    // Existing schema permits historical version rows for another identity, but only one v1 root.
    // Do not remove that integrity constraint merely to construct this read-compatibility case.
    const second: ContentDraft = {
      ...ready,
      contentDraftId: 'content-draft_second',
      version: 2,
      status: 'DRAFT',
      title: 'Other identity',
      updatedAt: now()
    };
    await insertDraft(second);
    await insertDraft({ ...second, version: 3, title: 'Latest other identity', updatedAt: now() });
    const detail = await reader.find(workspaceId, opportunity.contentOpportunityId);
    expect(detail.drafts.map((draft) => [draft.contentDraftId, draft.version])).toEqual([
      [ready.contentDraftId, 2],
      ['content-draft_second', 3]
    ]);
    expect(detail.reviews).toHaveLength(1);
  });

  it('dedupes latest Opportunity versions before filtering active work and follows only the exact current lineage', async () => {
    const { opportunity } = await lineage('versioned');
    const rec = await writer('new-source').createRecommendation({
      workspaceId,
      title: 'New source',
      explanation: 'Version test',
      sources: [source],
      idempotencyKey: 'new-source'
    });
    const current: ContentOpportunity = {
      ...opportunity,
      version: 2,
      sourceRecommendation: { id: rec.todayRecommendationId, version: rec.version },
      title: 'Current title',
      updatedAt: now()
    };
    await insertOpportunity(current);
    expect((await reader.list(workspaceId)).items).toMatchObject([
      {
        contentOpportunity: { id: opportunity.contentOpportunityId, version: 2 },
        title: 'Current title',
        latestDraft: null
      }
    ]);
    expect(await reader.find(workspaceId, opportunity.contentOpportunityId)).toMatchObject({
      opportunity: current,
      drafts: [],
      reviews: [],
      publishPackages: [],
      feedback: []
    });
    await database
      .getPool()
      .query(
        "UPDATE lite_content_opportunities SET document_json=jsonb_set(document_json,'{status}','\"REJECTED\"') WHERE workspace_id=$1 AND content_opportunity_id=$2 AND version=2",
        [workspaceId, opportunity.contentOpportunityId]
      );
    expect((await reader.list(workspaceId)).items).toEqual([]);
    expect(
      (await reader.find(workspaceId, opportunity.contentOpportunityId)).opportunity.status
    ).toBe('REJECTED');
  });

  it('paginates deterministic ID order without mixing Candidate, Rejected or Deferred work', async () => {
    for (const key of ['c', 'a', 'b', 'candidate', 'deferred', 'rejected']) await work(key);
    for (const [id, status] of [
      ['candidate', 'CANDIDATE'],
      ['deferred', 'DEFERRED'],
      ['rejected', 'REJECTED']
    ])
      await database
        .getPool()
        .query(
          "UPDATE lite_content_opportunities SET document_json=jsonb_set(document_json,'{status}',to_jsonb($3::text)) WHERE workspace_id=$1 AND content_opportunity_id=$2",
          [workspaceId, `content-opportunity_${id}`, status]
        );
    const first = await get<ContentStudioWorkList>('?limit=2');
    expect(first.body.items.map((item) => item.contentOpportunity.id)).toEqual([
      'content-opportunity_a',
      'content-opportunity_b'
    ]);
    expect(first.body.nextAfter).toBe('content-opportunity_b');
    const second = await get<ContentStudioWorkList>(`?limit=2&after=${first.body.nextAfter}`);
    expect(second.body.items.map((item) => item.contentOpportunity.id)).toEqual([
      'content-opportunity_c'
    ]);
    expect(second.body.nextAfter).toBeNull();
    expect((await get<ContentStudioWorkList>('?limit=2')).body).toEqual(first.body);
  });

  it('isolates Workspace and returns the same 404 for unknown and another Workspace work', async () => {
    const { opportunity } = await work('private');
    const other = { ...principal, workspaceId: otherWorkspaceId };
    expect((await get<ContentStudioWorkList>('', other)).body.items).toEqual([]);
    const hidden = await get(`/${opportunity.contentOpportunityId}`, other);
    const unknown = await get('/content-opportunity_unknown', other);
    expect(hidden.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(hidden.body).toMatchObject({ code: 'CONTENT_WORK_NOT_FOUND' });
    expect(unknown.body).toMatchObject({ code: 'CONTENT_WORK_NOT_FOUND' });
    expect((await get('', { ...principal, permissions: [] })).status).toBe(403);
  });

  it('remains readable by stable work ID when the originating Pick and Orbit item disappear, for another user too', async () => {
    const { opportunity } = await lineage('outside-orbit');
    const signal: DailySignal = {
      schemaVersion: 1,
      workspaceId,
      dailySignalId: 'daily-signal_studio',
      version: 1,
      source,
      title: 'Original content source',
      summary: 'Original signal context',
      keyFacts: ['Changed rule'],
      jurisdictions: ['US'],
      topicTags: ['trademarks'],
      changeType: 'RULE_CHANGE',
      observedAt: now(),
      timeSensitivity: 'HIGH',
      dailySignalFingerprintSha256: 'c'.repeat(64),
      legalTruthVerified: false,
      recommendationCreatedAutomatically: false,
      createdAt: now()
    };
    await database.getPool().query(
      `INSERT INTO lite_daily_signals
      (workspace_id,daily_signal_id,version,source_owner,source_kind,source_id,source_version,source_fingerprint_sha256,daily_signal_fingerprint_sha256,document_json,observed_at,created_at)
      VALUES($1,$2,1,'CORE','KNOWLEDGE_READY_PACKAGE',$3,$4,$5,$6,$7::jsonb,$8,$9)`,
      [
        workspaceId,
        signal.dailySignalId,
        source.sourceId,
        String(source.sourceVersion),
        source.sourceFingerprintSha256,
        signal.dailySignalFingerprintSha256,
        JSON.stringify(signal),
        signal.observedAt,
        signal.createdAt
      ]
    );
    const orbit = new DailyOrbitService(
      new PostgresDailySignalReader(database.getPool()),
      new PostgresPreparedActionStore(database, database.getPool())
    );
    const original = await orbit.snapshot(workspaceId, principal.userId);
    expect(original.contentPicks).toHaveLength(1);
    expect(original.contentPicks[0]?.recommendation).toEqual(opportunity.sourceRecommendation);
    expect(original.items).toHaveLength(1);
    // Remove only the discovery signal, not the durable content lifecycle.
    await database
      .getPool()
      .query('DELETE FROM lite_daily_signals WHERE workspace_id=$1 AND daily_signal_id=$2', [
        workspaceId,
        signal.dailySignalId
      ]);
    const snapshot = await orbit.snapshot(workspaceId, principal.userId);
    expect(snapshot.items).toEqual([]);
    expect(snapshot.contentPicks).toEqual([]);
    const first = await get<ContentStudioWorkDetail>(`/${opportunity.contentOpportunityId}`);
    const anotherUser = { ...principal, userId: 'user_another_reader' };
    expect(
      (await get<ContentStudioWorkList>('', anotherUser)).body.items[0]?.contentOpportunity.id
    ).toBe(opportunity.contentOpportunityId);
    expect(
      (await get<ContentStudioWorkDetail>(`/${opportunity.contentOpportunityId}`, anotherUser)).body
    ).toEqual(first.body);
    expect(first.body.publishPackages).toHaveLength(1);
    expect(first.body.feedback).toHaveLength(1);
  });

  it.each([
    ['lite_content_opportunities', '{status}', '"UNKNOWN"'],
    ['lite_content_opportunities', '{status}', 'null'],
    ['lite_content_drafts', '{contentOpportunity,version}', '99'],
    ['lite_content_drafts', '{workspaceId}', '"38383838-3838-4383-8383-383838383838"'],
    ['lite_content_review_decisions', '{contentDraft,version}', '1'],
    [
      'lite_content_review_decisions',
      '{expectedContentDraftFingerprintSha256}',
      '"wrong-fingerprint"'
    ],
    ['lite_publish_packages', '{contentDraft,version}', '1'],
    ['lite_publish_packages', '{reviewDecision,id}', '"content-review-decision_missing"'],
    ['lite_publish_packages', '{contentDraftFingerprintSha256}', '"wrong-fingerprint"'],
    ['lite_product_loop_use_feedback', '{publishPackage,id}', '"publish-package_missing"'],
    ['lite_product_loop_use_feedback', '{publishPackage,version}', '2'],
    ['lite_product_loop_use_feedback', '{externalOutcomeVerifiedByMarkOrbit}', 'true']
  ])('fails closed on malformed %s %s lineage in detail AND list', async (table, field, value) => {
    const { opportunity } = await lineage();
    // Identifiers are fixed test cases, never request input; no constraints are disabled.
    await database
      .getPool()
      .query(
        `UPDATE ${table} SET document_json=jsonb_set(document_json,$2::text[],$3::jsonb) WHERE workspace_id=$1`,
        [workspaceId, field, value]
      );
    const detail = await get(`/${opportunity.contentOpportunityId}`);
    expect(detail).toMatchObject({ status: 503, body: { code: 'CONTENT_STUDIO_LINEAGE_INVALID' } });
    expect(await get()).toMatchObject({
      status: 503,
      body: { code: 'CONTENT_STUDIO_LINEAGE_INVALID' }
    });
  });

  it('rejects a relationally valid Package whose Draft and Review belong to different work', async () => {
    const a = await lineage('a');
    const b = await lineage('b');
    const broken = {
      ...a.pkg,
      contentDraft: b.pkg.contentDraft,
      contentDraftFingerprintSha256: b.pkg.contentDraftFingerprintSha256
    };
    await database
      .getPool()
      .query(
        'UPDATE lite_publish_packages SET content_draft_id=$3,content_draft_version=$4,document_json=$5::jsonb WHERE workspace_id=$1 AND publish_package_id=$2',
        [
          workspaceId,
          a.pkg.publishPackageId,
          b.ready.contentDraftId,
          b.ready.version,
          JSON.stringify(broken)
        ]
      );
    await expect(
      reader.find(workspaceId, a.opportunity.contentOpportunityId)
    ).rejects.toMatchObject({ code: 'CONTENT_STUDIO_LINEAGE_INVALID' });
    await expect(reader.list(workspaceId)).rejects.toMatchObject({
      code: 'CONTENT_STUDIO_LINEAGE_INVALID'
    });
  });

  it('does not infer a review from Draft status and performs no lifecycle writes during reads', async () => {
    const { store, opportunity } = await work('no-review');
    const draft = await store.createDraft({
      workspaceId,
      contentOpportunity: { id: opportunity.contentOpportunityId, version: 1 },
      expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
      title: 'Draft',
      body: 'No review exists',
      idempotencyKey: 'draft-no-review'
    });
    await database
      .getPool()
      .query(
        "UPDATE lite_content_drafts SET status='REVIEWED_READY_FOR_PACKAGE',document_json=jsonb_set(document_json,'{status}','\"REVIEWED_READY_FOR_PACKAGE\"') WHERE workspace_id=$1 AND content_draft_id=$2",
        [workspaceId, draft.contentDraftId]
      );
    const tables = [
      'lite_content_opportunities',
      'lite_content_drafts',
      'lite_content_review_decisions',
      'lite_publish_packages',
      'lite_product_loop_use_feedback',
      'lite_content_preparation_commands',
      'lite_product_loop_feedback_commands',
      'lite_visual_briefs',
      'lite_visual_requests',
      'lite_visual_output_references'
    ];
    const counts = async () =>
      Promise.all(
        tables.map(
          async (table) =>
            (
              await database
                .getPool()
                .query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`)
            ).rows[0]
        )
      );
    const before = await counts();
    expect((await reader.find(workspaceId, opportunity.contentOpportunityId)).reviews).toEqual([]);
    expect((await reader.list(workspaceId)).items[0]?.latestDraftReview).toBeNull();
    expect(await counts()).toEqual(before);
  });
});
