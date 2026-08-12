import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  verifyMigrations
} from '../packages/persistence/dist/index.js';

type OwnerName = 'core' | 'lite' | 'markreg' | 'execution' | 'mgsn' | 'capability-engine';

type MigrationPrerequisiteName = 'LOCAL_WORKSPACE_SCOPE_ANCHOR';

interface CandidateOwner {
  name: OwnerName;
  package: string;
  databaseEnv: string;
  migrationNamespace: string;
  serviceEntry: string;
  port: number;
  runtimeDependencies: readonly OwnerName[];
  migrationPrerequisites: readonly MigrationPrerequisiteName[];
}

interface CandidateManifest {
  schemaVersion: number;
  environmentClass: string;
  exactHeadRequired: boolean;
  productionTrafficAllowed: boolean;
  releaseAuthorized: boolean;
  secretsExcluded: boolean;
  databaseEngine: string;
  migrationModel: string;
  rollbackStrategy: string;
  migrationPrerequisiteDefinitions: Record<
    MigrationPrerequisiteName,
    {
      kind: 'STRUCTURAL_ONLY';
      businessRowsSeeded: boolean;
      description: string;
    }
  >;
  owners: readonly CandidateOwner[];
  startupPolicy: {
    databaseBeforeService: boolean;
    peerServicesRequiredForHealth: boolean;
    healthPath: string;
    failureMustNotReportListening: boolean;
  };
  recoveryPolicy: {
    reverseMigrationsProvided: boolean;
    stopServicesBeforeRestore: boolean;
    restorePerOwnerOnly: boolean;
    verifyPreForwardState: boolean;
    reapplyForwardMigrationsAfterRestore: boolean;
  };
}

interface CapturedProcess {
  child: ChildProcess;
  stdout(): string;
  stderr(): string;
  owner: CandidateOwner;
}

const required = process.env.M7_WP05_REHEARSAL_REQUIRED === '1';
const expectedHead = process.env.M7_WP05_EXPECTED_HEAD_SHA;
const manifestPath = path.resolve('infrastructure/rehearsal/m7-wp-05-beta-candidate.json');
const migrationDirectory = path.resolve('infrastructure/persistence/migrations');
const ownershipFile = path.resolve('infrastructure/persistence/migration-owners.json');
const artifactDirectory = path.resolve('.artifacts');
const snapshotDirectory = path.join(artifactDirectory, 'm7-wp-05-snapshots');
const evidencePath = path.join(artifactDirectory, 'm7-wp-05-deployment-rehearsal-evidence.json');
const internalSecret = 'm7-wp-05-rehearsal-internal-secret-32-bytes';
const processes: CapturedProcess[] = [];

const suite = required ? describe : describe.skip;

async function loadManifest(): Promise<{ manifest: CandidateManifest; bytes: Buffer }> {
  const bytes = await readFile(manifestPath);
  return { manifest: JSON.parse(bytes.toString('utf8')) as CandidateManifest, bytes };
}

function database(url: string, owner: CandidateOwner): ManagedDatabase {
  return new ManagedDatabase(
    parseDatabaseConfig({
      NODE_ENV: 'test',
      DATABASE_URL: url,
      DB_MIGRATION_NAMESPACE: owner.migrationNamespace,
      DB_APPLICATION_NAME: `m7-wp-05-${owner.name}`,
      DB_SSL_MODE: 'disable',
      DB_CONNECTION_TIMEOUT_MS: '1500',
      DB_STATEMENT_TIMEOUT_MS: '7000'
    })
  );
}

async function resetSchemas(url: string, owner: CandidateOwner): Promise<void> {
  const value = database(url, owner);
  await value.start();
  try {
    await value.getPool().query('DROP SCHEMA IF EXISTS public CASCADE');
    await value.getPool().query('CREATE SCHEMA public');
    await value.getPool().query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
  } finally {
    await value.close();
  }
}

async function prepareMigrationPrerequisites(url: string, owner: CandidateOwner): Promise<void> {
  if (!owner.migrationPrerequisites.includes('LOCAL_WORKSPACE_SCOPE_ANCHOR')) return;
  const value = database(url, owner);
  await value.start();
  try {
    await value.getPool().query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id uuid PRIMARY KEY,
        name text NOT NULL DEFAULT 'Rehearsal workspace scope',
        email text,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    const result = await value
      .getPool()
      .query<{ count: string }>('SELECT count(*)::text AS count FROM workspaces');
    expect(result.rows[0]?.count).toBe('0');
  } finally {
    await value.close();
  }
}

async function verifyMigrationPrerequisites(url: string, owner: CandidateOwner): Promise<void> {
  if (!owner.migrationPrerequisites.includes('LOCAL_WORKSPACE_SCOPE_ANCHOR')) return;
  const value = database(url, owner);
  await value.start();
  try {
    const definition = await value
      .getPool()
      .query<{ exists: boolean }>(`SELECT to_regclass('public.workspaces') IS NOT NULL AS exists`);
    expect(definition.rows[0]?.exists).toBe(true);
    const result = await value
      .getPool()
      .query<{ count: string }>('SELECT count(*)::text AS count FROM workspaces');
    expect(result.rows[0]?.count).toBe('0');
  } finally {
    await value.close();
  }
}

function runPostgresTool(command: 'pg_dump' | 'pg_restore', args: readonly string[]): void {
  const result = spawnSync(command, [...args], {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0)
    throw new Error(`${command} failed during the bounded rehearsal recovery procedure.`);
}

function dumpDatabase(url: string, output: string): void {
  runPostgresTool('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    output,
    url
  ]);
}

function restoreDatabase(url: string, input: string): void {
  runPostgresTool('pg_restore', [
    '--exit-on-error',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    url,
    input
  ]);
}

function ownerUrl(owner: CandidateOwner): string {
  const value = process.env[owner.databaseEnv];
  if (!value) throw new Error(`${owner.databaseEnv} is required for M7-WP-05 rehearsal.`);
  return value;
}

function peerUrl(manifest: CandidateManifest, name: OwnerName): string {
  const owner = manifest.owners.find((candidate) => candidate.name === name);
  if (!owner) throw new Error(`Candidate manifest is missing ${name}.`);
  return `http://127.0.0.1:${owner.port}`;
}

function serviceEnvironment(
  manifest: CandidateManifest,
  owner: CandidateOwner,
  databaseUrl = ownerUrl(owner)
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(owner.port),
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE: owner.migrationNamespace,
    DB_APPLICATION_NAME: `m7-wp-05-service-${owner.name}`,
    DB_SSL_MODE: 'disable',
    DB_CONNECTION_TIMEOUT_MS: '750',
    DB_STATEMENT_TIMEOUT_MS: '5000',
    MO_INTERNAL_SERVICE_SECRET: internalSecret,
    CORE_URL: peerUrl(manifest, 'core'),
    LITE_URL: peerUrl(manifest, 'lite'),
    MARKREG_URL: peerUrl(manifest, 'markreg'),
    EXECUTION_URL: peerUrl(manifest, 'execution'),
    LITE_DATABASE_URL: databaseUrl,
    MARKREG_DATABASE_URL: databaseUrl,
    EXECUTION_DATABASE_URL: databaseUrl,
    MGSN_DATABASE_URL: databaseUrl,
    CAPABILITY_ENGINE_DATABASE_URL: databaseUrl,
    LITE_MIGRATION_NAMESPACE: owner.migrationNamespace,
    MARKREG_MIGRATION_NAMESPACE: owner.migrationNamespace,
    EXECUTION_MIGRATION_NAMESPACE: owner.migrationNamespace,
    MGSN_MIGRATION_NAMESPACE: owner.migrationNamespace,
    CAPABILITY_ENGINE_MIGRATION_NAMESPACE: owner.migrationNamespace
  };
}

function spawnService(
  manifest: CandidateManifest,
  owner: CandidateOwner,
  databaseUrl?: string
): CapturedProcess {
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, [path.resolve(owner.serviceEntry)], {
    env: serviceEnvironment(manifest, owner, databaseUrl),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });
  const captured: CapturedProcess = {
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    owner
  };
  processes.push(captured);
  return captured;
}

async function waitForExit(value: CapturedProcess, timeoutMs = 6000): Promise<number | null> {
  if (value.child.exitCode !== null) return value.child.exitCode;
  return await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${value.owner.name} did not exit within the rehearsal timeout.`)),
      timeoutMs
    );
    value.child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function waitForHealth(owner: CandidateOwner, healthPath: string): Promise<void> {
  const url = `http://127.0.0.1:${owner.port}${healthPath}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = (await response.json()) as { status?: string; service?: string };
        if (body.status === 'ok') return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `${owner.name} did not become healthy.${lastError instanceof Error ? ` ${lastError.message}` : ''}`
  );
}

async function stopService(value: CapturedProcess): Promise<void> {
  if (value.child.exitCode !== null) return;
  value.child.kill('SIGTERM');
  try {
    await waitForExit(value, 5000);
  } catch {
    value.child.kill('SIGKILL');
    await waitForExit(value, 3000).catch(() => undefined);
  }
}

async function stopAll(): Promise<void> {
  for (const value of [...processes].reverse()) await stopService(value);
  processes.length = 0;
}

async function startCandidateServices(
  manifest: CandidateManifest
): Promise<readonly CapturedProcess[]> {
  const started: CapturedProcess[] = [];
  for (const owner of manifest.owners) {
    const value = spawnService(manifest, owner);
    started.push(value);
    await waitForHealth(owner, manifest.startupPolicy.healthPath);
  }
  return started;
}

async function expectProbe(url: string, owner: CandidateOwner): Promise<void> {
  const value = database(url, owner);
  await value.start();
  try {
    const result = await value
      .getPool()
      .query<{ marker: string }>('SELECT marker FROM m7_wp05_recovery_probe WHERE id=$1', [
        owner.name
      ]);
    expect(result.rows[0]).toEqual({ marker: `pre-forward:${owner.name}` });
  } finally {
    await value.close();
  }
}

afterAll(async () => {
  await stopAll();
  await rm(snapshotDirectory, { recursive: true, force: true });
});

suite.sequential('M7-WP-05 deployment rehearsal', () => {
  it('validates the bounded non-production candidate manifest', async () => {
    const { manifest } = await loadManifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.environmentClass).toBe('NON_PRODUCTION_REHEARSAL');
    expect(manifest.exactHeadRequired).toBe(true);
    expect(manifest.productionTrafficAllowed).toBe(false);
    expect(manifest.releaseAuthorized).toBe(false);
    expect(manifest.secretsExcluded).toBe(true);
    expect(manifest.databaseEngine).toBe('postgresql-16');
    expect(manifest.migrationModel).toBe('FORWARD_ONLY_IMMUTABLE_CHECKSUMS');
    expect(manifest.recoveryPolicy.reverseMigrationsProvided).toBe(false);
    expect(manifest.startupPolicy.databaseBeforeService).toBe(true);
    expect(manifest.startupPolicy.peerServicesRequiredForHealth).toBe(false);
    expect(manifest.owners.map((owner) => owner.name)).toEqual([
      'core',
      'lite',
      'markreg',
      'execution',
      'mgsn',
      'capability-engine'
    ]);
    expect(new Set(manifest.owners.map((owner) => owner.port)).size).toBe(manifest.owners.length);
    expect(manifest.migrationPrerequisiteDefinitions.LOCAL_WORKSPACE_SCOPE_ANCHOR).toMatchObject({
      kind: 'STRUCTURAL_ONLY',
      businessRowsSeeded: false
    });
    expect(manifest.owners.find((owner) => owner.name === 'lite')?.migrationPrerequisites).toEqual([
      'LOCAL_WORKSPACE_SCOPE_ANCHOR'
    ]);
    expect(
      manifest.owners
        .filter((owner) => owner.name !== 'lite')
        .every((owner) => owner.migrationPrerequisites.length === 0)
    ).toBe(true);
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(serialized).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/u);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/u);
  });

  it('rehearses exact-head forward migration, startup, restart and owner snapshot recovery without release authority', async () => {
    if (!expectedHead) throw new Error('M7_WP05_EXPECTED_HEAD_SHA is required.');
    const exactHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(exactHead).toBe(expectedHead);

    const { manifest, bytes } = await loadManifest();
    const ownership = JSON.parse(await readFile(ownershipFile, 'utf8')) as {
      migrations: Record<string, string>;
    };
    const declaredOwnerPackages = new Set(manifest.owners.map((owner) => owner.package));
    expect(new Set(Object.values(ownership.migrations))).toEqual(declaredOwnerPackages);

    await mkdir(snapshotDirectory, { recursive: true });
    await mkdir(artifactDirectory, { recursive: true });

    const ownerEvidence: Array<{
      owner: OwnerName;
      migrationCount: number;
      latestMigration: string;
      migrationPrerequisites: readonly MigrationPrerequisiteName[];
      snapshotFile: string;
      preForwardLatestState: string;
      forwardLatestState: string;
      restoredLatestState: string;
      recoveredLatestState: string;
    }> = [];

    for (const owner of manifest.owners) {
      const url = ownerUrl(owner);
      await resetSchemas(url, owner);
      await prepareMigrationPrerequisites(url, owner);
      const migrations = await loadMigrationsForOwner(
        migrationDirectory,
        ownershipFile,
        owner.package
      );
      expect(migrations.length).toBeGreaterThan(0);
      const latest = migrations.at(-1)!;
      const prior = migrations.slice(0, -1);
      const preForward = database(url, owner);
      await preForward.start();
      try {
        await migrate(preForward.getPool(), owner.migrationNamespace, prior);
        await preForward
          .getPool()
          .query('CREATE TABLE m7_wp05_recovery_probe(id text PRIMARY KEY, marker text NOT NULL)');
        await preForward
          .getPool()
          .query('INSERT INTO m7_wp05_recovery_probe(id,marker) VALUES($1,$2)', [
            owner.name,
            `pre-forward:${owner.name}`
          ]);
        await verifyMigrations(preForward.getPool(), owner.migrationNamespace, migrations);
        const status = await migrationStatus(
          preForward.getPool(),
          owner.migrationNamespace,
          migrations
        );
        expect(status.at(-1)?.state).toBe('pending');
      } finally {
        await preForward.close();
      }
      await verifyMigrationPrerequisites(url, owner);

      const snapshotFile = path.join(snapshotDirectory, `${owner.name}.dump`);
      dumpDatabase(url, snapshotFile);

      const forward = database(url, owner);
      await forward.start();
      try {
        const status = await migrate(forward.getPool(), owner.migrationNamespace, migrations);
        await verifyMigrations(forward.getPool(), owner.migrationNamespace, migrations);
        expect(status.every((record) => record.state === 'applied')).toBe(true);
      } finally {
        await forward.close();
      }
      await verifyMigrationPrerequisites(url, owner);
      await expectProbe(url, owner);

      ownerEvidence.push({
        owner: owner.name,
        migrationCount: migrations.length,
        latestMigration: `${latest.version}_${latest.name}`,
        migrationPrerequisites: owner.migrationPrerequisites,
        snapshotFile: path.relative(process.cwd(), snapshotFile),
        preForwardLatestState: 'pending',
        forwardLatestState: 'applied',
        restoredLatestState: 'pending',
        recoveredLatestState: 'applied'
      });
    }

    const core = manifest.owners.find((owner) => owner.name === 'core')!;
    const unavailable = spawnService(
      manifest,
      core,
      'postgresql://rehearsal:rehearsal@127.0.0.1:1/unavailable'
    );
    const unavailableExit = await waitForExit(unavailable);
    expect(unavailableExit).not.toBe(0);
    expect(unavailable.stdout()).not.toContain('listening on');
    expect(unavailable.stderr()).not.toContain(internalSecret);
    processes.splice(processes.indexOf(unavailable), 1);

    await startCandidateServices(manifest);
    await stopAll();
    await startCandidateServices(manifest);
    for (const owner of manifest.owners) await expectProbe(ownerUrl(owner), owner);
    await stopAll();

    for (const owner of manifest.owners) {
      const url = ownerUrl(owner);
      await resetSchemas(url, owner);
      const snapshotFile = path.join(snapshotDirectory, `${owner.name}.dump`);
      restoreDatabase(url, snapshotFile);
      const migrations = await loadMigrationsForOwner(
        migrationDirectory,
        ownershipFile,
        owner.package
      );
      const restored = database(url, owner);
      await restored.start();
      try {
        await verifyMigrations(restored.getPool(), owner.migrationNamespace, migrations);
        const status = await migrationStatus(
          restored.getPool(),
          owner.migrationNamespace,
          migrations
        );
        expect(status.at(-1)?.state).toBe('pending');
      } finally {
        await restored.close();
      }
      await verifyMigrationPrerequisites(url, owner);
      await expectProbe(url, owner);

      const recovered = database(url, owner);
      await recovered.start();
      try {
        const status = await migrate(recovered.getPool(), owner.migrationNamespace, migrations);
        await verifyMigrations(recovered.getPool(), owner.migrationNamespace, migrations);
        expect(status.every((record) => record.state === 'applied')).toBe(true);
      } finally {
        await recovered.close();
      }
      await verifyMigrationPrerequisites(url, owner);
      await expectProbe(url, owner);
    }

    await startCandidateServices(manifest);
    await stopAll();

    const evidence = {
      schemaVersion: 1,
      exactHeadSha: exactHead,
      candidateManifestSha256: createHash('sha256').update(bytes).digest('hex'),
      environmentClass: manifest.environmentClass,
      databaseEngine: manifest.databaseEngine,
      migrationModel: manifest.migrationModel,
      rollbackStrategy: manifest.rollbackStrategy,
      ownerMigrationOrder: manifest.owners.map((owner) => owner.name),
      migrationPrerequisites: manifest.migrationPrerequisiteDefinitions,
      owners: ownerEvidence,
      startup: {
        unavailableOwnerDatabaseFailsClosed: true,
        peerServicesRequiredForHealth: false,
        candidateServicesHealthyBeforeRestart: true,
        candidateServicesHealthyAfterRestart: true,
        candidateServicesHealthyAfterRecovery: true
      },
      recovery: {
        ownerSnapshotsRestored: true,
        preForwardMigrationStateVerified: true,
        forwardMigrationsReapplied: true,
        durableProbePreserved: true,
        reverseMigrationsUsed: false
      },
      authority: {
        businessRowsSeeded: false,
        productionTrafficTouched: false,
        businessSuccessFabricated: false,
        filingSubmitted: false,
        officialTruthMutated: false,
        releaseAuthorized: false
      },
      generatedAt: new Date().toISOString()
    };
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    expect(evidence.authority.releaseAuthorized).toBe(false);
    expect(evidence.authority.businessRowsSeeded).toBe(false);
  }, 120_000);
});
