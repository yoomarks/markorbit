import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReadyPackageContentExportV1 } from '../packages/contracts/src/knowledge-content-export.js';
import type { ProductLoopSourceReference } from '../packages/contracts/src/product-loop.js';
import { createServiceRuntime, type ServiceRuntime } from '../packages/service-kit/src/index.js';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '../packages/persistence/src/index.js';
import type { AuthenticationService } from '../services/core/src/auth.js';
import {
  createRuntime as createCore,
  PostgresKnowledgeIntakeRepository,
  PostgresKnowledgeReadyPackageContentRepository,
  PostgresWorkspaceRepository
} from '../services/core/src/index.js';
import {
  createLiteProductLoopRoutes,
  PostgresLiteCandidateQualificationStore,
  PostgresLiteContentPreparationStore,
  PostgresPreparedActionStore,
  PostgresProductConversionAnalyticsStore,
  PostgresProductLoopFeedbackStore,
  PreparedActionJourneyService,
  type ProductLoopSourceAuthority
} from '../services/lite/src/index.js';
import { PostgresFormalOpportunityStore } from '../services/markreg/src/formal-opportunity.js';
import {
  createMarkRegFormalOpportunityRoutes,
  HttpQualifiedOpportunityAuthority
} from '../services/markreg/src/formal-opportunity-http.js';

const required = process.env.M7_WP04_PRODUCT_OPPORTUNITY_REQUIRED === '1';
const coreUrl = process.env.M7_WP04_CORE_DATABASE_URL;
const liteUrl = process.env.M7_WP04_LITE_DATABASE_URL;
const markregUrl = process.env.M7_WP04_MARKREG_DATABASE_URL;
if (required && (!coreUrl || !liteUrl || !markregUrl))
  throw new Error(
    'M7_WP04_CORE_DATABASE_URL, M7_WP04_LITE_DATABASE_URL and M7_WP04_MARKREG_DATABASE_URL are required.'
  );

const suite = coreUrl && liteUrl && markregUrl ? describe : describe.skip;
const workspaceId = '81818181-8181-4818-8818-818181818181';
const otherWorkspaceId = '82828282-8282-4828-8828-828282828282';
const internalSecret = 'm7-wp04-three-loop-internal-secret-32-bytes';
const at = '2026-08-12T10:40:00.000Z';

function database(url: string, owner: string) {
  return new ManagedDatabase({
    connection: { url },
    applicationName: `m7-wp04-${owner}`,
    poolMaximum: 8,
    connectionTimeoutMs: 3000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 8000,
    sslMode: 'disable',
    migrationNamespace: `m7_wp04_${owner}`
  });
}

const coreDatabase = coreUrl ? database(coreUrl, 'core') : undefined;
const liteDatabase = liteUrl ? database(liteUrl, 'lite') : undefined;
const markregDatabase = markregUrl ? database(markregUrl, 'markreg') : undefined;
let coreRuntime: ReturnType<typeof createCore> | undefined;
let liteRuntime: ServiceRuntime | undefined;
let markregRuntime: ServiceRuntime | undefined;

async function resetOwner(
  target: ManagedDatabase,
  owner: '@markorbit/core-service' | '@markorbit/lite-service' | '@markorbit/markreg-service'
) {
  await target.start();
  const pool = target.getPool();
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
  if (owner !== '@markorbit/core-service') {
    await pool.query(
      'CREATE TABLE workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
    );
    await pool.query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
       ($1,'M7 WP04 Product Acceptance','m7-wp04-product-acceptance'),
       ($2,'M7 WP04 Other Workspace','m7-wp04-other-workspace')`,
      [workspaceId, otherWorkspaceId]
    );
  }
  await migrate(
    pool,
    `m7_wp04_${owner.replace('@markorbit/', '').replace('-service', '').replace('-', '_')}`,
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      owner
    )
  );
}

async function contentFixture(): Promise<ReadyPackageContentExportV1> {
  return JSON.parse(
    await readFile(
      path.resolve('packages/contracts/fixtures/ready-package-content-export-v1.json'),
      'utf8'
    )
  ) as ReadyPackageContentExportV1;
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

suite('M7-WP-04 Product and Opportunity cross-owner real-runtime acceptance', () => {
  beforeAll(async () => {
    await Promise.all([
      resetOwner(coreDatabase!, '@markorbit/core-service'),
      resetOwner(liteDatabase!, '@markorbit/lite-service'),
      resetOwner(markregDatabase!, '@markorbit/markreg-service')
    ]);

    const corePool = coreDatabase!.getPool();
    const workspaces = new PostgresWorkspaceRepository(corePool);
    await workspaces.create({
      workspaceId,
      name: 'M7 WP04 Product Acceptance',
      slug: 'm7-wp04-product-acceptance'
    });
    await workspaces.create({
      workspaceId: otherWorkspaceId,
      name: 'M7 WP04 Other Workspace',
      slug: 'm7-wp04-other-workspace'
    });
    const knowledgeIntakes = new PostgresKnowledgeIntakeRepository(corePool);
    coreRuntime = createCore({
      port: 0,
      authentication: {} as AuthenticationService,
      workspaces,
      knowledgeIntakes,
      knowledgeContents: new PostgresKnowledgeReadyPackageContentRepository(corePool),
      internalServiceSecret: internalSecret
    });
    await coreRuntime.start();

    const litePool = liteDatabase!.getPool();
    const feedbackStore = new PostgresProductLoopFeedbackStore(liteDatabase!, litePool, () => at);
    const sourceAuthority: ProductLoopSourceAuthority = {
      async resolve(requestWorkspaceId, locator) {
        if (locator.owner === 'CORE' && locator.kind === 'KNOWLEDGE_READY_PACKAGE') {
          const response = await fetch(
            `http://127.0.0.1:${coreRuntime!.listeningPort}/internal/knowledge/ready-packages/${encodeURIComponent(locator.sourceId)}/product-loop-source`,
            {
              headers: {
                'x-markorbit-internal-authorization': internalSecret,
                'x-markorbit-workspace-id': requestWorkspaceId
              }
            }
          );
          if (!response.ok)
            throw new Error(`Core Product-loop source boundary returned ${response.status}.`);
          const result = (await response.json()) as { source: ProductLoopSourceReference };
          return result.source;
        }
        if (locator.owner === 'LITE' && locator.kind === 'CONTENT_USE_FEEDBACK') {
          const source = await feedbackStore.sourceReference(
            requestWorkspaceId,
            locator.sourceId as `product-loop-feedback_${string}`
          );
          if (!source) throw new Error('Lite Product-loop feedback source was not found.');
          return source;
        }
        throw new Error('M7-WP-04 source locator is outside the accepted runtime graph.');
      }
    };
    const candidateStore = new PostgresLiteCandidateQualificationStore(
      liteDatabase!,
      litePool,
      sourceAuthority,
      { isAccessible: async () => false },
      () => at
    );
    const preparedActionStore = new PostgresPreparedActionStore(liteDatabase!, litePool, () => at);
    const journeyService = new PreparedActionJourneyService(preparedActionStore, {
      async perform() {
        throw new Error('Prepared Action handoff is outside the M7-WP-04 authority-read runtime.');
      }
    });
    liteRuntime = createServiceRuntime(
      { name: 'm7-wp04-lite-runtime', port: 0, version: '0.1.0' },
      {
        routes: createLiteProductLoopRoutes({
          internalServiceSecret: internalSecret,
          journeyService,
          candidateStore,
          feedbackStore,
          analyticsStore: new PostgresProductConversionAnalyticsStore(litePool, () => at)
        })
      }
    );
    await liteRuntime.start();

    const markregPool = markregDatabase!.getPool();
    const formalStore = new PostgresFormalOpportunityStore(
      markregDatabase!,
      markregPool,
      new HttpQualifiedOpportunityAuthority(
        `http://127.0.0.1:${liteRuntime.listeningPort}`,
        internalSecret
      ),
      () => at
    );
    markregRuntime = createServiceRuntime(
      { name: 'm7-wp04-markreg-runtime', port: 0, version: '0.1.0' },
      {
        routes: createMarkRegFormalOpportunityRoutes({
          internalServiceSecret: internalSecret,
          store: formalStore
        })
      }
    );
    await markregRuntime.start();
  });

  afterAll(async () => {
    await markregRuntime?.stop();
    await liteRuntime?.stop();
    await coreRuntime?.stop();
    await Promise.all([coreDatabase?.close(), liteDatabase?.close(), markregDatabase?.close()]);
  });

  it('proves accepted Knowledge -> reviewed PublishPackage -> feedback -> qualified Formal Opportunity -> bounded Intake handoff', async () => {
    const fixture = await contentFixture();
    const coreBase = `http://127.0.0.1:${coreRuntime!.listeningPort}`;
    const intake = await fetch(`${coreBase}/internal/knowledge/ready-packages/intakes`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'm7-wp04-core-intake',
        'x-markorbit-internal-authorization': internalSecret
      },
      body: JSON.stringify({
        readyPackageId: fixture.readyPackageId,
        workspaceId,
        digest: fixture.readyPackageDigest,
        evidence: {
          artifactIds: [fixture.rawArtifact.artifactId],
          stagingDocumentId: fixture.stagingDocument.documentId
        },
        submittedAt: at
      })
    });
    expect(intake.status).toBe(201);
    const intakeBody = await json(intake);
    expect(intakeBody.status).toBe('RECEIVED');

    const accepted = await fetch(
      `${coreBase}/internal/knowledge/ready-packages/intakes/${String(intakeBody.intakeId)}/content`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': internalSecret
        },
        body: JSON.stringify(fixture)
      }
    );
    expect(accepted.status).toBe(201);
    expect((await json(accepted)).status).toBe('ACCEPTED');

    const governedSource = await fetch(
      `${coreBase}/internal/knowledge/ready-packages/${encodeURIComponent(fixture.readyPackageId)}/product-loop-source`,
      {
        headers: {
          'x-markorbit-internal-authorization': internalSecret,
          'x-markorbit-workspace-id': workspaceId
        }
      }
    );
    expect(governedSource.status).toBe(200);
    const governedSourceBody = (await governedSource.json()) as {
      source: ProductLoopSourceReference;
    };
    expect(governedSourceBody.source.owner).toBe('CORE');
    expect(governedSourceBody.source.kind).toBe('KNOWLEDGE_READY_PACKAGE');
    expect(governedSourceBody.source.sourceFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);

    const crossWorkspaceSource = await fetch(
      `${coreBase}/internal/knowledge/ready-packages/${encodeURIComponent(fixture.readyPackageId)}/product-loop-source`,
      {
        headers: {
          'x-markorbit-internal-authorization': internalSecret,
          'x-markorbit-workspace-id': otherWorkspaceId
        }
      }
    );
    expect(crossWorkspaceSource.status).toBe(404);

    const litePool = liteDatabase!.getPool();
    const feedbackStore = new PostgresProductLoopFeedbackStore(liteDatabase!, litePool, () => at);
    const sourceAuthority: ProductLoopSourceAuthority = {
      async resolve(requestWorkspaceId, locator) {
        if (locator.owner === 'CORE' && locator.kind === 'KNOWLEDGE_READY_PACKAGE') {
          const response = await fetch(
            `${coreBase}/internal/knowledge/ready-packages/${encodeURIComponent(locator.sourceId)}/product-loop-source`,
            {
              headers: {
                'x-markorbit-internal-authorization': internalSecret,
                'x-markorbit-workspace-id': requestWorkspaceId
              }
            }
          );
          if (!response.ok) throw new Error(`Core source returned ${response.status}.`);
          return ((await response.json()) as { source: ProductLoopSourceReference }).source;
        }
        if (locator.owner === 'LITE' && locator.kind === 'CONTENT_USE_FEEDBACK') {
          const source = await feedbackStore.sourceReference(
            requestWorkspaceId,
            locator.sourceId as `product-loop-feedback_${string}`
          );
          if (!source) throw new Error('Lite feedback source was not found.');
          return source;
        }
        throw new Error('Unexpected Product-loop source locator.');
      }
    };
    const contentStore = new PostgresLiteContentPreparationStore(
      liteDatabase!,
      litePool,
      sourceAuthority,
      () => at
    );
    const recommendation = await contentStore.createRecommendation({
      workspaceId,
      title: 'Prepare a governed Beta trademark update',
      explanation: 'Accepted Core Knowledge supports a bounded reviewed content preparation.',
      sources: [
        { owner: 'CORE', kind: 'KNOWLEDGE_READY_PACKAGE', sourceId: fixture.readyPackageId }
      ],
      idempotencyKey: 'm7-wp04-content-recommendation'
    });
    expect(recommendation.sources).toEqual([governedSourceBody.source]);
    expect(recommendation.executionAuthorized).toBe(false);

    const contentOpportunity = await contentStore.acceptContentOpportunity({
      workspaceId,
      recommendation: {
        id: recommendation.todayRecommendationId,
        version: recommendation.version
      },
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      title: 'Reviewed Beta content preparation',
      rationale: 'Prepare content only; no external publication is authorized.',
      idempotencyKey: 'm7-wp04-content-opportunity'
    });
    const draft = await contentStore.createDraft({
      workspaceId,
      contentOpportunity: {
        id: contentOpportunity.contentOpportunityId,
        version: contentOpportunity.version
      },
      expectedContentOpportunityFingerprintSha256:
        contentOpportunity.contentOpportunityFingerprintSha256,
      title: 'Beta trademark maintenance update',
      body: 'Governed Beta content that requires an explicit human review before packaging.',
      idempotencyKey: 'm7-wp04-content-draft'
    });
    const ready = await contentStore.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: draft.version,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: 'm7-wp04-content-ready'
    });
    const review = await contentStore.recordReview({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: 'user_m7-wp04-reviewer',
      rationale: 'Human-style acceptance for a prepared package only; publication remains manual.',
      idempotencyKey: 'm7-wp04-content-review'
    });
    const publishPackage = await contentStore.preparePublishPackage({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: 'm7-wp04-publish-package'
    });
    expect(publishPackage.externalPublishExecuted).toBe(false);

    const feedback = await feedbackStore.recordUseFeedback({
      workspaceId,
      publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_USED',
      externalReference: 'rehearsal://m7-wp04/manual-use',
      recordedByPrincipalId: 'user_m7-wp04-reviewer',
      idempotencyKey: 'm7-wp04-use-feedback'
    });
    expect(feedback.externalActionExecutedByMarkOrbit).toBe(false);
    expect(feedback.externalOutcomeVerifiedByMarkOrbit).toBe(false);

    const candidateStore = new PostgresLiteCandidateQualificationStore(
      liteDatabase!,
      litePool,
      sourceAuthority,
      { isAccessible: async () => false },
      () => at
    );
    const candidate = await candidateStore.createCandidate({
      workspaceId,
      title: 'Review a trademark service opportunity',
      serviceNeedSummary:
        'User-reported product feedback supports explicit trademark-service review.',
      sources: [
        { owner: 'LITE', kind: 'CONTENT_USE_FEEDBACK', sourceId: feedback.productLoopFeedbackId }
      ],
      idempotencyKey: 'm7-wp04-opportunity-candidate'
    });
    const qualification = await candidateStore.recordQualification({
      workspaceId,
      candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
      expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
      outcome: 'QUALIFIED_FOR_MARKREG',
      decidedByPrincipalId: 'user_m7-wp04-qualifier',
      rationale:
        'Explicit human-style qualification; no customer contact or downstream work is automatic.',
      idempotencyKey: 'm7-wp04-opportunity-qualification'
    });
    expect(qualification.decision.formalOpportunityCreated).toBe(false);
    expect(qualification.decision.customerContacted).toBe(false);

    const liteBase = `http://127.0.0.1:${liteRuntime!.listeningPort}`;
    const authorityProbe = await fetch(`${liteBase}/internal/v1/qualified-opportunities/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': internalSecret,
        'x-markorbit-workspace-id': workspaceId
      },
      body: JSON.stringify({
        candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
        qualificationDecision: {
          id: qualification.decision.opportunityQualificationDecisionId,
          version: qualification.decision.version
        }
      })
    });
    expect(authorityProbe.status).toBe(200);

    const markregBase = `http://127.0.0.1:${markregRuntime!.listeningPort}`;
    const formalResponse = await fetch(`${markregBase}/internal/v1/formal-opportunities`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'm7-wp04-formal-opportunity',
        'x-markorbit-internal-authorization': internalSecret,
        'x-markorbit-workspace-id': workspaceId
      },
      body: JSON.stringify({
        candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
        expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
        qualificationDecision: {
          id: qualification.decision.opportunityQualificationDecisionId,
          version: qualification.decision.version
        },
        relationshipModel: 'DIRECT',
        proposedCustomerIntent: {
          brandName: 'M7 WP04 Beta Mark',
          applicantCountry: 'US',
          targetJurisdictions: ['US'],
          goodsServicesDescription: 'Rehearsal-only trademark service scope.'
        },
        promotedByPrincipalId: 'user_m7-wp04-promoter'
      })
    });
    expect(formalResponse.status).toBe(201);
    const formalBody = (await formalResponse.json()) as {
      formalOpportunity: {
        formalTrademarkServiceOpportunityId: string;
        version: number;
        formalOpportunityFingerprintSha256: string;
        status: string;
        orderCreated: boolean;
        matterCreated: boolean;
        paymentCreated: boolean;
        filingSubmitted: boolean;
      };
    };
    expect(formalBody.formalOpportunity.status).toBe('QUALIFIED');
    expect(formalBody.formalOpportunity.orderCreated).toBe(false);
    expect(formalBody.formalOpportunity.matterCreated).toBe(false);
    expect(formalBody.formalOpportunity.paymentCreated).toBe(false);
    expect(formalBody.formalOpportunity.filingSubmitted).toBe(false);

    const handoffResponse = await fetch(
      `${markregBase}/internal/v1/formal-opportunities/${formalBody.formalOpportunity.formalTrademarkServiceOpportunityId}/intake-handoff`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'm7-wp04-intake-handoff',
          'x-markorbit-internal-authorization': internalSecret,
          'x-markorbit-workspace-id': workspaceId
        },
        body: JSON.stringify({
          formalOpportunityVersion: formalBody.formalOpportunity.version,
          expectedFormalOpportunityFingerprintSha256:
            formalBody.formalOpportunity.formalOpportunityFingerprintSha256,
          relationshipModel: 'DIRECT',
          customerIntent: {
            brandName: 'M7 WP04 Beta Mark',
            applicantCountry: 'US',
            targetJurisdictions: ['US'],
            goodsServicesDescription: 'Rehearsal-only trademark service scope.'
          },
          confirmedByPrincipalId: 'user_m7-wp04-confirmer'
        })
      }
    );
    expect(handoffResponse.status).toBe(200);
    const handoffBody = (await handoffResponse.json()) as {
      handoff: {
        target: string;
        channel: string;
        intakeCreated: boolean;
        orderCreated: boolean;
        matterCreated: boolean;
      };
      currentFormalOpportunity: {
        status: string;
        orderCreated: boolean;
        matterCreated: boolean;
        paymentCreated: boolean;
        filingSubmitted: boolean;
      };
    };
    expect(handoffBody.handoff.target).toBe('MARKREG_INTAKE');
    expect(handoffBody.handoff.channel).toBe('LITE_PROFESSIONAL');
    expect(handoffBody.handoff.intakeCreated).toBe(false);
    expect(handoffBody.handoff.orderCreated).toBe(false);
    expect(handoffBody.handoff.matterCreated).toBe(false);
    expect(handoffBody.currentFormalOpportunity.status).toBe('HANDED_OFF_TO_INTAKE');
    expect(handoffBody.currentFormalOpportunity.orderCreated).toBe(false);
    expect(handoffBody.currentFormalOpportunity.matterCreated).toBe(false);
    expect(handoffBody.currentFormalOpportunity.paymentCreated).toBe(false);
    expect(handoffBody.currentFormalOpportunity.filingSubmitted).toBe(false);
  });
});
