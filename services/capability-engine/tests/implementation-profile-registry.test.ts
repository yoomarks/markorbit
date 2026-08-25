import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRequestV2,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  GovernedImplementationProfileSelectorV1,
  InMemoryImplementationProfileRegistryV1,
  normalizeImplementationProfileV1
} from '../src/implementation-profile-registry.js';

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
  capabilityRequestId: 'capreq_test',
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
  idempotencyKey: 'managed-ai-1',
  correlationId: 'corr_test',
  receivedAt: '2026-08-25T01:01:00.000Z'
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

describe('Implementation Profile registry and binding core', () => {
  it('normalizes only the governed ImplementationProfile contract and rejects hidden controls', () => {
    expect(normalizeImplementationProfileV1(profile())).toEqual(profile());
    expect(() =>
      normalizeImplementationProfileV1({
        ...profile(),
        providerApiKey: 'caller-secret',
        endpoint: 'https://caller.invalid'
      })
    ).toThrow(/unsupported fields/u);
  });

  it('makes exact profile versions immutable and exact re-registration idempotent', () => {
    const registry = new InMemoryImplementationProfileRegistryV1();
    const first = registry.register(profile());
    const replay = registry.register(profile());

    expect(replay).toEqual(first);
    expect(() => registry.register(profile({ timeoutMs: 30_000 }))).toThrow(
      /immutable and conflicts/u
    );
  });

  it('requires each new profile version to preserve capability, implementation and schema lineage', () => {
    const registry = new InMemoryImplementationProfileRegistryV1([profile()]);

    expect(() =>
      registry.register(
        profile({
          version: 2,
          outputSchemaId: 'different-output.v2',
          createdAt: '2026-08-25T02:00:00.000Z'
        })
      )
    ).toThrow(/cannot change capability, implementation key, kind, or schema lineage/u);
    expect(() =>
      registry.register(
        profile({
          version: 2,
          implementationKey: 'ai:other',
          createdAt: '2026-08-25T02:00:00.000Z'
        })
      )
    ).toThrow(/cannot change capability, implementation key, kind, or schema lineage/u);
  });

  it('treats retirement as a newer immutable profile version and never falls back to an older approved version', async () => {
    const registry = new InMemoryImplementationProfileRegistryV1([
      profile(),
      profile({
        version: 2,
        status: 'RETIRED',
        approvalPolicyVersion: 'implementation-admission.v2',
        createdAt: '2026-08-25T02:00:00.000Z'
      })
    ]);
    const selector = new GovernedImplementationProfileSelectorV1(registry, {
      policyVersion: 'selection.v1',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE']
    });

    expect(registry.findCurrent(profile().implementationProfileId)?.status).toBe('RETIRED');
    await expect(selector.select(request, definition)).resolves.toBeUndefined();
  });

  it('prevents one implementation key from belonging to multiple profile identities', () => {
    const registry = new InMemoryImplementationProfileRegistryV1([profile()]);

    expect(() =>
      registry.register(
        profile({
          implementationProfileId: 'implementation-profile_collision',
          createdAt: '2026-08-25T02:00:00.000Z'
        })
      )
    ).toThrow(/only one Implementation Profile lineage/u);
  });

  it('binds the exact current approved profile only when capability, schema, caller and risk all match', async () => {
    const registry = new InMemoryImplementationProfileRegistryV1([profile()]);
    const selector = new GovernedImplementationProfileSelectorV1(registry, {
      policyVersion: 'selection.v1',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE']
    });

    await expect(selector.select(request, definition)).resolves.toEqual({
      profile: profile(),
      policyVersion: 'selection.v1'
    });
    await expect(
      selector.select({ ...request, inputSchemaId: 'wrong-input.v1' }, definition)
    ).resolves.toBeUndefined();
    await expect(
      selector.select(
        { ...request, caller: { ...request.caller, callerProduct: 'BRAIN' } },
        definition
      )
    ).resolves.toBeUndefined();
    await expect(
      selector.select({ ...request, riskClass: 'HIGH' }, definition)
    ).resolves.toBeUndefined();
    await expect(
      selector.select({ ...request, capabilityVersion: '0.9.0' }, definition)
    ).resolves.toBeUndefined();
  });

  it('requires trusted server policy when multiple approved implementations are eligible', async () => {
    const registry = new InMemoryImplementationProfileRegistryV1([
      profile(),
      profile({
        implementationProfileId: 'implementation-profile_openai',
        implementationKey: 'ai:openai:managed-v1',
        createdAt: '2026-08-25T01:00:01.000Z'
      })
    ]);
    const ambiguous = new GovernedImplementationProfileSelectorV1(registry, {
      policyVersion: 'selection.v1',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE']
    });
    const governed = new GovernedImplementationProfileSelectorV1(registry, {
      policyVersion: 'selection.v2',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE'],
      preferredImplementationKeys: ['ai:openai:managed-v1', 'ai:deepseek:managed-v1']
    });

    await expect(ambiguous.select(request, definition)).rejects.toMatchObject({
      code: 'AMBIGUOUS_IMPLEMENTATION_SELECTION'
    });
    await expect(governed.select(request, definition)).resolves.toMatchObject({
      profile: {
        implementationProfileId: 'implementation-profile_openai',
        implementationKey: 'ai:openai:managed-v1',
        version: 1
      },
      policyVersion: 'selection.v2'
    });
  });

  it('does not let trusted policy resurrect a retired, disallowed or schema-mismatched profile', async () => {
    const registry = new InMemoryImplementationProfileRegistryV1([
      profile(),
      profile({
        implementationProfileId: 'implementation-profile_external',
        implementationKey: 'external:managed-v1',
        kind: 'EXTERNAL_PROVIDER',
        createdAt: '2026-08-25T01:00:01.000Z'
      })
    ]);
    const selector = new GovernedImplementationProfileSelectorV1(registry, {
      policyVersion: 'selection.v1',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE'],
      preferredImplementationKeys: ['external:managed-v1']
    });

    await expect(selector.select(request, definition)).resolves.toBeUndefined();
  });

  it('rejects wildcard-plus-named caller admission because the envelope must be unambiguous', () => {
    expect(() =>
      normalizeImplementationProfileV1(profile({ allowedCallerProducts: ['*', 'KNOWLEDGE'] }))
    ).toThrow(/cannot combine wildcard admission/u);
  });
});
