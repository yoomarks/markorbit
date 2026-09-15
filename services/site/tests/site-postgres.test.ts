import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import type { SiteHostBindingV1, SiteInstallationV1 } from '@markorbit/contracts/site';
import { PostgresSiteRepositoryV1 } from '../src/site-postgres.js';

const url = process.env.SITE_TEST_DATABASE_URL;
const required = process.env.SITE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('SITE_POSTGRES_TEST_REQUIRED=1 requires SITE_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
let database: ManagedDatabase;

integration('PostgreSQL Workspace Site persistence', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'site_test',
        DB_APPLICATION_NAME: 'markorbit-site-tests'
      })
    );
    await database.start();
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/site-service'
    );
    await migrate(database.getPool(), 'site_test', migrations);
    await database
      .getPool()
      .query(
        'TRUNCATE site_commands,site_host_binding_heads,site_host_binding_versions,site_installation_heads,site_installation_versions,site_configuration_versions'
      );
  });
  afterAll(async () => database.close());

  it('persists immutable Site versions and exact idempotent replay across restart', async () => {
    const repository = new PostgresSiteRepositoryV1(database);
    const installation: SiteInstallationV1 = {
      schemaVersion: 1,
      siteId: 'site_pg',
      workspaceId: 'workspace_pg',
      coreSiteInstallationRef: { installationId: 'install_pg', version: 1 },
      version: 1,
      kind: 'WORKSPACE_BRANDED',
      lifecycle: 'DRAFT',
      currentConfigurationVersion: 1,
      effectiveAt: '2026-09-15T00:00:00.000Z',
      recordedAt: '2026-09-15T00:00:00.000Z',
      sourceRef: 'test:postgres'
    };
    const mutation = {
      workspaceId: 'workspace_pg',
      idempotencyKey: 'create-pg',
      requestFingerprint: 'a'.repeat(64),
      response: installation,
      expectedSiteVersion: 0,
      installation
    };
    expect(await repository.commitMutation(mutation)).toEqual(installation);
    const restarted = new PostgresSiteRepositoryV1(database);
    expect(await restarted.commitMutation(mutation)).toEqual(installation);
    expect(
      await restarted.replayCommand(
        mutation.workspaceId,
        mutation.idempotencyKey,
        mutation.requestFingerprint
      )
    ).toEqual(installation);
    expect(await restarted.getCurrentInstallation('site_pg')).toEqual(installation);
    await expect(
      restarted.commitMutation({ ...mutation, requestFingerprint: 'b'.repeat(64) })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSE' });
    await expect(
      database.getPool().query("UPDATE site_installation_versions SET lifecycle='ACTIVE'")
    ).rejects.toBeDefined();
  });

  it('reloads current host bindings by exact Site after restart', async () => {
    const repository = new PostgresSiteRepositoryV1(database);
    const binding: SiteHostBindingV1 = {
      schemaVersion: 1,
      bindingId: 'site_host_manager_read',
      siteId: 'site_manager_read',
      workspaceId: 'workspace_manager_read',
      normalizedHostname: 'manager-read.example.com',
      bindingType: 'TEST',
      version: 1,
      status: 'PENDING_VERIFICATION',
      verificationMethod: 'PLATFORM_MANAGED',
      recordedAt: '2026-09-15T00:00:00.000Z'
    };
    await repository.commitMutation({
      workspaceId: binding.workspaceId,
      idempotencyKey: 'binding-manager-read',
      requestFingerprint: 'e'.repeat(64),
      response: binding,
      expectedBindingVersion: 0,
      binding
    });
    const restarted = new PostgresSiteRepositoryV1(database);
    expect(await restarted.listCurrentBindings(binding.siteId)).toEqual([binding]);
    expect(await restarted.listCurrentBindings('site_other')).toEqual([]);
  });

  it('enforces one active Site owner for an exact hostname', async () => {
    const repository = new PostgresSiteRepositoryV1(database);
    const binding = (suffix: string): SiteHostBindingV1 => ({
      schemaVersion: 1,
      bindingId: `site_host_${suffix}`,
      siteId: `site_${suffix}`,
      workspaceId: `workspace_${suffix}`,
      normalizedHostname: 'shared.example.com',
      bindingType: 'PRIMARY',
      version: 1,
      status: 'ACTIVE',
      verificationMethod: 'DNS_TXT',
      verificationEvidenceRef: `dns:${suffix}`,
      verifiedAt: '2026-09-15T00:00:00.000Z',
      effectiveFrom: '2026-09-15T00:00:00.000Z',
      recordedAt: '2026-09-15T00:00:00.000Z'
    });
    await repository.commitMutation({
      workspaceId: 'workspace_host_a',
      idempotencyKey: 'host-a',
      requestFingerprint: 'c'.repeat(64),
      response: binding('a'),
      expectedBindingVersion: 0,
      binding: binding('a')
    });
    await expect(
      repository.commitMutation({
        workspaceId: 'workspace_host_b',
        idempotencyKey: 'host-b',
        requestFingerprint: 'd'.repeat(64),
        response: binding('b'),
        expectedBindingVersion: 0,
        binding: binding('b')
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
