import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  OpportunityCandidateId,
  OpportunityQualificationDecisionId,
  ProductLoopSourceReference
} from '@markorbit/contracts/product-loop';
import {
  LiteCandidateQualificationError,
  PostgresLiteCandidateQualificationStore,
  type ProductLoopCustomerRelationshipAuthority
} from '../src/candidate-qualification.js';
import type { ProductLoopSourceAuthority } from '../src/content-preparation.js';

const url = process.env.LITE_CANDIDATE_TEST_DATABASE_URL;
const required = process.env.LITE_CANDIDATE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_CANDIDATE_TEST_DATABASE_URL is required when LITE_CANDIDATE_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '99999999-9999-4999-8999-999999999999';
const otherWorkspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const customerId = 'customer_acme-001' as const;
const otherCustomerId = 'customer_other-001' as const;
const sourceFingerprint = 'b'.repeat(64);

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

suite('PostgreSQL Lite Opportunity Candidate qualification', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-candidate-qualification-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_candidate_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const source: ProductLoopSourceReference = {
    schemaVersion: 1,
    owner: 'LITE',
    kind: 'CONTENT_USE_FEEDBACK',
    sourceId: 'product-loop-feedback_manual-001',
    sourceVersion: 1,
    sourceFingerprintSha256: sourceFingerprint,
    observedAt: '2026-08-11T09:30:00.000Z',
    correlationId: 'correlation_candidate-001'
  };
  const sourceAuthority: ProductLoopSourceAuthority = {
    resolve(requestWorkspaceId, locator) {
      if (requestWorkspaceId !== workspaceId && requestWorkspaceId !== otherWorkspaceId)
        throw new Error('unexpected workspace');
      if (
        locator.owner !== source.owner ||
        locator.kind !== source.kind ||
        locator.sourceId !== source.sourceId
      )
        throw new Error('unexpected source locator');
      return Promise.resolve(structuredClone(source));
    }
  };
  const customerAuthority: ProductLoopCustomerRelationshipAuthority = {
    isAccessible(requestWorkspaceId, requestedCustomerId) {
      return Promise.resolve(
        requestWorkspaceId === workspaceId && requestedCustomerId === customerId
      );
    }
  };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 11, 9, 31, tick++)).toISOString();
  const ids = {
    candidate: sequence<OpportunityCandidateId>('opportunity-candidate'),
    qualification: sequence<OpportunityQualificationDecisionId>('opportunity-qualification')
  };

  function store() {
    return new PostgresLiteCandidateQualificationStore(
      database,
      database.getPool(),
      sourceAuthority,
      customerAuthority,
      now,
      ids
    );
  }

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
    await migrate(database.getPool(), 'lite_candidate_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Lite Candidate Test','lite-candidate-test'),
       ($2,'Lite Candidate Other','lite-candidate-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_candidate_qualification_commands,lite_opportunity_qualification_decisions,lite_opportunity_candidates CASCADE'
      );
  });

  afterAll(() => database.close());

  async function candidate(service = store(), key = 'candidate-1') {
    return service.createCandidate({
      workspaceId,
      customerId,
      title: 'Possible Canada filing need',
      serviceNeedSummary: 'A recorded content-use signal suggests a possible Canada filing need.',
      sources: [
        {
          owner: 'LITE',
          kind: 'CONTENT_USE_FEEDBACK',
          sourceId: source.sourceId
        }
      ],
      idempotencyKey: key
    });
  }

  it('persists exact provenance and explicit human qualification without creating a Formal Opportunity', async () => {
    const first = store();
    const created = await candidate(first, 'candidate-restart');
    expect(created.sources).toEqual([source]);
    expect(created.customerId).toBe(customerId);
    expect(created.status).toBe('OPEN');
    expect(created.formalOpportunityCreated).toBe(false);
    expect(created.customerContacted).toBe(false);

    const disposition = await first.recordQualification({
      workspaceId,
      candidate: { id: created.opportunityCandidateId, version: created.version },
      expectedCandidateFingerprintSha256: created.opportunityCandidateFingerprintSha256,
      outcome: 'QUALIFIED_FOR_MARKREG',
      decidedByPrincipalId: 'user_qualifier-001',
      rationale: 'The signal is specific enough to promote through the MarkReg owning boundary.',
      idempotencyKey: 'qualification-restart'
    });
    expect(disposition.decision.candidate).toEqual({
      id: created.opportunityCandidateId,
      version: created.version
    });
    expect(disposition.decision.expectedCandidateFingerprintSha256).toBe(
      created.opportunityCandidateFingerprintSha256
    );
    expect(disposition.decision.formalOpportunityCreated).toBe(false);
    expect(disposition.decision.customerContacted).toBe(false);
    expect(disposition.currentCandidate.version).toBe(2);
    expect(disposition.currentCandidate.status).toBe('DISPOSITIONED');
    expect(disposition.currentCandidate.formalOpportunityCreated).toBe(false);
    expect(disposition.currentCandidate.customerContacted).toBe(false);

    const afterRestart = store();
    expect(
      await afterRestart.findCandidate(workspaceId, created.opportunityCandidateId, 1)
    ).toEqual(created);
    expect(await afterRestart.findLatestCandidate(workspaceId, created.opportunityCandidateId)).toEqual(
      disposition.currentCandidate
    );
    expect(
      await afterRestart.findQualificationDecision(workspaceId, created.opportunityCandidateId)
    ).toEqual(disposition.decision);
    expect(
      await afterRestart.recordQualification({
        workspaceId,
        candidate: { id: created.opportunityCandidateId, version: created.version },
        expectedCandidateFingerprintSha256: created.opportunityCandidateFingerprintSha256,
        outcome: 'QUALIFIED_FOR_MARKREG',
        decidedByPrincipalId: 'user_qualifier-001',
        rationale: 'The signal is specific enough to promote through the MarkReg owning boundary.',
        idempotencyKey: 'qualification-restart'
      })
    ).toEqual(disposition);
    expect(
      await afterRestart.findLatestCandidate(otherWorkspaceId, created.opportunityCandidateId)
    ).toBeUndefined();
  });

  it('enforces Workspace/customer relationship isolation before candidate creation', async () => {
    await expect(
      store().createCandidate({
        workspaceId,
        customerId: otherCustomerId,
        title: 'Cross-customer candidate',
        serviceNeedSummary: 'This relationship is not accessible in the requested Workspace.',
        sources: [
          {
            owner: 'LITE',
            kind: 'CONTENT_USE_FEEDBACK',
            sourceId: source.sourceId
          }
        ],
        idempotencyKey: 'candidate-customer-denied'
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(
      await database
        .getPool()
        .query<{ count: number }>('SELECT count(*)::int AS count FROM lite_opportunity_candidates')
        .then((result) => result.rows[0]?.count)
    ).toBe(0);
  });

  it('serializes competing qualification decisions so one exact candidate version has one human disposition', async () => {
    const service = store();
    const created = await candidate(service, 'candidate-concurrency');
    const commands = [
      {
        outcome: 'QUALIFIED_FOR_MARKREG' as const,
        rationale: 'Qualified after review.',
        key: 'qualification-concurrent-a'
      },
      {
        outcome: 'DEFERRED' as const,
        rationale: 'Defer until more evidence is available.',
        key: 'qualification-concurrent-b'
      }
    ].map(({ outcome, rationale, key }) =>
      service.recordQualification({
        workspaceId,
        candidate: { id: created.opportunityCandidateId, version: created.version },
        expectedCandidateFingerprintSha256: created.opportunityCandidateFingerprintSha256,
        outcome,
        decidedByPrincipalId: 'user_qualifier-002',
        rationale,
        idempotencyKey: key
      })
    );
    const settled = await Promise.allSettled(commands);
    expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const failure = settled.find((item) => item.status === 'rejected');
    expect(failure?.status).toBe('rejected');
    if (failure?.status === 'rejected') {
      expect(failure.reason).toBeInstanceOf(LiteCandidateQualificationError);
      expect((failure.reason as LiteCandidateQualificationError).code).toBe('VERSION_CONFLICT');
    }
    expect((await service.findLatestCandidate(workspaceId, created.opportunityCandidateId))?.version).toBe(
      2
    );
    expect(
      await database
        .getPool()
        .query<{ count: number }>(
          'SELECT count(*)::int AS count FROM lite_opportunity_qualification_decisions WHERE workspace_id=$1 AND opportunity_candidate_id=$2',
          [workspaceId, created.opportunityCandidateId]
        )
        .then((result) => result.rows[0]?.count)
    ).toBe(1);
  });

  it('replays exact candidate creation but rejects idempotency drift', async () => {
    const original = await candidate(store(), 'candidate-same-key');
    expect(await candidate(store(), 'candidate-same-key')).toEqual(original);
    await expect(
      store().createCandidate({
        workspaceId,
        customerId,
        title: 'Different candidate title',
        serviceNeedSummary: 'A recorded content-use signal suggests a possible Canada filing need.',
        sources: [
          {
            owner: 'LITE',
            kind: 'CONTENT_USE_FEEDBACK',
            sourceId: source.sourceId
          }
        ],
        idempotencyKey: 'candidate-same-key'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('records rejected and deferred outcomes as bounded dispositions with no outreach or owner mutation', async () => {
    for (const [index, outcome] of (['REJECTED', 'DEFERRED'] as const).entries()) {
      const service = store();
      const created = await candidate(service, `candidate-disposition-${index}`);
      const result = await service.recordQualification({
        workspaceId,
        candidate: { id: created.opportunityCandidateId, version: created.version },
        expectedCandidateFingerprintSha256: created.opportunityCandidateFingerprintSha256,
        outcome,
        decidedByPrincipalId: 'user_qualifier-003',
        rationale: `Explicit ${outcome.toLowerCase()} disposition.`,
        idempotencyKey: `qualification-disposition-${index}`
      });
      expect(result.decision.outcome).toBe(outcome);
      expect(result.decision.formalOpportunityCreated).toBe(false);
      expect(result.decision.customerContacted).toBe(false);
      expect(result.currentCandidate.status).toBe('DISPOSITIONED');
      expect(result.currentCandidate.formalOpportunityCreated).toBe(false);
      expect(result.currentCandidate.customerContacted).toBe(false);
    }
  });
});
