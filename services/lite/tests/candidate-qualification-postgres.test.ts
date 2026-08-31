import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  OpportunityCandidateId,
  OpportunityCandidate,
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
const internalServiceSecret = 'lite-365-candidate-read-runtime-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_candidate_read',
  sessionId: 'session_candidate_read',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_candidate_read',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

suite('PostgreSQL Lite Opportunity Candidate qualification', () => {
  let runtime: ChildProcess | undefined;
  let baseUrl: string;
  async function read(suffix = '', actor = principal) {
    const response = await fetch(`${baseUrl}/v1/opportunity-candidates${suffix}`, {
      headers: {
        'x-markorbit-internal-authorization': internalServiceSecret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(actor),
        'x-markorbit-workspace-id': actor.workspaceId
      }
    });
    return { status: response.status, body: (await response.json()) as unknown };
  }
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
    // The actual runtime must serve all reads even when PostgreSQL forbids writes.
    const readOnlyUrl = new URL(url!);
    readOnlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
    runtime = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: path.resolve('.'),
      windowsHide: true,
      env: {
        ...process.env,
        LITE_DATABASE_URL: readOnlyUrl.toString(),
        DB_STATEMENT_TIMEOUT_MS: '300',
        PORT: '0',
        MO_INTERNAL_SERVICE_SECRET: internalServiceSecret
      },
      stdio: ['ignore', 'pipe', 'pipe']
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
        const match = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
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
        'TRUNCATE lite_candidate_qualification_commands,lite_opportunity_qualification_decisions,lite_opportunity_candidates CASCADE'
      );
  });

  afterAll(async () => {
    if (runtime && runtime.exitCode === null && runtime.signalCode === null) {
      const exited = once(runtime, 'exit');
      runtime.kill();
      await exited;
    }
    await database.close();
  });

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

  it('serves empty Workspaces and identical non-disclosing 404s for absent and foreign Candidates', async () => {
    const created = await candidate();
    const otherPrincipal = { ...principal, workspaceId: otherWorkspaceId };
    expect(await read('', otherPrincipal)).toEqual({
      status: 200,
      body: { items: [], nextCursor: null }
    });
    for (const suffix of ['', '/qualification']) {
      const foreign = await read(`/${created.opportunityCandidateId}${suffix}`, otherPrincipal);
      const unknown = await read(`/opportunity-candidate_unknown${suffix}`);
      expect(foreign).toEqual(unknown);
      expect(foreign).toMatchObject({
        status: 404,
        body: { code: 'OPPORTUNITY_CANDIDATE_NOT_FOUND' }
      });
    }
    expect(await read(`/${created.opportunityCandidateId}/qualification`)).toEqual({
      status: 200,
      body: null
    });
    const otherStore = new PostgresLiteCandidateQualificationStore(
      database,
      database.getPool(),
      sourceAuthority,
      customerAuthority,
      now,
      { candidate: () => created.opportunityCandidateId, qualification: ids.qualification }
    );
    const otherCandidate = await otherStore.createCandidate({
      workspaceId: otherWorkspaceId,
      title: 'Private other-Workspace Candidate',
      serviceNeedSummary: 'This record must never replace the same ID in the first Workspace.',
      sources: [{ owner: source.owner, kind: source.kind, sourceId: source.sourceId }],
      idempotencyKey: 'other-workspace-candidate'
    });
    const otherDisposition = await otherStore.recordQualification({
      workspaceId: otherWorkspaceId,
      candidate: { id: otherCandidate.opportunityCandidateId, version: otherCandidate.version },
      expectedCandidateFingerprintSha256: otherCandidate.opportunityCandidateFingerprintSha256,
      outcome: 'REJECTED',
      decidedByPrincipalId: principal.userId,
      rationale: 'Other Workspace decision.',
      idempotencyKey: 'other-workspace-decision'
    });
    expect(await read()).toEqual({ status: 200, body: { items: [created], nextCursor: null } });
    expect(await read(`/${created.opportunityCandidateId}`)).toEqual({
      status: 200,
      body: created
    });
    expect(await read(`/${created.opportunityCandidateId}/qualification`)).toEqual({
      status: 200,
      body: null
    });
    expect(await read(`/${created.opportunityCandidateId}/qualification`, otherPrincipal)).toEqual({
      status: 200,
      body: otherDisposition.decision
    });
  });

  it('deduplicates latest versions before paging and keeps identity order across qualification updates', async () => {
    const created: OpportunityCandidate[] = [];
    for (const id of ['c', 'a', 'b']) {
      const service = new PostgresLiteCandidateQualificationStore(
        database,
        database.getPool(),
        sourceAuthority,
        customerAuthority,
        () => '2026-08-11T09:31:00.000Z',
        { candidate: () => `opportunity-candidate_${id}`, qualification: ids.qualification }
      );
      created.push(await candidate(service, `page-${id}`));
    }
    const a = created[1]!;
    const disposition = await store().recordQualification({
      workspaceId,
      candidate: { id: a.opportunityCandidateId, version: a.version },
      expectedCandidateFingerprintSha256: a.opportunityCandidateFingerprintSha256,
      outcome: 'DEFERRED',
      decidedByPrincipalId: principal.userId,
      rationale: 'More evidence needed.',
      idempotencyKey: 'page-qualification'
    });
    const first = await read('?limit=1');
    expect(first).toEqual({
      status: 200,
      body: { items: [disposition.currentCandidate], nextCursor: a.opportunityCandidateId }
    });
    expect(await read('?limit=1')).toEqual(first);
    const second = await read(`?limit=1&cursor=${a.opportunityCandidateId}`);
    expect(second).toEqual({
      status: 200,
      body: { items: [created[2]], nextCursor: created[2]!.opportunityCandidateId }
    });
    expect(await read(`?limit=1&cursor=${created[2]!.opportunityCandidateId}`)).toEqual({
      status: 200,
      body: { items: [created[0]], nextCursor: null }
    });
    expect(await read(`?cursor=${created[0]!.opportunityCandidateId}`)).toEqual({
      status: 200,
      body: { items: [], nextCursor: null }
    });
    expect(await read()).toEqual({
      status: 200,
      body: { items: [disposition.currentCandidate, created[2], created[0]], nextCursor: null }
    });
    expect(
      await store().listLatestCandidates(otherWorkspaceId, { cursor: a.opportunityCandidateId })
    ).toEqual({ items: [], nextCursor: null });
  });

  it('bounds default and maximum page size over real records', async () => {
    for (let index = 0; index < 101; index++) await candidate(store(), `bounded-${index}`);
    const first = await store().listLatestCandidates(workspaceId);
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toBe(first.items[49]!.opportunityCandidateId);
    const maximum = await store().listLatestCandidates(workspaceId, { limit: 100 });
    expect(maximum.items).toHaveLength(100);
    const last = await store().listLatestCandidates(workspaceId, {
      limit: 100,
      cursor: maximum.nextCursor!
    });
    expect(last.items).toHaveLength(1);
    expect(last.nextCursor).toBeNull();
    expect(
      new Set([...maximum.items, ...last.items].map((item) => item.opportunityCandidateId)).size
    ).toBe(101);
  });

  it.each(['QUALIFIED_FOR_MARKREG', 'REJECTED', 'DEFERRED'] as const)(
    'reads %s unchanged with exact reviewed version/fingerprint and no durable side effects',
    async (outcome) => {
      const created = await candidate();
      const disposition = await store().recordQualification({
        workspaceId,
        candidate: { id: created.opportunityCandidateId, version: created.version },
        expectedCandidateFingerprintSha256: created.opportunityCandidateFingerprintSha256,
        outcome,
        decidedByPrincipalId: principal.userId,
        rationale: `Human decision: ${outcome}.`,
        idempotencyKey: 'runtime-qualification'
      });
      const snapshot = async () =>
        Promise.all([
          database
            .getPool()
            .query<Record<string, unknown>>(
              'SELECT * FROM lite_opportunity_candidates ORDER BY workspace_id,opportunity_candidate_id,version'
            ),
          database
            .getPool()
            .query<Record<string, unknown>>(
              'SELECT * FROM lite_opportunity_qualification_decisions ORDER BY workspace_id,opportunity_qualification_decision_id'
            ),
          database
            .getPool()
            .query<Record<string, unknown>>(
              'SELECT * FROM lite_candidate_qualification_commands ORDER BY workspace_id,idempotency_key'
            ),
          database
            .getPool()
            .query<Record<string, unknown>>(
              'SELECT * FROM lite_prepared_actions ORDER BY workspace_id,prepared_action_id'
            )
        ]).then((results) => results.map((result) => result.rows));
      const before = await snapshot();
      expect(await read(`/${created.opportunityCandidateId}`)).toEqual({
        status: 200,
        body: disposition.currentCandidate
      });
      expect(await read(`/${created.opportunityCandidateId}/qualification`)).toEqual({
        status: 200,
        body: disposition.decision
      });
      expect(disposition.decision.candidate.version).toBe(1);
      expect(disposition.currentCandidate.version).toBe(2);
      expect(disposition.decision.expectedCandidateFingerprintSha256).toBe(
        created.opportunityCandidateFingerprintSha256
      );
      expect(disposition.decision.expectedCandidateFingerprintSha256).not.toBe(
        disposition.currentCandidate.opportunityCandidateFingerprintSha256
      );
      expect(await read()).toEqual({
        status: 200,
        body: { items: [disposition.currentCandidate], nextCursor: null }
      });
      expect(await snapshot()).toEqual(before);
    }
  );

  it('reports real PostgreSQL read failures instead of empty pages or absent decisions', async () => {
    const created = await candidate();
    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'LOCK TABLE lite_opportunity_qualification_decisions IN ACCESS EXCLUSIVE MODE'
      );
      expect(await read(`/${created.opportunityCandidateId}`)).toMatchObject({ status: 200 });
      expect(await read(`/${created.opportunityCandidateId}/qualification`)).toMatchObject({
        status: 503,
        body: { code: 'PERSISTENCE_UNAVAILABLE', retryable: true }
      });
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query('LOCK TABLE lite_opportunity_candidates IN ACCESS EXCLUSIVE MODE');
      for (const suffix of [
        '',
        `/${created.opportunityCandidateId}`,
        `/${created.opportunityCandidateId}/qualification`
      ]) {
        expect(await read(suffix)).toMatchObject({
          status: 503,
          body: { code: 'PERSISTENCE_UNAVAILABLE', retryable: true }
        });
      }
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(await read(`/${created.opportunityCandidateId}/qualification`)).toEqual({
      status: 200,
      body: null
    });
  });

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
    expect(
      await afterRestart.findLatestCandidate(workspaceId, created.opportunityCandidateId)
    ).toEqual(disposition.currentCandidate);
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
    expect(
      (await service.findLatestCandidate(workspaceId, created.opportunityCandidateId))?.version
    ).toBe(2);
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
