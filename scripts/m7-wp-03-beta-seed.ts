import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  betaReadinessNoAuthorityConsequences,
  type SeededDemoRecordBoundary
} from '@markorbit/contracts/beta-readiness';
import type {
  ContentDraftId,
  ContentOpportunityId,
  ContentReviewDecisionId,
  OpportunityCandidateId,
  OpportunityQualificationDecisionId,
  ProductLoopFeedbackId,
  ProductLoopSourceReference,
  PublishPackageId,
  TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '../packages/persistence/src/index.js';
import {
  fingerprintCoreIntakeRequest,
  PostgresKnowledgeIntakeRepository,
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository,
  type KnowledgeIntake
} from '../services/core/src/index.js';
import {
  PostgresLiteCandidateQualificationStore,
  PostgresLiteContentPreparationStore,
  PostgresProductLoopFeedbackStore,
  type ProductLoopSourceAuthority
} from '../services/lite/src/index.js';
import {
  PostgresFormalOpportunityStore,
  type QualifiedOpportunityAuthority
} from '../services/markreg/src/formal-opportunity.js';
import { evidenceHandoffAuthorityConsequences } from '@markorbit/contracts/provider-execution';
import {
  createRuntime as createExecution,
  EvidenceReviewService,
  PostgresEvidenceReviewRepository,
  PostgresProviderReturnEvidenceRepository,
  type ExecutionProviderReturnEvidenceReceipt
} from '../services/execution/src/index.js';
import { createExecutionCapabilityObservationSourceRoutes } from '../services/execution/src/capability-observation-source-http.js';
import {
  HttpExecutionCapabilityObservationSourceAuthority,
  PostgresCapabilityObservationLedger,
  PostgresPrivateReflectionCandidateService,
  PostgresRuntimeCapabilityRegistry
} from '../services/capability-engine/src/index.js';

export const M7_WP03_SCENARIO_ID = 'm7-wp-03-deterministic-beta-seed-v1' as const;
export const M7_WP03_SEED_AT = '2026-08-12T09:00:00.000Z' as const;

const OWNER_PACKAGES = {
  CORE: '@markorbit/core-service',
  LITE: '@markorbit/lite-service',
  MARKREG: '@markorbit/markreg-service',
  EXECUTION: '@markorbit/execution-service',
  CAPABILITY_ENGINE: '@markorbit/capability-engine'
} as const;

type SeedOwner = keyof typeof OWNER_PACKAGES;
type SeedEnvironment = 'TEST' | 'REHEARSAL';

export interface M7Wp03BetaSeedConfig {
  environment: SeedEnvironment;
  databaseUrls: Readonly<Record<SeedOwner, string>>;
}

export interface M7Wp03BetaSeedManifest {
  schemaVersion: 1;
  scenarioId: typeof M7_WP03_SCENARIO_ID;
  environment: SeedEnvironment;
  nonProduction: true;
  workspaceId: string;
  subjectUserId: string;
  owners: ReadonlyArray<
    Readonly<{
      owner: SeedOwner;
      databaseSeparated: true;
      resetBeforeSeed: true;
      ownerMigrationsApplied: true;
    }>
  >;
  records: Readonly<{
    core: Readonly<{
      userId: string;
      workspaceId: string;
      membershipId: string;
      knowledgeIntakeId: string;
      readyPackageId: string;
      sourceFingerprintSha256: string;
    }>;
    content: Readonly<{
      recommendationId: TodayRecommendationId;
      contentOpportunityId: ContentOpportunityId;
      contentDraftId: ContentDraftId;
      reviewDecisionId: ContentReviewDecisionId;
      publishPackageId: PublishPackageId;
      publishPackageFingerprintSha256: string;
      feedbackId: ProductLoopFeedbackId;
      feedbackSourceFingerprintSha256: string;
      externalUseVerified: false;
    }>;
    opportunity: Readonly<{
      candidateId: OpportunityCandidateId;
      qualificationDecisionId: OpportunityQualificationDecisionId;
      qualificationOutcome: 'QUALIFIED_FOR_MARKREG';
      formalOpportunityId: string;
      formalOpportunityStatus: 'HANDED_OFF_TO_INTAKE';
      intakeHandoffPrepared: true;
      intakeCreated: false;
      matterCreated: false;
      filingSubmitted: false;
    }>;
    capability: Readonly<{
      evidenceReviewDecisionId: string;
      runtimeCapabilityId: string;
      observationId: string;
      ledgerEntryId: string;
      reflectionCandidateId: string;
      reflectionCandidateFingerprintSha256: string;
      reflectionStatus: 'PENDING';
      capabilityVerified: false;
      canonicalTruthCreated: false;
    }>;
  }>;
  safeguards: Readonly<{
    realCustomerCredentialsUsed: false;
    realProviderCredentialsUsed: false;
    externalActionsExecuted: false;
    crossServiceSqlPerformed: false;
    productionDeploymentAuthorized: false;
    betaReleased: false;
  }>;
  boundary: Readonly<SeededDemoRecordBoundary>;
  authority: typeof betaReadinessNoAuthorityConsequences;
  scenarioFingerprintSha256: string;
}

const IDS = Object.freeze({
  userId: 'user_m7_wp03_beta_seed',
  workspaceId: '73737373-7373-4737-8737-737373737373',
  membershipId: 'membership_m7_wp03_beta_seed',
  knowledgeIntakeId: '73737373-7373-4737-8737-737373737374',
  readyPackageId: 'rdp_m7-wp03-beta-seed',
  recommendationId: 'today-recommendation_m7-wp03-beta-seed' as TodayRecommendationId,
  contentOpportunityId: 'content-opportunity_m7-wp03-beta-seed' as ContentOpportunityId,
  contentDraftId: 'content-draft_m7-wp03-beta-seed' as ContentDraftId,
  contentReviewDecisionId:
    'content-review-decision_m7-wp03-beta-seed' as ContentReviewDecisionId,
  publishPackageId: 'publish-package_m7-wp03-beta-seed' as PublishPackageId,
  feedbackId: 'product-loop-feedback_m7-wp03-beta-seed' as ProductLoopFeedbackId,
  opportunityCandidateId:
    'opportunity-candidate_m7-wp03-beta-seed' as OpportunityCandidateId,
  qualificationDecisionId:
    'opportunity-qualification_m7-wp03-beta-seed' as OpportunityQualificationDecisionId,
  formalOpportunityId: 'trademark-service-opportunity_m7-wp03-beta-seed' as const,
  filingAuthorizationId: 'filing-authorization_m7-wp03-beta-seed',
  executionReleaseId: 'execution-release_m7-wp03-beta-seed',
  filingTaskDraftId: 'filing-task-draft_m7-wp03-beta-seed',
  evidenceHandoffId: 'evidence-handoff_m7-wp03-beta-seed' as const,
  providerReturnId: 'provider-return_m7-wp03-beta-seed' as const,
  evidenceReceiptId: 'evidence-receipt_m7-wp03-beta-seed' as const,
  evidenceReviewDecisionId: 'evidence-review-decision_m7-wp03-beta-seed' as const,
  correctionRequestId: 'evidence-correction-request_m7-wp03-beta-seed' as const,
  runtimeCapabilityId: 'runtime-capability_73737373737373737373737373737373' as const,
  observationId: 'capability-observation_73737373737373737373737373737373' as const,
  ledgerEntryId: 'capability-ledger_73737373737373737373737373737373' as const,
  reflectionCandidateId: 'reflection-candidate_73737373737373737373737373737373' as const
});

const PROVIDER_WORKSPACE_ID = '74747474-7474-4747-8747-747474747474';
const CORRELATION_ID = 'correlation_m7-wp03-beta-seed' as const;
const INTERNAL_SECRET = 'm7-wp03-beta-seed-internal-secret-32-bytes';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  const bytes = typeof value === 'string' ? value : stableSerialize(value);
  return createHash('sha256').update(bytes).digest('hex');
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required for M7-WP-03 Beta seed.`);
  return value.trim();
}

function databaseIdentity(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error(`${name} must use postgres:// or postgresql://.`);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName || !/(?:test|rehearsal|seed|wp03)/iu.test(databaseName))
    throw new Error(
      `${name} must target a visibly non-production database name containing test, rehearsal, seed or wp03.`
    );
  return `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || '5432'}/${databaseName}`;
}

export function readM7Wp03BetaSeedConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): M7Wp03BetaSeedConfig {
  if (env.MARKORBIT_BETA_SEED_ENABLED !== '1')
    throw new Error('M7-WP-03 Beta seed is disabled. Set MARKORBIT_BETA_SEED_ENABLED=1 explicitly.');
  if (env.NODE_ENV?.trim().toLowerCase() === 'production')
    throw new Error('M7-WP-03 Beta seed refuses to run with NODE_ENV=production.');
  const environment = env.MARKORBIT_BETA_SEED_ENVIRONMENT;
  if (environment !== 'TEST' && environment !== 'REHEARSAL')
    throw new Error('MARKORBIT_BETA_SEED_ENVIRONMENT must be TEST or REHEARSAL.');

  const databaseUrls = {
    CORE: required(env.MARKORBIT_BETA_SEED_CORE_DATABASE_URL, 'MARKORBIT_BETA_SEED_CORE_DATABASE_URL'),
    LITE: required(env.MARKORBIT_BETA_SEED_LITE_DATABASE_URL, 'MARKORBIT_BETA_SEED_LITE_DATABASE_URL'),
    MARKREG: required(
      env.MARKORBIT_BETA_SEED_MARKREG_DATABASE_URL,
      'MARKORBIT_BETA_SEED_MARKREG_DATABASE_URL'
    ),
    EXECUTION: required(
      env.MARKORBIT_BETA_SEED_EXECUTION_DATABASE_URL,
      'MARKORBIT_BETA_SEED_EXECUTION_DATABASE_URL'
    ),
    CAPABILITY_ENGINE: required(
      env.MARKORBIT_BETA_SEED_CAPABILITY_DATABASE_URL,
      'MARKORBIT_BETA_SEED_CAPABILITY_DATABASE_URL'
    )
  } as const;

  const identities = Object.entries(databaseUrls).map(([owner, url]) => [
    owner,
    databaseIdentity(url, `${owner} database URL`)
  ] as const);
  if (new Set(identities.map(([, identity]) => identity)).size !== identities.length)
    throw new Error('M7-WP-03 requires a distinct PostgreSQL database for every owning service.');

  return { environment, databaseUrls };
}

function managedDatabase(url: string, owner: SeedOwner) {
  return new ManagedDatabase({
    connection: { url },
    applicationName: `m7-wp03-beta-seed-${owner.toLowerCase().replace('_', '-')}`,
    poolMaximum: 5,
    connectionTimeoutMs: 3000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 8000,
    sslMode: 'disable',
    migrationNamespace: `m7_wp03_beta_seed_${owner.toLowerCase()}`
  });
}

async function resetOwnerDatabase(database: ManagedDatabase, owner: SeedOwner): Promise<void> {
  await database.start();
  const pool = database.getPool();
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
  await migrate(
    pool,
    `m7_wp03_beta_seed_${owner.toLowerCase()}`,
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      OWNER_PACKAGES[owner]
    )
  );
}

async function seedCore(database: ManagedDatabase) {
  const pool = database.getPool();
  const users = new PostgresUserRepository(pool);
  const workspaces = new PostgresWorkspaceRepository(pool);
  const memberships = new PostgresMembershipRepository(pool);
  await users.create({
    userId: IDS.userId,
    email: 'm7-wp03-beta-seed@example.test',
    displayName: 'M7 WP03 Beta Seed User'
  });
  await workspaces.create({
    workspaceId: IDS.workspaceId,
    name: 'M7 WP03 Beta Seed Workspace',
    slug: 'm7-wp03-beta-seed'
  });
  await memberships.create({
    membershipId: IDS.membershipId,
    workspaceId: IDS.workspaceId,
    userId: IDS.userId,
    role: 'WORKSPACE_ADMIN'
  });

  const request = {
    readyPackageId: IDS.readyPackageId,
    workspaceId: IDS.workspaceId,
    digest: sha256('m7-wp03-ready-package-digest'),
    evidence: {
      artifactIds: ['raw-artifact_m7-wp03-beta-seed'],
      stagingDocumentId: 'staging-document_m7-wp03-beta-seed'
    },
    submittedAt: M7_WP03_SEED_AT
  };
  const knowledgeIntakes = new PostgresKnowledgeIntakeRepository(pool);
  const candidate: KnowledgeIntake = {
    intakeId: IDS.knowledgeIntakeId,
    idempotencyKey: 'm7-wp03-core-knowledge-intake',
    request,
    requestSha256: fingerprintCoreIntakeRequest(request),
    status: 'RECEIVED',
    receivedAt: M7_WP03_SEED_AT
  };
  await knowledgeIntakes.createOrFind(candidate);
  const accepted = await knowledgeIntakes.markAccepted(IDS.knowledgeIntakeId);
  if (!accepted || accepted.status !== 'ACCEPTED')
    throw new Error('Core deterministic Knowledge intake did not reach ACCEPTED seed state.');
  return { knowledgeIntakes, accepted };
}

async function seedLite(
  database: ManagedDatabase,
  core: Awaited<ReturnType<typeof seedCore>>
) {
  const pool = database.getPool();
  const feedbackStore = new PostgresProductLoopFeedbackStore(
    database,
    pool,
    () => M7_WP03_SEED_AT,
    () => IDS.feedbackId
  );

  const sourceAuthority: ProductLoopSourceAuthority = {
    async resolve(workspaceId, locator) {
      if (workspaceId !== IDS.workspaceId)
        throw new Error('M7-WP-03 seed source requested from an unexpected Workspace.');
      if (
        locator.owner === 'CORE' &&
        locator.kind === 'KNOWLEDGE_READY_PACKAGE' &&
        locator.sourceId === IDS.readyPackageId
      ) {
        const intake = await core.knowledgeIntakes.findById(IDS.knowledgeIntakeId);
        if (!intake || intake.status !== 'ACCEPTED')
          throw new Error('Core accepted Knowledge seed source is unavailable.');
        return {
          schemaVersion: 1,
          owner: 'CORE',
          kind: 'KNOWLEDGE_READY_PACKAGE',
          sourceId: intake.request.readyPackageId,
          sourceVersion: 'CORE_ACCEPTED_V1',
          sourceFingerprintSha256: intake.requestSha256,
          observedAt: intake.receivedAt,
          correlationId: CORRELATION_ID
        } satisfies ProductLoopSourceReference;
      }
      if (
        locator.owner === 'LITE' &&
        locator.kind === 'CONTENT_USE_FEEDBACK' &&
        locator.sourceId === IDS.feedbackId
      ) {
        const source = await feedbackStore.sourceReference(
          IDS.workspaceId,
          IDS.feedbackId
        );
        if (!source) throw new Error('Lite deterministic Product-loop feedback source is unavailable.');
        return source;
      }
      throw new Error('M7-WP-03 seed source locator is outside the deterministic scenario.');
    }
  };

  const contentStore = new PostgresLiteContentPreparationStore(
    database,
    pool,
    sourceAuthority,
    () => M7_WP03_SEED_AT,
    {
      recommendation: () => IDS.recommendationId,
      opportunity: () => IDS.contentOpportunityId,
      draft: () => IDS.contentDraftId,
      review: () => IDS.contentReviewDecisionId,
      publishPackage: () => IDS.publishPackageId
    }
  );
  const recommendation = await contentStore.createRecommendation({
    workspaceId: IDS.workspaceId,
    title: 'Prepare a reviewed Beta rehearsal trademark update',
    explanation:
      'Deterministic non-production content seed derived from one accepted Core Knowledge source.',
    sources: [
      {
        owner: 'CORE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: IDS.readyPackageId
      }
    ],
    idempotencyKey: 'm7-wp03-content-recommendation'
  });
  const opportunity = await contentStore.acceptContentOpportunity({
    workspaceId: IDS.workspaceId,
    recommendation: {
      id: recommendation.todayRecommendationId,
      version: recommendation.version
    },
    expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
    title: 'Reviewed trademark update rehearsal package',
    rationale: 'Exercise the bounded Content path without external publication.',
    idempotencyKey: 'm7-wp03-content-opportunity'
  });
  const draft = await contentStore.createDraft({
    workspaceId: IDS.workspaceId,
    contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
    expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
    title: 'Beta rehearsal trademark maintenance note',
    body: 'Deterministic rehearsal-only content. Human review is required before a PublishPackage can be prepared.',
    idempotencyKey: 'm7-wp03-content-draft'
  });
  const ready = await contentStore.markDraftReadyForReview({
    workspaceId: IDS.workspaceId,
    contentDraftId: draft.contentDraftId,
    expectedVersion: draft.version,
    expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
    idempotencyKey: 'm7-wp03-content-ready'
  });
  const review = await contentStore.recordReview({
    workspaceId: IDS.workspaceId,
    contentDraft: { id: ready.contentDraftId, version: ready.version },
    expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
    outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
    reviewerPrincipalId: IDS.userId,
    rationale: 'Approved only for deterministic non-production PublishPackage preparation.',
    idempotencyKey: 'm7-wp03-content-review'
  });
  const publishPackage = await contentStore.preparePublishPackage({
    workspaceId: IDS.workspaceId,
    contentDraft: { id: ready.contentDraftId, version: ready.version },
    expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
    reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
    idempotencyKey: 'm7-wp03-publish-package'
  });
  const feedback = await feedbackStore.recordUseFeedback({
    workspaceId: IDS.workspaceId,
    publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
    expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
    outcome: 'USER_REPORTED_USED',
    externalReference: 'rehearsal://m7-wp03/manual-use',
    recordedByPrincipalId: IDS.userId,
    idempotencyKey: 'm7-wp03-content-feedback'
  });
  const feedbackSource = await feedbackStore.sourceReference(IDS.workspaceId, feedback.productLoopFeedbackId);
  if (!feedbackSource) throw new Error('Lite feedback source was not materialized.');

  const candidateStore = new PostgresLiteCandidateQualificationStore(
    database,
    pool,
    sourceAuthority,
    { isAccessible: async () => false },
    () => M7_WP03_SEED_AT,
    {
      candidate: () => IDS.opportunityCandidateId,
      qualification: () => IDS.qualificationDecisionId
    }
  );
  const opportunityCandidate = await candidateStore.createCandidate({
    workspaceId: IDS.workspaceId,
    title: 'Review a trademark service opportunity from product feedback',
    serviceNeedSummary:
      'Deterministic rehearsal signal indicating a bounded trademark-service follow-up may be useful.',
    sources: [
      { owner: 'LITE', kind: 'CONTENT_USE_FEEDBACK', sourceId: feedback.productLoopFeedbackId }
    ],
    idempotencyKey: 'm7-wp03-opportunity-candidate'
  });
  const qualification = await candidateStore.recordQualification({
    workspaceId: IDS.workspaceId,
    candidate: { id: opportunityCandidate.opportunityCandidateId, version: opportunityCandidate.version },
    expectedCandidateFingerprintSha256: opportunityCandidate.opportunityCandidateFingerprintSha256,
    outcome: 'QUALIFIED_FOR_MARKREG',
    decidedByPrincipalId: IDS.userId,
    rationale: 'Explicit human-style rehearsal qualification for the deterministic Beta dataset.',
    idempotencyKey: 'm7-wp03-opportunity-qualification'
  });

  return {
    contentStore,
    candidateStore,
    recommendation,
    opportunity,
    ready,
    review,
    publishPackage,
    feedback,
    feedbackSource,
    opportunityCandidate,
    qualification
  };
}

async function seedMarkReg(
  database: ManagedDatabase,
  lite: Awaited<ReturnType<typeof seedLite>>
) {
  const pool = database.getPool();
  const authority: QualifiedOpportunityAuthority = {
    async resolve(workspaceId, candidate, qualificationDecision) {
      const [exactCandidate, currentCandidate, decision] = await Promise.all([
        lite.candidateStore.findCandidate(workspaceId, candidate.id, candidate.version),
        lite.candidateStore.findLatestCandidate(workspaceId, candidate.id),
        lite.candidateStore.findQualificationDecision(workspaceId, candidate.id)
      ]);
      if (
        !exactCandidate ||
        !currentCandidate ||
        !decision ||
        decision.opportunityQualificationDecisionId !== qualificationDecision.id ||
        decision.version !== qualificationDecision.version
      )
        throw new Error('Lite qualified Opportunity seed authority could not resolve exact lineage.');
      return { candidate: exactCandidate, currentCandidate, qualificationDecision: decision };
    }
  };
  const store = new PostgresFormalOpportunityStore(
    database,
    pool,
    authority,
    () => M7_WP03_SEED_AT,
    () => IDS.formalOpportunityId
  );
  const formalOpportunity = await store.createFormalOpportunity({
    workspaceId: IDS.workspaceId,
    candidate: {
      id: lite.opportunityCandidate.opportunityCandidateId,
      version: lite.opportunityCandidate.version
    },
    expectedCandidateFingerprintSha256:
      lite.opportunityCandidate.opportunityCandidateFingerprintSha256,
    qualificationDecision: {
      id: lite.qualification.decision.opportunityQualificationDecisionId,
      version: lite.qualification.decision.version
    },
    relationshipModel: 'DIRECT',
    proposedCustomerIntent: {
      brandName: 'M7 WP03 Seed Mark',
      applicantCountry: 'US',
      targetJurisdictions: ['US'],
      goodsServicesDescription: 'Deterministic rehearsal-only trademark service scope.'
    },
    promotedByPrincipalId: IDS.userId,
    idempotencyKey: 'm7-wp03-formal-opportunity'
  });
  const handoff = await store.prepareIntakeHandoff({
    workspaceId: IDS.workspaceId,
    formalOpportunity: {
      id: formalOpportunity.formalTrademarkServiceOpportunityId,
      version: formalOpportunity.version
    },
    expectedFormalOpportunityFingerprintSha256:
      formalOpportunity.formalOpportunityFingerprintSha256,
    relationshipModel: 'DIRECT',
    customerIntent: {
      brandName: 'M7 WP03 Seed Mark',
      applicantCountry: 'US',
      targetJurisdictions: ['US'],
      goodsServicesDescription: 'Deterministic rehearsal-only trademark service scope.'
    },
    confirmedByPrincipalId: IDS.userId,
    idempotencyKey: 'm7-wp03-intake-handoff'
  });
  if (handoff.currentFormalOpportunity.status !== 'HANDED_OFF_TO_INTAKE')
    throw new Error('MarkReg deterministic seed did not reach the bounded Intake handoff state.');
  return { formalOpportunity, handoff };
}

async function seedExecution(database: ManagedDatabase) {
  const pool = database.getPool();
  await pool.query(
    `INSERT INTO filing_authorizations(
       filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,
       authorization_record,created_by,updated_by,created_at,updated_at
     ) VALUES($1,$2,$3,'1','AUTHORIZED',2,'{}'::jsonb,$4,$4,$5,$5)`,
    [
      IDS.filingAuthorizationId,
      IDS.workspaceId,
      'preparation-lock_m7-wp03-beta-seed',
      IDS.userId,
      M7_WP03_SEED_AT
    ]
  );
  await pool.query(
    `INSERT INTO execution_releases(
       execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,
       release_record,created_by,updated_by,created_at,updated_at
     ) VALUES($1,$2,$3,2,'RELEASED_FOR_EXECUTION',3,'{}'::jsonb,$4,$4,$5,$5)`,
    [IDS.executionReleaseId, IDS.workspaceId, IDS.filingAuthorizationId, IDS.userId, M7_WP03_SEED_AT]
  );
  await pool.query(
    `INSERT INTO filing_execution_task_drafts(
       filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,
       task_record,created_by,updated_by,created_at,updated_at
     ) VALUES($1,$2,$3,$4,'PREPARED','{}'::jsonb,$5,$5,$6,$6)`,
    [
      IDS.filingTaskDraftId,
      IDS.workspaceId,
      IDS.executionReleaseId,
      IDS.filingAuthorizationId,
      IDS.userId,
      M7_WP03_SEED_AT
    ]
  );

  const receipts = new PostgresProviderReturnEvidenceRepository(database, pool);
  const reviews = new PostgresEvidenceReviewRepository(database, pool);
  const receipt: ExecutionProviderReturnEvidenceReceipt = {
    schemaVersion: 1,
    evidenceHandoff: {
      schemaVersion: 1,
      evidenceHandoffId: IDS.evidenceHandoffId,
      workspaceId: IDS.workspaceId,
      providerReturn: { id: IDS.providerReturnId, version: 1 },
      providerReturnFingerprintSha256: sha256('m7-wp03-provider-return'),
      executionRelease: { id: IDS.executionReleaseId, version: 3 },
      filingExecutionTaskDraft: { id: IDS.filingTaskDraftId, version: 1 },
      correlationId: CORRELATION_ID,
      handedOffAt: M7_WP03_SEED_AT
    },
    providerId: 'provider_m7-wp03-beta-seed',
    providerWorkspaceId: PROVIDER_WORKSPACE_ID,
    providerActorId: 'provider-actor_m7-wp03-beta-seed',
    workStatusClaim: 'Rehearsal-only provider evidence awaiting explicit internal review.',
    artifacts: [
      {
        reference: 'artifact://m7-wp03/rehearsal-evidence.pdf',
        fileName: 'rehearsal-evidence.pdf',
        mediaType: 'application/pdf',
        sha256: sha256('m7-wp03-evidence-artifact')
      }
    ],
    assertions: [
      {
        code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
        value: true,
        evidenceReferences: ['artifact://m7-wp03/rehearsal-evidence.pdf']
      }
    ],
    reviewStatus: 'PENDING_REVIEW',
    authorityConsequences: evidenceHandoffAuthorityConsequences,
    receivedAt: M7_WP03_SEED_AT
  };
  await receipts.saveReceipt(
    receipt,
    'm7-wp03-execution-evidence',
    sha256('m7-wp03-execution-evidence-request')
  );
  const reviewService = new EvidenceReviewService(
    reviews,
    receipts,
    () => M7_WP03_SEED_AT,
    () => IDS.evidenceReceiptId,
    () => IDS.evidenceReviewDecisionId,
    () => IDS.correctionRequestId
  );
  const principal = {
    workspaceId: IDS.workspaceId,
    userId: IDS.userId as `user_${string}`,
    permissions: ['review:read', 'review:perform']
  };
  const source = await reviewService.captureReviewSource(IDS.evidenceHandoffId, principal);
  const decision = await reviewService.recordDecision(
    {
      workspaceId: IDS.workspaceId,
      evidenceReceiptId: source.evidenceReceipt.id,
      expectedEvidenceReceiptVersion: source.evidenceReceipt.version,
      expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
      outcome: 'ADMITTED_FOR_INTERNAL_USE',
      rationale:
        'Deterministic rehearsal evidence admitted only for internal Capability-learning observation.',
      correctionReasons: [],
      idempotencyKey: 'm7-wp03-execution-review',
      correlationId: source.correlationId
    },
    principal
  );
  return { reviews, decision };
}

async function seedCapability(
  database: ManagedDatabase,
  execution: Awaited<ReturnType<typeof seedExecution>>
) {
  const executionRuntime = createExecution({
    port: 0,
    internalServiceSecret: INTERNAL_SECRET,
    providerExecutionRoutes: createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: INTERNAL_SECRET,
      evidenceReviewReader: execution.reviews
    })
  });
  await executionRuntime.start();
  try {
    const pool = database.getPool();
    const registry = new PostgresRuntimeCapabilityRegistry(
      database,
      pool,
      () => M7_WP03_SEED_AT,
      () => IDS.runtimeCapabilityId
    );
    const imported = await registry.importAccepted({
      definition: {
        sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
        capabilityId: 'evidence-review-analysis',
        capabilityVersion: '1.0.0',
        title: 'Evidence review analysis',
        description: 'Reviews governed evidence and records a bounded internal decision.',
        lineage: {
          domainId: 'trademark-services',
          capabilityId: 'evidence-review-analysis',
          skillId: 'evidence-review',
          actionId: 'record-review-decision'
        },
        canonReference: {
          canonId: 'capability-canon',
          canonVersion: '2026.08.12',
          sourceFingerprintSha256: sha256('m7-wp03-accepted-capability-canon')
        }
      },
      idempotencyKey: 'm7-wp03-runtime-capability'
    });
    const sourceAuthority = new HttpExecutionCapabilityObservationSourceAuthority(
      `http://127.0.0.1:${executionRuntime.listeningPort}`,
      INTERNAL_SECRET
    );
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      pool,
      registry,
      sourceAuthority,
      () => M7_WP03_SEED_AT,
      () => IDS.observationId,
      () => IDS.ledgerEntryId
    );
    const admitted = await ledger.admit(
      {
        runtimeCapability: {
          id: imported.definition.runtimeCapabilityDefinitionId,
          version: imported.definition.version
        },
        source: {
          owner: 'EXECUTION',
          kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
          sourceId: execution.decision.evidenceReviewDecisionId,
          sourceVersion: execution.decision.version,
          sourceFingerprintSha256: execution.decision.decisionFingerprintSha256
        }
      },
      'm7-wp03-capability-observation'
    );
    const reflections = new PostgresPrivateReflectionCandidateService(
      database,
      pool,
      registry,
      () => M7_WP03_SEED_AT,
      () => IDS.reflectionCandidateId
    );
    const reflection = await reflections.generate(
      { ledgerEntryId: admitted.ledgerEntry.capabilityLedgerEntryId },
      'm7-wp03-reflection-candidate'
    );
    if (reflection.candidate.status !== 'PENDING')
      throw new Error('M7-WP-03 Capability seed must stop at a pending private Reflection Candidate.');
    return { imported, admitted, reflection };
  } finally {
    await executionRuntime.stop();
  }
}

export async function resetAndSeedM7Wp03BetaScenario(
  config: Readonly<M7Wp03BetaSeedConfig>
): Promise<M7Wp03BetaSeedManifest> {
  const databases = {
    CORE: managedDatabase(config.databaseUrls.CORE, 'CORE'),
    LITE: managedDatabase(config.databaseUrls.LITE, 'LITE'),
    MARKREG: managedDatabase(config.databaseUrls.MARKREG, 'MARKREG'),
    EXECUTION: managedDatabase(config.databaseUrls.EXECUTION, 'EXECUTION'),
    CAPABILITY_ENGINE: managedDatabase(config.databaseUrls.CAPABILITY_ENGINE, 'CAPABILITY_ENGINE')
  } as const;

  try {
    for (const owner of Object.keys(databases) as SeedOwner[])
      await resetOwnerDatabase(databases[owner], owner);

    const core = await seedCore(databases.CORE);
    const lite = await seedLite(databases.LITE, core);
    const markreg = await seedMarkReg(databases.MARKREG, lite);
    const execution = await seedExecution(databases.EXECUTION);
    const capability = await seedCapability(databases.CAPABILITY_ENGINE, execution);

    const boundary = {
      schemaVersion: 1,
      kind: 'SEEDED_DEMO_RECORD',
      environment: config.environment,
      nonProduction: true,
      customerTruth: false,
      providerTruth: false,
      officialTruth: false,
      authority: betaReadinessNoAuthorityConsequences
    } satisfies SeededDemoRecordBoundary;

    const manifestWithoutFingerprint = {
      schemaVersion: 1,
      scenarioId: M7_WP03_SCENARIO_ID,
      environment: config.environment,
      nonProduction: true,
      workspaceId: IDS.workspaceId,
      subjectUserId: IDS.userId,
      owners: (Object.keys(databases) as SeedOwner[]).map((owner) => ({
        owner,
        databaseSeparated: true as const,
        resetBeforeSeed: true as const,
        ownerMigrationsApplied: true as const
      })),
      records: {
        core: {
          userId: IDS.userId,
          workspaceId: IDS.workspaceId,
          membershipId: IDS.membershipId,
          knowledgeIntakeId: IDS.knowledgeIntakeId,
          readyPackageId: IDS.readyPackageId,
          sourceFingerprintSha256: core.accepted.requestSha256
        },
        content: {
          recommendationId: lite.recommendation.todayRecommendationId,
          contentOpportunityId: lite.opportunity.contentOpportunityId,
          contentDraftId: lite.ready.contentDraftId,
          reviewDecisionId: lite.review.contentReviewDecisionId,
          publishPackageId: lite.publishPackage.publishPackageId,
          publishPackageFingerprintSha256: lite.publishPackage.publishPackageFingerprintSha256,
          feedbackId: lite.feedback.productLoopFeedbackId,
          feedbackSourceFingerprintSha256: lite.feedbackSource.sourceFingerprintSha256,
          externalUseVerified: false as const
        },
        opportunity: {
          candidateId: lite.opportunityCandidate.opportunityCandidateId,
          qualificationDecisionId: lite.qualification.decision.opportunityQualificationDecisionId,
          qualificationOutcome: 'QUALIFIED_FOR_MARKREG' as const,
          formalOpportunityId:
            markreg.handoff.currentFormalOpportunity.formalTrademarkServiceOpportunityId,
          formalOpportunityStatus: 'HANDED_OFF_TO_INTAKE' as const,
          intakeHandoffPrepared: true as const,
          intakeCreated: false as const,
          matterCreated: false as const,
          filingSubmitted: false as const
        },
        capability: {
          evidenceReviewDecisionId: execution.decision.evidenceReviewDecisionId,
          runtimeCapabilityId: capability.imported.definition.runtimeCapabilityDefinitionId,
          observationId: capability.admitted.observation.capabilityObservationId,
          ledgerEntryId: capability.admitted.ledgerEntry.capabilityLedgerEntryId,
          reflectionCandidateId: capability.reflection.candidate.reflectionCandidateId,
          reflectionCandidateFingerprintSha256:
            capability.reflection.candidateFingerprintSha256,
          reflectionStatus: 'PENDING' as const,
          capabilityVerified: false as const,
          canonicalTruthCreated: false as const
        }
      },
      safeguards: {
        realCustomerCredentialsUsed: false as const,
        realProviderCredentialsUsed: false as const,
        externalActionsExecuted: false as const,
        crossServiceSqlPerformed: false as const,
        productionDeploymentAuthorized: false as const,
        betaReleased: false as const
      },
      boundary,
      authority: betaReadinessNoAuthorityConsequences
    };
    return {
      ...manifestWithoutFingerprint,
      scenarioFingerprintSha256: sha256(manifestWithoutFingerprint)
    } satisfies M7Wp03BetaSeedManifest;
  } finally {
    await Promise.all(Object.values(databases).map((database) => database.close()));
  }
}

export async function runM7Wp03BetaSeedFromEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<M7Wp03BetaSeedManifest> {
  return resetAndSeedM7Wp03BetaScenario(readM7Wp03BetaSeedConfig(env));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await runM7Wp03BetaSeedFromEnvironment();
  process.stdout.write(`M7_WP03_BETA_SEED_READY ${JSON.stringify(manifest)}\n`);
}
