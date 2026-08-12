import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  capabilityLearningNoAuthorityConsequences,
  type CapabilityLedgerEntry,
  type CapabilityObservation,
  type RuntimeCapabilityDefinition
} from '@markorbit/contracts';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  PostgresPrivateReflectionCandidateService,
  privateReflectionGenerationPolicyVersion
} from '../src/private-reflection-candidate.js';
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
    DB_MIGRATION_NAMESPACE: 'capability_engine_reflection_candidates_test',
    DB_APPLICATION_NAME: 'markorbit-m6-wp-04-tests'
  });

const workspaceId = '11111111-1111-4111-8111-111111111111';
const subjectUserId = 'user_private_reflection_subject';
let database: ManagedDatabase;

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
    idempotencyKey: 'wp04-runtime-capability'
  });
  return { registry, definition: imported.definition };
}

function hexId(index: number): string {
  return index.toString(16).padStart(32, '0');
}

async function insertLedger(
  definition: RuntimeCapabilityDefinition,
  index: number,
  subject = subjectUserId
): Promise<CapabilityLedgerEntry> {
  const capabilityObservationId = `capability-observation_${hexId(index)}` as const;
  const capabilityLedgerEntryId = `capability-ledger_${hexId(index)}` as const;
  const sourceFingerprintSha256 = index.toString(16).padStart(64, '0');
  const recordedAt = `2026-08-12T00:${String(index).padStart(2, '0')}:00.000Z`;
  const observation: CapabilityObservation = {
    schemaVersion: 1,
    capabilityObservationId,
    workspaceId,
    subjectUserId: subject,
    runtimeCapability: {
      id: definition.runtimeCapabilityDefinitionId,
      version: definition.version
    },
    source: {
      owner: 'EXECUTION',
      kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
      sourceId: `evidence-review-decision_reflection-${index}`,
      sourceVersion: 1,
      sourceFingerprintSha256,
      observedAt: recordedAt,
      workspaceId,
      subjectUserId: subject,
      correlationId: `correlation_reflection-${index}`
    },
    subjectAttributionAuthority: 'OWNER_SOURCE',
    observationNature: 'PRIVATE_GOVERNED_WORK_OBSERVATION',
    admittedAt: recordedAt,
    authority: capabilityLearningNoAuthorityConsequences
  };
  const ledger: CapabilityLedgerEntry = {
    schemaVersion: 1,
    capabilityLedgerEntryId,
    workspaceId,
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
      workspaceId,
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
      workspaceId,
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

function service(registry: PostgresRuntimeCapabilityRegistry) {
  return new PostgresPrivateReflectionCandidateService(
    database,
    database.getPool(),
    registry,
    () => '2026-08-12T01:00:00.000Z'
  );
}

integration('M6-WP-04 PostgreSQL private Reflection Candidates', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
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
      'capability_engine_reflection_candidates_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('generates an explainable private candidate from the exact current Ledger snapshot', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const result = await service(registry).generate(
      { ledgerEntryId: ledger.capabilityLedgerEntryId },
      'reflection-1'
    );
    expect(result.replayed).toBe(false);
    expect(result.candidate).toMatchObject({
      workspaceId,
      subjectUserId,
      version: 1,
      runtimeCapability: {
        id: definition.runtimeCapabilityDefinitionId,
        version: definition.version
      },
      generation: { policyVersion: privateReflectionGenerationPolicyVersion },
      status: 'PENDING',
      private: true,
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
    expect(result.candidate.ledgerEntries).toEqual([
      {
        id: ledger.capabilityLedgerEntryId,
        sourceFingerprintSha256: ledger.observation.sourceFingerprintSha256
      }
    ]);
    expect(result.candidate.explanation).toContain('private reflection draft only');
    expect(result.candidate.proposedPrivateReflection).toContain('does not represent verification');
    expect(result.candidateFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reuses one immutable candidate for the same exact Ledger snapshot across idempotency keys', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const reflections = service(registry);
    const first = await reflections.generate(
      { ledgerEntryId: ledger.capabilityLedgerEntryId },
      'reflection-a'
    );
    const exactReplay = await reflections.generate(
      { ledgerEntryId: ledger.capabilityLedgerEntryId },
      'reflection-a'
    );
    const newKey = await reflections.generate(
      { ledgerEntryId: ledger.capabilityLedgerEntryId },
      'reflection-b'
    );
    expect(exactReplay.replayed).toBe(true);
    expect(newKey.replayed).toBe(true);
    expect(exactReplay.candidate).toEqual(first.candidate);
    expect(newKey.candidate).toEqual(first.candidate);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM capability_reflection_candidates) candidates,
         (SELECT count(*)::int FROM capability_reflection_generation_commands) commands,
         (SELECT count(*)::int FROM capability_reflection_generation_audit) audits`
    );
    expect(counts.rows[0]).toMatchObject({ candidates: 1, commands: 2, audits: 2 });
  });

  it('appends a new candidate version when newer governed Ledger evidence exists and never overwrites history', async () => {
    const { registry, definition } = await runtimeCapability();
    const firstLedger = await insertLedger(definition, 1);
    const reflections = service(registry);
    const first = await reflections.generate(
      { ledgerEntryId: firstLedger.capabilityLedgerEntryId },
      'reflection-v1'
    );
    const secondLedger = await insertLedger(definition, 2);
    const second = await reflections.generate(
      { ledgerEntryId: secondLedger.capabilityLedgerEntryId },
      'reflection-v2'
    );
    expect(second.replayed).toBe(false);
    expect(second.candidate.version).toBe(2);
    expect(second.candidate.reflectionCandidateId).not.toBe(first.candidate.reflectionCandidateId);
    expect(second.candidate.ledgerEntries.map((entry) => entry.id)).toEqual([
      firstLedger.capabilityLedgerEntryId,
      secondLedger.capabilityLedgerEntryId
    ]);
    const old = await reflections.findVersion(
      first.candidate.reflectionCandidateId,
      first.candidate.version
    );
    expect(old?.candidate).toEqual(first.candidate);

    const regenerateFromOldAnchor = await reflections.generate(
      { ledgerEntryId: firstLedger.capabilityLedgerEntryId },
      'reflection-current-from-old-anchor'
    );
    expect(regenerateFromOldAnchor.replayed).toBe(true);
    expect(regenerateFromOldAnchor.candidate).toEqual(second.candidate);
  });

  it('derives Workspace and subject identity only from owner Ledger state and rejects spoof fields', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    await expect(
      service(registry).generate(
        {
          ledgerEntryId: ledger.capabilityLedgerEntryId,
          workspaceId: 'attacker-workspace',
          subjectUserId: 'attacker-user',
          capabilityVerified: true
        },
        'reflection-spoof'
      )
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(
      (await database.getPool().query('SELECT count(*)::int count FROM capability_reflection_candidates'))
        .rows[0]
    ).toMatchObject({ count: 0 });
  });

  it('fails closed on idempotency drift without generating a second candidate', async () => {
    const { registry, definition } = await runtimeCapability();
    const firstLedger = await insertLedger(definition, 1);
    const secondLedger = await insertLedger(definition, 2);
    const reflections = service(registry);
    await reflections.generate(
      { ledgerEntryId: firstLedger.capabilityLedgerEntryId },
      'reflection-same-key'
    );
    await expect(
      reflections.generate(
        { ledgerEntryId: secondLedger.capabilityLedgerEntryId },
        'reflection-same-key'
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('serializes concurrent generation into one business candidate for one exact snapshot', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const reflections = service(registry);
    const results = await Promise.all([
      reflections.generate({ ledgerEntryId: ledger.capabilityLedgerEntryId }, 'concurrent-a'),
      reflections.generate({ ledgerEntryId: ledger.capabilityLedgerEntryId }, 'concurrent-b')
    ]);
    expect(new Set(results.map((result) => result.candidate.reflectionCandidateId)).size).toBe(1);
    expect(
      (await database.getPool().query('SELECT count(*)::int count FROM capability_reflection_candidates'))
        .rows[0]
    ).toMatchObject({ count: 1 });
  });

  it('survives database reopen with exact candidate and idempotency replay intact', async () => {
    const { registry, definition } = await runtimeCapability();
    const ledger = await insertLedger(definition, 1);
    const first = await service(registry).generate(
      { ledgerEntryId: ledger.capabilityLedgerEntryId },
      'reflection-restart'
    );
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const reopenedRegistry = new PostgresRuntimeCapabilityRegistry(database, database.getPool());
    const reopened = service(reopenedRegistry);
    const replay = await reopened.generate(
      { ledgerEntryId: ledger.capabilityLedgerEntryId },
      'reflection-restart'
    );
    expect(replay.replayed).toBe(true);
    expect(replay.candidate).toEqual(first.candidate);
    expect(replay.candidateFingerprintSha256).toBe(first.candidateFingerprintSha256);
  });

  it('keeps subject-specific private reflection histories isolated', async () => {
    const { registry, definition } = await runtimeCapability();
    const first = await insertLedger(definition, 1, subjectUserId);
    const second = await insertLedger(definition, 2, 'user_other_private_subject');
    const reflections = service(registry);
    const firstCandidate = await reflections.generate(
      { ledgerEntryId: first.capabilityLedgerEntryId },
      'subject-a'
    );
    const secondCandidate = await reflections.generate(
      { ledgerEntryId: second.capabilityLedgerEntryId },
      'subject-b'
    );
    expect(firstCandidate.candidate.ledgerEntries).toHaveLength(1);
    expect(secondCandidate.candidate.ledgerEntries).toHaveLength(1);
    expect(firstCandidate.candidate.subjectUserId).toBe(subjectUserId);
    expect(secondCandidate.candidate.subjectUserId).toBe('user_other_private_subject');
  });
});
