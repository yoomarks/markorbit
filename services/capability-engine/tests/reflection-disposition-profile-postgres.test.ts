import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  capabilityLearningNoAuthorityConsequences,
  type CapabilityLedgerEntry,
  type CapabilityObservation,
  type RuntimeCapabilityDefinition,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresPrivateReflectionCandidateService } from '../src/private-reflection-candidate.js';
import { PostgresReflectionDispositionProfileService } from '../src/reflection-disposition-profile.js';
import { PostgresRuntimeCapabilityRegistry } from '../src/runtime-capability-registry.js';

const url = process.env.CAPABILITY_ENGINE_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'capability_engine_reflection_disposition_profile_test',
    DB_APPLICATION_NAME: 'markorbit-m6-wp-05-tests'
  });

const workspaceId = '11111111-1111-4111-8111-111111111111';
const subjectUserId = 'user_reflection_subject';
let database: ManagedDatabase;

function principal(userId = subjectUserId, workspace = workspaceId): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: `session_${userId}`,
    userId,
    workspaceId: workspace,
    membershipId: `membership_${userId}`,
    role: 'READ_ONLY',
    permissions: ['workspace:read'],
    sessionExpiresAt: '2026-08-13T00:00:00.000Z'
  };
}

function accepted() {
  return {
    sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
    capabilityId: 'evidence-review-analysis',
    capabilityVersion: '1.0.0',
    title: 'Evidence review analysis',
    description: 'Reviews governed evidence and records a bounded decision.',
    lineage: {
      domainId: 'trademark-services',
      capabilityId: 'evidence-review-analysis',
      skillId: 'evidence-review',
      actionId: 'record-review-decision'
    },
    canonReference: {
      canonId: 'capability-canon',
      canonVersion: '2026.08.12',
      sourceFingerprintSha256: 'a'.repeat(64)
    }
  };
}

async function runtimeCapability() {
  const registry = new PostgresRuntimeCapabilityRegistry(database, database.getPool());
  const imported = await registry.importAccepted({
    definition: accepted(),
    idempotencyKey: 'wp05-runtime-capability'
  });
  return { registry, definition: imported.definition };
}

function hexId(index: number): string {
  return index.toString(16).padStart(32, '0');
}

async function insertLedger(
  definition: RuntimeCapabilityDefinition,
  index: number,
  subject = subjectUserId,
  workspace = workspaceId
): Promise<CapabilityLedgerEntry> {
  const capabilityObservationId = `capability-observation_${hexId(index)}` as const;
  const capabilityLedgerEntryId = `capability-ledger_${hexId(index)}` as const;
  const sourceFingerprintSha256 = index.toString(16).padStart(64, '0');
  const recordedAt = `2026-08-12T00:${String(index).padStart(2, '0')}:00.000Z`;
  const observation: CapabilityObservation = {
    schemaVersion: 1,
    capabilityObservationId,
    workspaceId: workspace,
    subjectUserId: subject,
    runtimeCapability: {
      id: definition.runtimeCapabilityDefinitionId,
      version: definition.version
    },
    source: {
      owner: 'EXECUTION',
      kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
      sourceId: `evidence-review-decision_wp05-${index}`,
      sourceVersion: 1,
      sourceFingerprintSha256,
      observedAt: recordedAt,
      workspaceId: workspace,
      subjectUserId: subject,
      correlationId: `correlation_wp05-${index}`
    },
    subjectAttributionAuthority: 'OWNER_SOURCE',
    observationNature: 'PRIVATE_GOVERNED_WORK_OBSERVATION',
    admittedAt: recordedAt,
    authority: capabilityLearningNoAuthorityConsequences
  };
  const ledger: CapabilityLedgerEntry = {
    schemaVersion: 1,
    capabilityLedgerEntryId,
    workspaceId: workspace,
    subjectUserId: subject,
    runtimeCapability: {
      id: definition.runtimeCapabilityDefinitionId,
      version: definition.version
    },
    observation: {
      id: capabilityObservationId,
      sourceOwner: 'EXECUTION',
      sourceKind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
      sourceId: observation.source.sourceId,
      sourceVersion: 1,
      sourceFingerprintSha256
    },
    appendOnly: true,
    private: true,
    recordedAt,
    authority: capabilityLearningNoAuthorityConsequences
  };
  await database.getPool().query(
    `INSERT INTO capability_observations (
       capability_observation_id,workspace_id,subject_user_id,
       runtime_capability_definition_id,runtime_capability_version,
       source_owner,source_kind,source_id,source_version,source_fingerprint_sha256,
       source_observed_at,source_correlation_id,subject_attribution_authority,document_json,admitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
    [
      observation.capabilityObservationId,
      workspace,
      subject,
      definition.runtimeCapabilityDefinitionId,
      definition.version,
      observation.source.owner,
      observation.source.kind,
      observation.source.sourceId,
      String(observation.source.sourceVersion),
      sourceFingerprintSha256,
      recordedAt,
      observation.source.correlationId,
      observation.subjectAttributionAuthority,
      JSON.stringify(observation),
      recordedAt
    ]
  );
  await database.getPool().query(
    `INSERT INTO capability_ledger_entries (
       capability_ledger_entry_id,capability_observation_id,workspace_id,subject_user_id,
       runtime_capability_definition_id,runtime_capability_version,document_json,recorded_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [
      ledger.capabilityLedgerEntryId,
      observation.capabilityObservationId,
      workspace,
      subject,
      definition.runtimeCapabilityDefinitionId,
      definition.version,
      JSON.stringify(ledger),
      recordedAt
    ]
  );
  return ledger;
}

async function reset() {
  await database.getPool().query(
    `TRUNCATE
       capability_reflection_disposition_audit,
       capability_reflection_disposition_commands,
       capability_twin_projections,
       capability_profile_projections,
       capability_reflection_dispositions,
       capability_reflection_generation_audit,
       capability_reflection_generation_commands,
       capability_reflection_candidate_ledger_entries,
       capability_reflection_candidates,
       capability_observation_admission_audit,
       capability_observation_admission_commands,
       capability_ledger_entries,
       capability_observations,
       capability_runtime_definition_imports,
       capability_runtime_definitions,
       capability_runtime_identities
     RESTART IDENTITY CASCADE`
  );
}

function reflections(registry: PostgresRuntimeCapabilityRegistry) {
  return new PostgresPrivateReflectionCandidateService(
    database,
    database.getPool(),
    registry,
    () => '2026-08-12T01:00:00.000Z'
  );
}

function dispositions() {
  return new PostgresReflectionDispositionProfileService(
    database,
    database.getPool(),
    () => '2026-08-12T01:10:00.000Z'
  );
}

async function candidate(
  registry: PostgresRuntimeCapabilityRegistry,
  ledger: CapabilityLedgerEntry,
  key: string
) {
  return reflections(registry).generate({ ledgerEntryId: ledger.capabilityLedgerEntryId }, key);
}

integration('M6-WP-05 PostgreSQL Reflection disposition and private Profile/Twin', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
         capability_reflection_disposition_audit,
         capability_reflection_disposition_commands,
         capability_twin_projections,
         capability_profile_projections,
         capability_reflection_dispositions,
         capability_reflection_generation_audit,
         capability_reflection_generation_commands,
         capability_reflection_candidate_ledger_entries,
         capability_reflection_candidates,
         capability_observation_admission_audit,
         capability_observation_admission_commands,
         capability_ledger_entries,
         capability_observations,
         capability_runtime_definition_imports,
         capability_runtime_definitions,
         capability_runtime_identities
       CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'capability_engine_reflection_disposition_profile_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('accepts one exact current candidate and builds private non-verified Profile/Twin state', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const generated = await candidate(registry, ledger, 'wp05-candidate-accepted');
    const result = await dispositions().disposition(
      principal(),
      generated.candidate.reflectionCandidateId,
      {
        candidateVersion: generated.candidate.version,
        expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
        outcome: 'ACCEPTED',
        rationale: 'This is useful private reflection evidence.'
      },
      'wp05-disposition-accepted'
    );

    expect(result.replayed).toBe(false);
    expect(result.disposition).toMatchObject({
      workspaceId,
      subjectUserId,
      outcome: 'ACCEPTED',
      decidedBySubjectUserId: subjectUserId,
      candidate: {
        id: generated.candidate.reflectionCandidateId,
        version: generated.candidate.version,
        fingerprintSha256: generated.candidateFingerprintSha256
      },
      authority: {
        canonicalTruth: false,
        capabilityVerified: false,
        publicProfilePublished: false,
        publicScoreCreated: false,
        permissionChanged: false,
        roleChanged: false,
        externalActionExecuted: false
      }
    });
    expect(result.profile).toMatchObject({
      workspaceId,
      subjectUserId,
      runtimeCapability: {
        id: definition.runtimeCapabilityDefinitionId,
        version: definition.version
      },
      evidenceCount: 1,
      visibility: 'PRIVATE',
      numericProfessionalScore: null,
      verifiedBadge: false,
      authority: { capabilityVerified: false, canonicalTruth: false }
    });
    expect(result.profile.acceptedReflections).toHaveLength(1);
    expect(result.profile.acceptedReflections[0]?.text).toBe(
      generated.candidate.proposedPrivateReflection
    );
    expect(result.profile.outstandingReflectionCandidate).toBeUndefined();
    expect(result.twin).toMatchObject({
      workspaceId,
      subjectUserId,
      visibility: 'PRIVATE',
      autonomousIdentity: false,
      autonomousExecutionAuthority: false,
      authority: { capabilityVerified: false, canonicalTruth: false }
    });
    expect(result.twin.capabilitySummaries[0]?.acceptedPrivateReflection).toBe(
      generated.candidate.proposedPrivateReflection
    );
  });

  it('replays exact commands after service recreation and reuses the same business disposition for a new key', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const generated = await candidate(registry, ledger, 'wp05-candidate-replay');
    const body = {
      candidateVersion: generated.candidate.version,
      expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
      outcome: 'ACCEPTED'
    } as const;
    const first = await dispositions().disposition(
      principal(),
      generated.candidate.reflectionCandidateId,
      body,
      'wp05-disposition-replay'
    );
    const exactReplay = await dispositions().disposition(
      principal(),
      generated.candidate.reflectionCandidateId,
      body,
      'wp05-disposition-replay'
    );
    const newKeyReplay = await dispositions().disposition(
      principal(),
      generated.candidate.reflectionCandidateId,
      body,
      'wp05-disposition-new-key'
    );
    expect(exactReplay.replayed).toBe(true);
    expect(newKeyReplay.replayed).toBe(true);
    expect(exactReplay.disposition).toEqual(first.disposition);
    expect(newKeyReplay.disposition).toEqual(first.disposition);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM capability_reflection_dispositions) dispositions,
         (SELECT count(*)::int FROM capability_reflection_disposition_commands) commands,
         (SELECT count(*)::int FROM capability_reflection_disposition_audit) audits`
    );
    expect(counts.rows[0]).toMatchObject({ dispositions: 1, commands: 2, audits: 2 });
  });

  it('fails private by returning not-found for a different subject or Workspace Principal', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const generated = await candidate(registry, ledger, 'wp05-candidate-private');
    const body = {
      candidateVersion: generated.candidate.version,
      expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
      outcome: 'REJECTED'
    };
    await expect(
      dispositions().disposition(
        principal('user_other_subject'),
        generated.candidate.reflectionCandidateId,
        body,
        'wp05-other-subject'
      )
    ).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND', status: 404 });
    await expect(
      dispositions().disposition(
        principal(subjectUserId, '22222222-2222-4222-8222-222222222222'),
        generated.candidate.reflectionCandidateId,
        body,
        'wp05-other-workspace'
      )
    ).rejects.toMatchObject({ code: 'CANDIDATE_NOT_FOUND', status: 404 });
    expect(
      (
        await database
          .getPool()
          .query('SELECT count(*)::int count FROM capability_reflection_dispositions')
      ).rows[0]
    ).toMatchObject({ count: 0 });
  });

  it('rejects fingerprint drift and request-body identity or authority spoofing', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const generated = await candidate(registry, ledger, 'wp05-candidate-fingerprint');
    await expect(
      dispositions().disposition(
        principal(),
        generated.candidate.reflectionCandidateId,
        {
          candidateVersion: generated.candidate.version,
          expectedCandidateFingerprintSha256: 'f'.repeat(64),
          outcome: 'ACCEPTED'
        },
        'wp05-fingerprint-mismatch'
      )
    ).rejects.toMatchObject({ code: 'CANDIDATE_FINGERPRINT_MISMATCH' });
    await expect(
      dispositions().disposition(
        principal(),
        generated.candidate.reflectionCandidateId,
        {
          candidateVersion: generated.candidate.version,
          expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
          outcome: 'ACCEPTED',
          subjectUserId: 'attacker',
          workspaceId: 'attacker-workspace',
          capabilityVerified: true
        },
        'wp05-body-spoof'
      )
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('fails closed when a newer candidate supersedes the requested candidate', async () => {
    const { registry, definition } = await runtimeCapability();
    const firstLedger = await insertLedger(definition, 1);
    const first = await candidate(registry, firstLedger, 'wp05-candidate-stale-v1');
    const secondLedger = await insertLedger(definition, 2);
    const second = await candidate(registry, secondLedger, 'wp05-candidate-stale-v2');
    expect(second.candidate.version).toBe(2);
    await expect(
      dispositions().disposition(
        principal(),
        first.candidate.reflectionCandidateId,
        {
          candidateVersion: first.candidate.version,
          expectedCandidateFingerprintSha256: first.candidateFingerprintSha256,
          outcome: 'ACCEPTED'
        },
        'wp05-stale-disposition'
      )
    ).rejects.toMatchObject({ code: 'STALE_CANDIDATE' });
  });

  it('serializes conflicting concurrent dispositions so only one can become authoritative', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const generated = await candidate(registry, ledger, 'wp05-candidate-concurrent');
    const service = dispositions();
    const results = await Promise.allSettled([
      service.disposition(
        principal(),
        generated.candidate.reflectionCandidateId,
        {
          candidateVersion: generated.candidate.version,
          expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
          outcome: 'ACCEPTED'
        },
        'wp05-concurrent-accepted'
      ),
      service.disposition(
        principal(),
        generated.candidate.reflectionCandidateId,
        {
          candidateVersion: generated.candidate.version,
          expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
          outcome: 'REJECTED'
        },
        'wp05-concurrent-rejected'
      )
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    if (rejected?.status === 'rejected')
      expect(rejected.reason).toMatchObject({ code: 'CANDIDATE_ALREADY_DISPOSITIONED' });
    expect(
      (
        await database
          .getPool()
          .query('SELECT count(*)::int count FROM capability_reflection_dispositions')
      ).rows[0]
    ).toMatchObject({ count: 1 });
  });

  it('keeps rejected and deferred histories without converting them into accepted or verified state', async () => {
    const { registry, definition } = await runtimeCapability();
    const firstLedger = await insertLedger(definition, 1);
    const first = await candidate(registry, firstLedger, 'wp05-candidate-rejected');
    const rejected = await dispositions().disposition(
      principal(),
      first.candidate.reflectionCandidateId,
      {
        candidateVersion: first.candidate.version,
        expectedCandidateFingerprintSha256: first.candidateFingerprintSha256,
        outcome: 'REJECTED'
      },
      'wp05-rejected'
    );
    expect(rejected.profile.acceptedReflections).toEqual([]);
    expect(rejected.profile.outstandingReflectionCandidate).toBeUndefined();

    const secondLedger = await insertLedger(definition, 2);
    const second = await candidate(registry, secondLedger, 'wp05-candidate-deferred');
    const deferred = await dispositions().disposition(
      principal(),
      second.candidate.reflectionCandidateId,
      {
        candidateVersion: second.candidate.version,
        expectedCandidateFingerprintSha256: second.candidateFingerprintSha256,
        outcome: 'DEFERRED'
      },
      'wp05-deferred'
    );
    expect(deferred.profile.acceptedReflections).toEqual([]);
    expect(deferred.profile.outstandingReflectionCandidate).toEqual({
      id: second.candidate.reflectionCandidateId,
      version: second.candidate.version
    });
    expect(deferred.profile.verifiedBadge).toBe(false);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM capability_ledger_entries) ledger_entries,
         (SELECT count(*)::int FROM capability_reflection_candidates) candidates,
         (SELECT count(*)::int FROM capability_reflection_dispositions) dispositions`
    );
    expect(counts.rows[0]).toMatchObject({ ledger_entries: 2, candidates: 2, dispositions: 2 });
  });

  it('rebuilds the same deterministic current Profile/Twin after database restart', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const generated = await candidate(registry, ledger, 'wp05-candidate-restart');
    const initial = await dispositions().disposition(
      principal(),
      generated.candidate.reflectionCandidateId,
      {
        candidateVersion: generated.candidate.version,
        expectedCandidateFingerprintSha256: generated.candidateFingerprintSha256,
        outcome: 'ACCEPTED'
      },
      'wp05-disposition-restart'
    );
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const reopened = dispositions();
    const profile = await reopened.getProfile(
      principal(),
      definition.runtimeCapabilityDefinitionId,
      definition.version
    );
    const twin = await reopened.getTwin(principal());
    expect(profile).toEqual(initial.profile);
    expect(twin).toEqual(initial.twin);
  });
});
