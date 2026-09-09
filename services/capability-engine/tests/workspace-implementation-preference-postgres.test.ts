import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRequestV2,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresImplementationProfileRegistryV1 } from '../src/implementation-profile-registry-postgres.js';
import {
  PostgresWorkspaceAwareImplementationProfileSelectorV1,
  PostgresWorkspaceImplementationPreferenceStoreV1
} from '../src/workspace-implementation-preference-postgres.js';
import {
  governedWorkspaceImplementationPreferenceV1,
  type WorkspaceImplementationPreferenceV1
} from '../src/workspace-implementation-preference.js';

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
    DB_MIGRATION_NAMESPACE: 'capability_engine_implementation_profile_registry_test',
    DB_APPLICATION_NAME: 'markorbit-workspace-implementation-preference-tests'
  });

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai',
  version: 4,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  title: 'Managed AI Execution',
  description: 'Governed provider-neutral AI execution.',
  lineage: { capabilityId: 'managed-ai-execution' },
  canonReference: {
    canonId: 'capability-foundation',
    canonVersion: '2026-08-25',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-25T01:00:00.000Z'
};

const request: CapabilityRequestV2 = {
  schemaVersion: 2,
  capabilityRequestId: 'capreq_workspace_preference',
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  caller: {
    workspaceId: 'workspace_test',
    principalId: 'principal_test',
    callerProduct: 'KNOWLEDGE',
    permissionContextRef: 'permission_test'
  },
  purpose: 'Acquire one governed AI result.',
  input: { question: 'What changed?' },
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  riskClass: 'MODERATE',
  idempotencyKey: 'managed-ai-workspace-preference-1',
  correlationId: 'corr_workspace_preference',
  receivedAt: '2026-09-09T10:00:00.000Z'
};

function profile(overrides: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_deepseek',
    version: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    kind: 'AI_ASSISTED_SERVICE',
    status: 'APPROVED',
    implementationKey: 'ai:deepseek:managed-v1',
    inputSchemaId: 'managed-ai-input.v1',
    outputSchemaId: 'managed-ai-output.v1',
    allowedCallerProducts: ['KNOWLEDGE'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 45_000,
    maxAttempts: 1,
    approvalPolicyVersion: 'implementation-admission.v1',
    createdAt: '2026-08-25T01:00:00.000Z',
    ...overrides
  };
}

function preference(
  overrides: Partial<WorkspaceImplementationPreferenceV1> = {}
): WorkspaceImplementationPreferenceV1 {
  return {
    schemaVersion: 1,
    workspaceId: 'workspace_test',
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    version: 1,
    status: 'ACTIVE',
    preferredImplementationKeys: ['ai:workspace-approved:managed-v1'],
    authorityReference: 'workspace-policy-change_authorized-1',
    reason: 'Use the approved Workspace-local implementation.',
    createdAt: '2026-09-09T10:00:00.000Z',
    ...overrides
  };
}

let database: ManagedDatabase;

function profileRegistry() {
  return new PostgresImplementationProfileRegistryV1(database, database.getPool());
}

function preferenceStore() {
  return new PostgresWorkspaceImplementationPreferenceStoreV1(database, database.getPool());
}

async function reset() {
  await database
    .getPool()
    .query(
      'TRUNCATE capability_workspace_implementation_preferences, capability_implementation_profile_versions, capability_implementation_profile_identities CASCADE'
    );
}

integration('durable Workspace implementation preferences', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await migrate(
      database.getPool(),
      'capability_engine_implementation_profile_registry_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('survives restart with immutable exact-version and current-version reads', async () => {
    const first = preferenceStore();
    const v1 = preference();
    const v2 = preference({
      version: 2,
      preferredImplementationKeys: ['ai:workspace-second:managed-v1'],
      authorityReference: 'workspace-policy-change_authorized-2',
      reason: 'Advance to another approved Workspace-local implementation.',
      createdAt: '2026-09-09T11:00:00.000Z'
    });

    await expect(first.register(v1)).resolves.toEqual(v1);
    await expect(first.register(v2)).resolves.toEqual(v2);

    const restarted = preferenceStore();
    const context = {
      workspaceId: v1.workspaceId,
      capabilityId: v1.capabilityId,
      capabilityVersion: v1.capabilityVersion
    };
    await expect(restarted.findVersion(context, 1)).resolves.toEqual(v1);
    await expect(restarted.findCurrent(context)).resolves.toEqual(v2);
    await expect(first.register(v1)).resolves.toEqual(v1);
    await expect(
      first.register({ ...v1, reason: 'Conflicting rewrite of immutable version one.' })
    ).rejects.toMatchObject({ code: 'PREFERENCE_VERSION_CONFLICT' });
  });

  it('isolates preferences by exact Workspace and Capability version', async () => {
    const store = preferenceStore();
    await store.register(preference());

    await expect(
      store.resolve({
        workspaceId: 'workspace_other',
        capabilityId: 'managed-ai-execution',
        capabilityVersion: '1.0.0'
      })
    ).resolves.toBeUndefined();
    await expect(
      store.resolve({
        workspaceId: 'workspace_test',
        capabilityId: 'managed-ai-execution',
        capabilityVersion: '2.0.0'
      })
    ).resolves.toBeUndefined();
  });

  it('uses CLEARED as an append-only restoration of global fallback', async () => {
    const store = preferenceStore();
    await store.register(preference());
    await store.register(
      preference({
        version: 2,
        status: 'CLEARED',
        preferredImplementationKeys: [],
        authorityReference: 'workspace-policy-change_authorized-2',
        reason: 'Restore the governed MO-global preference.',
        createdAt: '2026-09-09T11:00:00.000Z'
      })
    );

    await expect(
      store.resolve({
        workspaceId: request.caller.workspaceId,
        capabilityId: request.capabilityId,
        capabilityVersion: request.capabilityVersion
      })
    ).resolves.toBeUndefined();
  });

  it('selects an approved Workspace-local implementation and preserves exact preference provenance', async () => {
    const profiles = profileRegistry();
    const preferences = preferenceStore();
    const workspaceProfile = profile({
      implementationProfileId: 'implementation-profile_workspace-approved',
      implementationKey: 'ai:workspace-approved:managed-v1',
      createdAt: '2026-08-25T01:00:01.000Z'
    });
    await profiles.register(profile());
    await profiles.register(workspaceProfile);
    const localPreference = preference();
    await preferences.register(localPreference);

    const selector = new PostgresWorkspaceAwareImplementationProfileSelectorV1(
      profiles,
      {
        policyVersion: 'selection.global.v1',
        admittedImplementationKinds: ['AI_ASSISTED_SERVICE'],
        preferredImplementationKeys: ['ai:deepseek:managed-v1']
      },
      preferences
    );

    await expect(selector.select(request, definition)).resolves.toEqual({
      profile: workspaceProfile,
      policyVersion: governedWorkspaceImplementationPreferenceV1(localPreference)?.policyVersion
    });
    await expect(
      selector.select(
        {
          ...request,
          capabilityRequestId: 'capreq_workspace_other',
          caller: { ...request.caller, workspaceId: 'workspace_other' }
        },
        definition
      )
    ).resolves.toMatchObject({
      profile: { implementationKey: 'ai:deepseek:managed-v1' },
      policyVersion: 'selection.global.v1'
    });
  });

  it('fails closed when an ACTIVE Workspace preference names no eligible approved implementation', async () => {
    const profiles = profileRegistry();
    const preferences = preferenceStore();
    await profiles.register(profile());
    await preferences.register(preference());
    const selector = new PostgresWorkspaceAwareImplementationProfileSelectorV1(
      profiles,
      {
        policyVersion: 'selection.global.v1',
        admittedImplementationKinds: ['AI_ASSISTED_SERVICE'],
        preferredImplementationKeys: ['ai:deepseek:managed-v1']
      },
      preferences
    );

    await expect(selector.select(request, definition)).resolves.toBeUndefined();
  });
});
