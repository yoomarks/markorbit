import path from 'node:path';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresPartnerIntelligenceStore } from '../src/partner-intelligence-store.js';

const url = process.env.LITE_CANDIDATE_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const workspaceId = '99999999-9999-4999-8999-999999999999';
const otherWorkspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const observedAt = '2026-09-16T00:00:00.000Z';
const brief = {
  entityKind: 'FIRM' as const,
  displayName: 'Example IP Law',
  jurisdiction: 'US',
  serviceFocus: ['TRADEMARK_PROSECUTION'],
  observedPublicTrademarkWork: ['Representative shown on public record 1.'],
  chinaInternationalRelevance: 'Potential cross-border cooperation.',
  existingWorkspaceHistory: null,
  cooperationHypothesis: 'A mutual referral conversation may be useful.',
  uncertainty: ['Public work does not establish verified capability.'],
  suggestedOutreach: {
    subject: 'Possible cooperation',
    body: 'Would a short introduction be useful?'
  }
};
const evidenceRefs = [
  {
    owner: 'PUBLIC_SOURCE',
    kind: 'TRADEMARK_REPRESENTATION_RECORD',
    id: 'https://public.example/1',
    version: 'v1',
    fingerprintSha256: 'a'.repeat(64),
    observedAt
  },
  {
    owner: 'CORE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    id: 'ready-package_1',
    version: 'CORE_ACCEPTED_V1',
    fingerprintSha256: 'b'.repeat(64),
    observedAt
  }
];

suite('PostgreSQL Partner Intelligence owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'partner-intelligence-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_candidate_test'
  });
  let sequence = 0;
  const store = () =>
    new PostgresPartnerIntelligenceStore(
      database,
      database.getPool(),
      () => observedAt,
      () => `postgres${++sequence}`
    );

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_candidate_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Partner A','partner-a'),($2,'Partner B','partner-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30_000);
  beforeEach(async () => {
    sequence = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_partner_intelligence_commands,lite_partner_qualification_decisions,lite_partner_candidates CASCADE'
      );
  });
  afterAll(async () => database.close());

  it('persists and replays a candidate and its exact human decision across store restarts with Workspace isolation', async () => {
    const command = {
      workspaceId,
      evidenceRefs,
      brief,
      admittedByPrincipalId: 'user_professional',
      idempotencyKey: 'partner-admit-1'
    };
    const created = await store().createCandidate(command);
    await expect(store().createCandidate(command)).resolves.toEqual(created);
    const decision = await store().qualify({
      workspaceId,
      candidate: {
        id: created.partnerCandidateId,
        version: 1,
        fingerprintSha256: created.partnerCandidateFingerprintSha256
      },
      outcome: 'QUALIFIED',
      rationale: 'Human review supports a bounded introduction.',
      decidedByPrincipalId: 'user_professional',
      idempotencyKey: 'partner-qualify-1'
    });
    await expect(store().findCandidate(workspaceId, created.partnerCandidateId)).resolves.toEqual(
      created
    );
    await expect(
      store().findQualification(workspaceId, created.partnerCandidateId)
    ).resolves.toEqual(decision);
    await expect(
      store().findCandidate(otherWorkspaceId, created.partnerCandidateId)
    ).resolves.toBeUndefined();
    expect(decision.authorityConsequences.providerCreated).toBe(false);
  });
});
