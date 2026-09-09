import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AiProviderRegistryV1,
  ManagedAiExecutorV1,
  ManagedAiImplementationRegistryV1,
  knowledgeDeepSeekImplementationProfileV1,
  type AiProviderAdapterV1,
  KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
  KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
  KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID
} from '@markorbit/ai';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  createGovernedProductionRuntimeV1,
  MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
  MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID
} from '../src/governed-runtime-bootstrap.js';
import { PostgresImplementationProfileRegistryV1 } from '../src/implementation-profile-registry-postgres.js';
import { PostgresManagedAiExecutionClaimStoreV1 } from '../src/managed-ai-execution-claim.js';
import { PostgresManagedAiExactOutputStoreV1 } from '../src/managed-ai-exact-output.js';
import { PostgresRuntimeCapabilityRegistry } from '../src/runtime-capability-registry.js';
import { PostgresWorkspaceImplementationPreferenceStoreV1 } from '../src/workspace-implementation-preference-postgres.js';
import { governedWorkspaceImplementationPreferenceV1 } from '../src/workspace-implementation-preference.js';

const url = process.env.CAPABILITY_ENGINE_GOVERNED_RUNTIME_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_GOVERNED_RUNTIME_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'CAPABILITY_ENGINE_GOVERNED_RUNTIME_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_GOVERNED_RUNTIME_TEST_DATABASE_URL.'
  );
}
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');

let database: ManagedDatabase;

function managedInput() {
  return {
    schemaVersion: 1 as const,
    processingClass: 'SOURCE_ACQUISITION' as const,
    dataClassification: 'PUBLIC' as const,
    taskInput: { question: 'What changed?' },
    requestedOutput: {
      schemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
      format: 'MARKDOWN' as const
    },
    requirements: {
      capabilities: ['text-generation'],
      exactProviderOutputRequired: false,
      provenanceRequired: true
    },
    promptPolicy: {
      policyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
      policyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION
    },
    evidence: {
      exactOutput: 'OPTIONAL' as const,
      providerRequestId: 'OPTIONAL' as const
    }
  };
}

function command(
  workspaceId = 'workspace_wp07',
  idempotencyKey = 'wp07-postgres-restart-1',
  correlationId = 'correlation_wp07_postgres'
) {
  return {
    schemaVersion: 2 as const,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId,
      principalId: 'principal_wp07',
      callerProduct: 'LITE',
      permissionContextRef: 'core-workspace-membership:membership_wp07'
    },
    purpose: 'Exercise the durable governed production runtime.',
    input: managedInput(),
    inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
    outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
    riskClass: 'MODERATE' as const,
    idempotencyKey,
    correlationId
  };
}

function profile(overrides: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_managed-ai-wp07',
    version: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    kind: 'AI_ASSISTED_SERVICE',
    status: 'APPROVED',
    implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
    inputSchemaId: MANAGED_AI_CAPABILITY_INPUT_SCHEMA_ID,
    outputSchemaId: MANAGED_AI_CAPABILITY_OUTPUT_SCHEMA_ID,
    allowedCallerProducts: ['LITE'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 45_000,
    maxAttempts: 1,
    approvalPolicyVersion: 'implementation-admission.v1',
    createdAt: '2026-08-25T01:00:00.000Z',
    ...overrides
  };
}

function outcome(): ManagedAiExecutionOutcomeV1 {
  return {
    schemaVersion: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    status: 'COMPLETED',
    deliveryState: 'PROVIDER_COMPLETED',
    retryDisposition: 'RETRY_FORBIDDEN',
    provenance: {
      implementationProfileId: 'managed-ai:knowledge-deepseek:v1',
      implementationProfileVersion: 1,
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
      provider: 'DEEPSEEK',
      model: 'deepseek-chat',
      promptPolicyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
      promptPolicyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION,
      outputSchemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
      inputSha256: 'c'.repeat(64),
      startedAt: '2026-08-25T01:01:00.000Z',
      completedAt: '2026-08-25T01:01:01.000Z'
    },
    structuredOutput: { answer: 'durable governed result' },
    authority: managedAiNoAuthorityConsequences
  };
}

const WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY =
  'ai:workspace-approved:chat-completions:v1' as const;
const workspaceManagedAiImplementationProfileV1 = Object.freeze({
  ...knowledgeDeepSeekImplementationProfileV1,
  profileId: 'managed-ai:workspace-approved:v1',
  implementationKey: WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY,
  provider: 'WORKSPACE_AI'
});

function providerAdapter(
  implementationKey: string,
  provider: string,
  model: string,
  execute: ReturnType<typeof vi.fn>
): AiProviderAdapterV1 {
  return {
    implementationKey,
    provider,
    execute: (request) => {
      execute(request);
      return Promise.resolve({
        kind: 'SUCCESS' as const,
        provider,
        model,
        deliveryState: 'PROVIDER_COMPLETED' as const,
        retryDisposition: 'RETRY_FORBIDDEN' as const,
        exactResponse: new TextEncoder().encode(
          JSON.stringify({ implementationKey, provider, model, executionId: request.executionId })
        ),
        providerRequestId: `${provider.toLowerCase()}-request-${request.executionId}`,
        structuredOutput: { implementationKey, provider, model }
      });
    }
  };
}

integration('MO-CAP-001 WP07 durable production runtime', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'capability_engine_governed_runtime_wp07_test',
        DB_APPLICATION_NAME: 'markorbit-governed-runtime-wp07-tests'
      })
    );
    await database.start();
    await migrate(
      database.getPool(),
      'capability_engine_governed_runtime_wp07_test',
      await capabilityMigrations()
    );
  });

  afterAll(async () => database.close());

  it('survives runtime reconstruction with durable definition/profile selection and no second provider dispatch', async () => {
    const pool = database.getPool();
    const definitions = new PostgresRuntimeCapabilityRegistry(database, pool);
    await definitions.importAccepted({
      idempotencyKey: 'wp07-definition-import',
      definition: {
        sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
        capabilityId: 'managed-ai-execution',
        capabilityVersion: '1.0.0',
        title: 'Managed AI Execution',
        description: 'Governed provider-neutral AI execution.',
        lineage: { capabilityId: 'managed-ai-execution' },
        canonReference: {
          canonId: 'capability-foundation',
          canonVersion: '2026-08-25',
          sourceFingerprintSha256: 'a'.repeat(64)
        }
      }
    });
    const profiles = new PostgresImplementationProfileRegistryV1(database, pool);
    await profiles.register(profile());

    const managedAiExecute = vi.fn(() => Promise.resolve(outcome()));
    const managedAiRuntime = {
      managedAiExecutor: { execute: managedAiExecute },
      managedAiClaimStore: new PostgresManagedAiExecutionClaimStoreV1(database, pool),
      managedAiExactOutputStore: new PostgresManagedAiExactOutputStoreV1(pool)
    };
    const firstRuntime = createGovernedProductionRuntimeV1({
      definitions,
      implementationProfiles: profiles,
      managedAiRuntime,
      internalServiceSecret: 's'.repeat(40)
    });
    if (!firstRuntime) throw new Error('Expected first governed production runtime.');

    const first = await firstRuntime.invoke(command());
    const exactReplay = await firstRuntime.invoke(command());
    expect(first.outcome.status).toBe('SUCCEEDED');
    expect(exactReplay.replayed).toBe(true);
    expect(exactReplay.receipt.sessionReceiptId).toBe(first.receipt.sessionReceiptId);
    expect(managedAiExecute).toHaveBeenCalledTimes(1);

    const restartedDefinitions = new PostgresRuntimeCapabilityRegistry(database, pool);
    const restartedProfiles = new PostgresImplementationProfileRegistryV1(database, pool);
    const restartedRuntime = createGovernedProductionRuntimeV1({
      definitions: restartedDefinitions,
      implementationProfiles: restartedProfiles,
      managedAiRuntime: {
        managedAiExecutor: { execute: managedAiExecute },
        managedAiClaimStore: new PostgresManagedAiExecutionClaimStoreV1(database, pool),
        managedAiExactOutputStore: new PostgresManagedAiExactOutputStoreV1(pool)
      },
      internalServiceSecret: 's'.repeat(40)
    });
    if (!restartedRuntime) throw new Error('Expected restarted governed production runtime.');

    const afterRestart = await restartedRuntime.invoke(command());
    expect(afterRestart.binding.runtimeCapability).toEqual(first.binding.runtimeCapability);
    expect(afterRestart.binding.implementation).toEqual(first.binding.implementation);
    expect(afterRestart.outcome.output).toEqual(first.outcome.output);
    expect(managedAiExecute).toHaveBeenCalledTimes(1);
  });

  it('routes the same Managed AI Capability to durable global and Workspace-local approved implementations across restart', async () => {
    const pool = database.getPool();
    const definitions = new PostgresRuntimeCapabilityRegistry(database, pool);
    await definitions.importAccepted({
      idempotencyKey: 'wp07-definition-import',
      definition: {
        sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
        capabilityId: 'managed-ai-execution',
        capabilityVersion: '1.0.0',
        title: 'Managed AI Execution',
        description: 'Governed provider-neutral AI execution.',
        lineage: { capabilityId: 'managed-ai-execution' },
        canonReference: {
          canonId: 'capability-foundation',
          canonVersion: '2026-08-25',
          sourceFingerprintSha256: 'a'.repeat(64)
        }
      }
    });

    const profiles = new PostgresImplementationProfileRegistryV1(database, pool);
    const defaultProfile = profile();
    const workspaceProfile = profile({
      implementationProfileId: 'implementation-profile_managed-ai-workspace-1074',
      implementationKey: WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY,
      createdAt: '2026-08-25T01:00:01.000Z'
    });
    await profiles.register(defaultProfile);
    await profiles.register(workspaceProfile);

    const preferences = new PostgresWorkspaceImplementationPreferenceStoreV1(database, pool);
    const localPreference = {
      schemaVersion: 1 as const,
      workspaceId: 'workspace_1074_b',
      capabilityId: 'managed-ai-execution',
      capabilityVersion: '1.0.0',
      version: 1,
      status: 'ACTIVE' as const,
      preferredImplementationKeys: [WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY],
      authorityReference: 'workspace-policy-change:1074-b-v1',
      reason: 'Use the approved Workspace-local Managed AI implementation.',
      createdAt: '2026-09-09T12:30:00.000Z'
    };
    await preferences.register(localPreference);

    const defaultProviderExecute = vi.fn();
    const workspaceProviderExecute = vi.fn();
    const managedAiExecutor = new ManagedAiExecutorV1(
      new ManagedAiImplementationRegistryV1([
        knowledgeDeepSeekImplementationProfileV1,
        workspaceManagedAiImplementationProfileV1
      ]),
      new AiProviderRegistryV1([
        providerAdapter(
          KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
          'DEEPSEEK',
          'deepseek-chat',
          defaultProviderExecute
        ),
        providerAdapter(
          WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY,
          'WORKSPACE_AI',
          'workspace-model-v1',
          workspaceProviderExecute
        )
      ])
    );
    const managedAiRuntime = () => ({
      managedAiExecutor,
      managedAiClaimStore: new PostgresManagedAiExecutionClaimStoreV1(database, pool),
      managedAiExactOutputStore: new PostgresManagedAiExactOutputStoreV1(pool)
    });

    const firstRuntime = createGovernedProductionRuntimeV1({
      definitions,
      implementationProfiles: profiles,
      workspaceImplementationPreferences: preferences,
      managedAiRuntime: managedAiRuntime(),
      internalServiceSecret: 's'.repeat(40)
    });
    if (!firstRuntime) throw new Error('Expected first Workspace-aware governed runtime.');

    const workspaceACommand = command(
      'workspace_1074_a',
      'wp07-workspace-1074-a-v1',
      'correlation_wp07_workspace_a'
    );
    const workspaceBCommand = command(
      'workspace_1074_b',
      'wp07-workspace-1074-b-v1',
      'correlation_wp07_workspace_b'
    );
    const workspaceA = await firstRuntime.invoke(workspaceACommand);
    const workspaceB = await firstRuntime.invoke(workspaceBCommand);

    expect(workspaceA.binding.runtimeCapability).toEqual(workspaceB.binding.runtimeCapability);
    expect(workspaceA.binding.implementation).toMatchObject({
      id: defaultProfile.implementationProfileId,
      implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
    });
    expect(workspaceA.binding.selectionPolicyVersion).toBe('capability-managed-ai-selection.v1');
    expect(workspaceB.binding.implementation).toMatchObject({
      id: workspaceProfile.implementationProfileId,
      implementationKey: WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY
    });
    expect(workspaceB.binding.selectionPolicyVersion).toBe(
      governedWorkspaceImplementationPreferenceV1(localPreference)?.policyVersion
    );
    expect(workspaceA.outcome.output).toMatchObject({
      provenance: {
        implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
        provider: 'DEEPSEEK',
        model: 'deepseek-chat'
      }
    });
    expect(workspaceB.outcome.output).toMatchObject({
      provenance: {
        implementationProfileId: workspaceManagedAiImplementationProfileV1.profileId,
        implementationKey: WORKSPACE_MANAGED_AI_IMPLEMENTATION_KEY,
        provider: 'WORKSPACE_AI',
        model: 'workspace-model-v1'
      }
    });
    expect(defaultProviderExecute).toHaveBeenCalledTimes(1);
    expect(workspaceProviderExecute).toHaveBeenCalledTimes(1);

    const restartedRuntime = createGovernedProductionRuntimeV1({
      definitions: new PostgresRuntimeCapabilityRegistry(database, pool),
      implementationProfiles: new PostgresImplementationProfileRegistryV1(database, pool),
      workspaceImplementationPreferences: new PostgresWorkspaceImplementationPreferenceStoreV1(
        database,
        pool
      ),
      managedAiRuntime: managedAiRuntime(),
      internalServiceSecret: 's'.repeat(40)
    });
    if (!restartedRuntime) throw new Error('Expected restarted Workspace-aware governed runtime.');

    const workspaceAAfterRestart = await restartedRuntime.invoke(workspaceACommand);
    const workspaceBAfterRestart = await restartedRuntime.invoke(workspaceBCommand);
    expect(workspaceAAfterRestart.binding.implementation).toEqual(
      workspaceA.binding.implementation
    );
    expect(workspaceBAfterRestart.binding.implementation).toEqual(
      workspaceB.binding.implementation
    );
    expect(workspaceAAfterRestart.outcome.output).toEqual(workspaceA.outcome.output);
    expect(workspaceBAfterRestart.outcome.output).toEqual(workspaceB.outcome.output);
    expect(defaultProviderExecute).toHaveBeenCalledTimes(1);
    expect(workspaceProviderExecute).toHaveBeenCalledTimes(1);

    await preferences.register({
      ...localPreference,
      version: 2,
      preferredImplementationKeys: ['ai:workspace-missing:v1'],
      authorityReference: 'workspace-policy-change:1074-b-v2',
      reason: 'Prove an explicit unusable local preference fails closed.',
      createdAt: '2026-09-09T12:31:00.000Z'
    });
    await expect(
      restartedRuntime.invoke(
        command(
          'workspace_1074_b',
          'wp07-workspace-1074-b-missing',
          'correlation_wp07_workspace_b_missing'
        )
      )
    ).rejects.toMatchObject({ code: 'NO_APPROVED_IMPLEMENTATION', status: 409 });
    expect(defaultProviderExecute).toHaveBeenCalledTimes(1);
    expect(workspaceProviderExecute).toHaveBeenCalledTimes(1);

    const workspaceAStillDefault = await restartedRuntime.invoke(
      command('workspace_1074_a', 'wp07-workspace-1074-a-v2', 'correlation_wp07_workspace_a_v2')
    );
    expect(workspaceAStillDefault.binding.implementation.implementationKey).toBe(
      KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY
    );
    expect(defaultProviderExecute).toHaveBeenCalledTimes(2);
    expect(workspaceProviderExecute).toHaveBeenCalledTimes(1);

    await profiles.register({
      ...workspaceProfile,
      version: 2,
      status: 'RETIRED',
      createdAt: '2026-09-09T12:32:00.000Z'
    });
    await preferences.register({
      ...localPreference,
      version: 3,
      authorityReference: 'workspace-policy-change:1074-b-v3',
      reason: 'Point at a now-retired local implementation to prove eligibility is rechecked.',
      createdAt: '2026-09-09T12:33:00.000Z'
    });
    await expect(
      restartedRuntime.invoke(
        command(
          'workspace_1074_b',
          'wp07-workspace-1074-b-retired',
          'correlation_wp07_workspace_b_retired'
        )
      )
    ).rejects.toMatchObject({ code: 'NO_APPROVED_IMPLEMENTATION', status: 409 });
    expect(workspaceProviderExecute).toHaveBeenCalledTimes(1);
  });
});
