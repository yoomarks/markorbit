import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  CapabilityObservationLedgerError,
  PostgresCapabilityObservationLedger
} from '../src/capability-observation-ledger.js';
import {
  CapabilityObservationSourceError,
  type CapabilityObservationSourceAuthority,
  type CapabilityObservationSourceLocator,
  type GovernedCapabilityObservationSourceAssertion
} from '../src/capability-observation-source.js';
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
    DB_MIGRATION_NAMESPACE: 'capability_engine_observation_ledger_test',
    DB_APPLICATION_NAME: 'markorbit-m6-wp-03-tests'
  });

const workspaceId = '11111111-1111-4111-8111-111111111111';
const subjectUserId = 'user_capability_subject';
const sourceId = 'evidence-review-decision_governed-001';
const sourceFingerprint = 'c'.repeat(64);
const correlationId = 'correlation_governed-review-001';

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

class FakeSourceAuthority implements CapabilityObservationSourceAuthority {
  mode: 'OK' | 'VERSION' | 'FINGERPRINT' | 'OUTAGE' = 'OK';
  calls = 0;

  async verify(
    locator: Readonly<CapabilityObservationSourceLocator>
  ): Promise<GovernedCapabilityObservationSourceAssertion> {
    await Promise.resolve();
    this.calls += 1;
    if (this.mode === 'OUTAGE')
      throw new CapabilityObservationSourceError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution is unavailable.',
        503,
        true
      );
    if (this.mode === 'VERSION')
      throw new CapabilityObservationSourceError(
        'SOURCE_VERSION_MISMATCH',
        'Execution source version changed.',
        409
      );
    if (this.mode === 'FINGERPRINT')
      throw new CapabilityObservationSourceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Execution source fingerprint changed.',
        409
      );
    return {
      source: {
        owner: 'EXECUTION',
        kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceId: locator.sourceId,
        sourceVersion: locator.sourceVersion,
        sourceFingerprintSha256: locator.sourceFingerprintSha256,
        observedAt: '2026-08-12T00:00:00.000Z',
        workspaceId,
        subjectUserId,
        correlationId
      },
      subjectAttributionAuthority: 'OWNER_SOURCE'
    };
  }
}

async function runtimeCapability() {
  const registry = new PostgresRuntimeCapabilityRegistry(database, database.getPool());
  const imported = await registry.importAccepted({
    definition: accepted(),
    idempotencyKey: 'wp03-runtime-capability'
  });
  return { registry, definition: imported.definition };
}

function command(runtime: { runtimeCapabilityDefinitionId: string; version: number }) {
  return {
    runtimeCapability: {
      id: runtime.runtimeCapabilityDefinitionId,
      version: runtime.version
    },
    source: {
      owner: 'EXECUTION',
      kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
      sourceId,
      sourceVersion: 1,
      sourceFingerprintSha256: sourceFingerprint
    }
  };
}

async function reset() {
  await database.getPool().query(
    `TRUNCATE
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

integration('M6-WP-03 PostgreSQL Capability Observation Ledger', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
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
      'capability_engine_observation_ledger_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('admits one exact reviewed owner source into one private append-only Ledger Entry', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    const result = await ledger.admit(command(definition), 'observe-1');
    expect(result.replayed).toBe(false);
    expect(result.observation).toMatchObject({
      workspaceId,
      subjectUserId,
      runtimeCapability: {
        id: definition.runtimeCapabilityDefinitionId,
        version: definition.version
      },
      subjectAttributionAuthority: 'OWNER_SOURCE',
      observationNature: 'PRIVATE_GOVERNED_WORK_OBSERVATION',
      authority: {
        canonicalTruth: false,
        capabilityVerified: false,
        publicProfilePublished: false,
        permissionChanged: false,
        externalActionExecuted: false
      }
    });
    expect(result.ledgerEntry).toMatchObject({
      workspaceId,
      subjectUserId,
      appendOnly: true,
      private: true,
      authority: { capabilityVerified: false, canonicalTruth: false }
    });
    expect(await ledger.listLedgerForSubject(workspaceId, subjectUserId)).toEqual([
      result.ledgerEntry
    ]);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM capability_observations) observations,
         (SELECT count(*)::int FROM capability_ledger_entries) ledger_entries,
         (SELECT count(*)::int FROM capability_observation_admission_audit WHERE decision='ACCEPTED') accepted_audits`
    );
    expect(counts.rows[0]).toMatchObject({
      observations: 1,
      ledger_entries: 1,
      accepted_audits: 1
    });
  });

  it('derives Workspace and subject from owner truth and rejects caller identity spoof fields', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    await expect(
      ledger.admit(
        {
          ...command(definition),
          workspaceId: 'attacker-workspace',
          subjectUserId: 'attacker-user',
          reviewerId: 'attacker-reviewer',
          providerId: 'provider-spoof'
        },
        'spoof-1'
      )
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(authority.calls).toBe(0);
    expect(
      (await database.getPool().query('SELECT count(*)::int count FROM capability_observations'))
        .rows[0]
    ).toMatchObject({ count: 0 });
  });

  it('rejects raw Provider Return and Provider Supply Capability source families before owner lookup', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    for (const source of [
      { owner: 'MGSN', kind: 'PROVIDER_RETURN' },
      { owner: 'MGSN', kind: 'PROVIDER_SUPPLY_CAPABILITY' }
    ]) {
      await expect(
        ledger.admit(
          {
            runtimeCapability: {
              id: definition.runtimeCapabilityDefinitionId,
              version: definition.version
            },
            source: {
              ...source,
              sourceId: 'raw-provider-evidence',
              sourceVersion: 1,
              sourceFingerprintSha256: 'd'.repeat(64)
            }
          },
          `deny-${source.kind}`
        )
      ).rejects.toMatchObject({ code: 'SOURCE_NOT_ALLOWED' });
    }
    expect(authority.calls).toBe(0);
  });

  it('records denied audit evidence for stale owner version/fingerprint and dependency outage', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    for (const [mode, key, code] of [
      ['VERSION', 'stale-version', 'SOURCE_VERSION_MISMATCH'],
      ['FINGERPRINT', 'stale-fingerprint', 'SOURCE_FINGERPRINT_MISMATCH'],
      ['OUTAGE', 'owner-outage', 'DEPENDENCY_UNAVAILABLE']
    ] as const) {
      authority.mode = mode;
      await expect(ledger.admit(command(definition), key)).rejects.toMatchObject({ code });
    }
    const denied = await database
      .getPool()
      .query<{ denial_code: string }>(
        "SELECT denial_code FROM capability_observation_admission_audit WHERE decision='DENIED' ORDER BY audit_id"
      );
    expect(denied.rows.map((row) => row.denial_code)).toEqual([
      'SOURCE_VERSION_MISMATCH',
      'SOURCE_FINGERPRINT_MISMATCH',
      'DEPENDENCY_UNAVAILABLE'
    ]);
  });

  it('replays the exact command without recontacting Execution and a new key cannot duplicate business state', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    const first = await ledger.admit(command(definition), 'observe-1');
    authority.mode = 'OUTAGE';
    const replay = await ledger.admit(command(definition), 'observe-1');
    expect(replay.replayed).toBe(true);
    expect(replay.observation).toEqual(first.observation);
    expect(authority.calls).toBe(1);

    authority.mode = 'OK';
    const newKey = await ledger.admit(command(definition), 'observe-2');
    expect(newKey.replayed).toBe(true);
    expect(newKey.observation).toEqual(first.observation);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM capability_observations) observations,
         (SELECT count(*)::int FROM capability_ledger_entries) ledger_entries,
         (SELECT count(*)::int FROM capability_observation_admission_commands) commands`
    );
    expect(counts.rows[0]).toMatchObject({ observations: 1, ledger_entries: 1, commands: 2 });
  });

  it('fails closed on idempotency drift before consulting source authority', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    await ledger.admit(command(definition), 'same-key');
    const calls = authority.calls;
    await expect(
      ledger.admit(
        {
          ...command(definition),
          source: {
            ...command(definition).source,
            sourceId: 'evidence-review-decision_other'
          }
        },
        'same-key'
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(authority.calls).toBe(calls);
  });

  it('survives database reopen with exact Observation and Ledger replay intact', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    const first = await ledger.admit(command(definition), 'restart-1');
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const reopenedRegistry = new PostgresRuntimeCapabilityRegistry(database, database.getPool());
    const reopenedLedger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      reopenedRegistry,
      authority
    );
    authority.mode = 'OUTAGE';
    const replay = await reopenedLedger.admit(command(definition), 'restart-1');
    expect(replay.replayed).toBe(true);
    expect(replay.observation).toEqual(first.observation);
    expect(await reopenedLedger.findObservation(first.observation.capabilityObservationId)).toEqual(
      first.observation
    );
  });

  it('serializes concurrent duplicate-source admissions into one Observation and one Ledger Entry', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    const results = await Promise.all([
      ledger.admit(command(definition), 'concurrent-a'),
      ledger.admit(command(definition), 'concurrent-b')
    ]);
    expect(new Set(results.map((value) => value.observation.capabilityObservationId)).size).toBe(1);
    expect(new Set(results.map((value) => value.ledgerEntry.capabilityLedgerEntryId)).size).toBe(1);
    const counts = await database.getPool().query(
      `SELECT
         (SELECT count(*)::int FROM capability_observations) observations,
         (SELECT count(*)::int FROM capability_ledger_entries) ledger_entries`
    );
    expect(counts.rows[0]).toMatchObject({ observations: 1, ledger_entries: 1 });
  });

  it('fails closed when the exact Runtime Capability version does not exist', async () => {
    const { registry, definition } = await runtimeCapability();
    const authority = new FakeSourceAuthority();
    const ledger = new PostgresCapabilityObservationLedger(
      database,
      database.getPool(),
      registry,
      authority
    );
    await expect(
      ledger.admit(
        {
          ...command(definition),
          runtimeCapability: {
            id: definition.runtimeCapabilityDefinitionId,
            version: definition.version + 1
          }
        },
        'missing-runtime-version'
      )
    ).rejects.toBeInstanceOf(CapabilityObservationLedgerError);
    expect(authority.calls).toBe(0);
    expect(
      (
        await database
          .getPool()
          .query<{ denial_code: string }>(
            "SELECT denial_code FROM capability_observation_admission_audit WHERE idempotency_key='missing-runtime-version'"
          )
      ).rows[0]
    ).toMatchObject({ denial_code: 'RUNTIME_CAPABILITY_NOT_FOUND' });
  });
});
