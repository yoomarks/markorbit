import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import { describe, expect, it, vi } from 'vitest';
import {
  CapabilityCognitiveReadError,
  CapabilityCognitiveReadServiceV1,
  type CurrentSourceAdmissionPolicyReadV1
} from '../src/capability-cognitive-read.js';

function capability(
  overrides: Partial<RuntimeCapabilityDefinition> = {}
): RuntimeCapabilityDefinition {
  return {
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai',
    version: 2,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    title: 'Managed AI Execution',
    description: 'Private executable details must not enter the cognitive read projection.',
    lineage: {
      domainId: 'managed-ai',
      capabilityId: 'managed-ai-execution',
      actionId: 'execute'
    },
    canonReference: {
      canonId: 'capability-foundation',
      canonVersion: '2026-08-25',
      sourceFingerprintSha256: 'a'.repeat(64)
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-25T01:00:00.000Z',
    ...overrides
  };
}

function profile(overrides: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_deepseek',
    version: 3,
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
    approvalPolicyVersion: 'implementation-admission.v3',
    createdAt: '2026-08-25T02:00:00.000Z',
    ...overrides
  };
}

function service(
  capabilities: readonly RuntimeCapabilityDefinition[] = [capability()],
  profiles: readonly ImplementationProfile[] = [profile()],
  sourceAdmissionPolicies?: Readonly<CurrentSourceAdmissionPolicyReadV1>
) {
  return new CapabilityCognitiveReadServiceV1(
    { listCurrent: vi.fn(() => Promise.resolve(capabilities)) },
    { listCurrent: vi.fn(() => Promise.resolve(profiles)) },
    () => '2026-09-04T16:00:00.000Z',
    sourceAdmissionPolicies
  );
}

function policy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    policyId: 'source-admission-policy.test.v1',
    policyVersion: 1,
    maturityClass: 'PILOT',
    capabilityId: 'test-capability',
    capabilityVersion: '1.0.0',
    implementationProfileId: 'implementation-profile_test',
    implementationProfileVersion: 1,
    implementationKey: 'test:implementation:v1',
    inputSchemaId: 'test-input.v1',
    outputSchemaId: 'test-output.v1',
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'MODERATE',
    reason: 'This test source remains a bounded pilot.',
    ...overrides
  };
}

describe('bounded Capability cognitive read projection', () => {
  it('projects deterministic current owner truth without executable or schema bodies', async () => {
    const projection = await service(
      [
        capability({
          runtimeCapabilityDefinitionId: 'runtime-capability_zeta',
          capabilityId: 'zeta',
          lineage: { capabilityId: 'zeta' }
        }),
        capability({
          runtimeCapabilityDefinitionId: 'runtime-capability_alpha',
          capabilityId: 'alpha',
          lineage: { capabilityId: 'alpha' }
        })
      ],
      [
        profile({ implementationProfileId: 'implementation-profile_zeta', status: 'RETIRED' }),
        profile({ implementationProfileId: 'implementation-profile_alpha' })
      ]
    ).read();

    expect(projection.runtimeCapabilities.map((item) => item.capabilityId)).toEqual([
      'alpha',
      'zeta'
    ]);
    expect(projection.implementationProfiles.map((item) => item.implementationProfileId)).toEqual([
      'implementation-profile_alpha',
      'implementation-profile_zeta'
    ]);
    expect(projection.summary).toEqual({
      runtimeCapabilityCount: 2,
      implementationProfileCount: 2,
      approvedImplementationProfileCount: 1,
      retiredImplementationProfileCount: 1,
      sourceAdmissionPolicyCount: 4,
      productionAdmissibleSourcePolicyCount: 1,
      pilotSourcePolicyCount: 3,
      fixtureTestSourcePolicyCount: 0,
      unsupportedSourcePolicyCount: 0
    });
    expect(projection.runtimeCapabilities[0]).not.toHaveProperty('description');
    expect(projection.implementationProfiles[0]).not.toHaveProperty('inputSchemaId');
    expect(projection.implementationProfiles[0]).not.toHaveProperty('outputSchemaId');
    expect(projection).not.toHaveProperty('credentials');
    expect(projection.source).toEqual({
      domain: 'CAPABILITY_ENGINE',
      authority: 'RUNTIME_CAPABILITY_AND_IMPLEMENTATION_PROFILE_REGISTRIES',
      availability: 'AVAILABLE'
    });
    expect(projection.sourceAdmissionPolicySource).toEqual({
      domain: 'CAPABILITY_ENGINE',
      authority: 'SOURCE_ADMISSION_POLICY_CATALOG',
      availability: 'AVAILABLE'
    });
  });

  it('projects current source maturity without turning currentness requirements into currentness success', async () => {
    const projection = await service().read();
    expect(projection.sourceAdmissionPolicies.map((item) => item.policyId)).toEqual([
      'source-admission-policy.cn-duration-analytical.v1',
      'source-admission-policy.cn-duration-band-classification.v1',
      'source-admission-policy.cn-preliminary-publication-discovery.v1',
      'source-admission-policy.uspto-official-fee-resolver.v2'
    ]);
    expect(
      projection.sourceAdmissionPolicies.filter((item) => item.maturityClass === 'PILOT')
    ).toHaveLength(3);

    const production = projection.sourceAdmissionPolicies.find(
      (item) => item.policyId === 'source-admission-policy.uspto-official-fee-resolver.v2'
    );
    expect(production).toMatchObject({
      maturityClass: 'PRODUCTION_ADMISSIBLE',
      currentnessRequirements: {
        method: 'REQUIRED',
        reference: 'REQUIRED'
      }
    });
    expect(production).not.toHaveProperty('currentness');
    expect(production).not.toHaveProperty('currentnessStatus');
    expect(production).not.toHaveProperty('admissionDecision');

    const pilot = projection.sourceAdmissionPolicies.find(
      (item) => item.policyId === 'source-admission-policy.cn-duration-analytical.v1'
    );
    expect(pilot).toMatchObject({
      maturityClass: 'PILOT'
    });
    expect(pilot).toHaveProperty('reason');
  });

  it('distinguishes valid empty owner reads from unavailable owner truth', async () => {
    await expect(service([], [], { list: () => [] }).read()).resolves.toMatchObject({
      runtimeCapabilities: [],
      implementationProfiles: [],
      sourceAdmissionPolicies: [],
      summary: {
        runtimeCapabilityCount: 0,
        implementationProfileCount: 0,
        sourceAdmissionPolicyCount: 0,
        productionAdmissibleSourcePolicyCount: 0,
        pilotSourcePolicyCount: 0,
        fixtureTestSourcePolicyCount: 0,
        unsupportedSourcePolicyCount: 0
      }
    });

    const unavailableRegistry = new CapabilityCognitiveReadServiceV1(
      {
        listCurrent: vi.fn(() => Promise.reject(new Error('database unavailable')))
      },
      {
        listCurrent: vi.fn(() => Promise.resolve([]))
      }
    );
    await expect(unavailableRegistry.read()).rejects.toBeInstanceOf(CapabilityCognitiveReadError);

    const unavailablePolicySource = service([], [], {
      list: () => {
        throw new Error('policy source unavailable');
      }
    });
    await expect(unavailablePolicySource.read()).rejects.toBeInstanceOf(
      CapabilityCognitiveReadError
    );
  });

  it('fails closed when persisted Runtime Capability owner truth is malformed', async () => {
    const malformed = capability({
      lineage: { capabilityId: 'different-capability' }
    });
    await expect(service([malformed], []).read()).rejects.toMatchObject({
      name: 'CapabilityCognitiveReadError'
    });
  });

  it('fails closed on malformed source policy truth instead of projecting partial maturity', async () => {
    const malformedPolicySource: CurrentSourceAdmissionPolicyReadV1 = {
      list: () => [policy({ currentness: 'CURRENT' })]
    };
    await expect(service([], [], malformedPolicySource).read()).rejects.toMatchObject({
      name: 'CapabilityCognitiveReadError'
    });
  });

  it('retains only bounded Implementation Profile governance metadata', async () => {
    const projection = await service().read();
    expect(projection.implementationProfiles[0]).toEqual({
      implementationProfileId: 'implementation-profile_deepseek',
      version: 3,
      status: 'APPROVED',
      capabilityId: 'managed-ai-execution',
      capabilityVersion: '1.0.0',
      kind: 'AI_ASSISTED_SERVICE',
      implementationKey: 'ai:deepseek:managed-v1',
      allowedCallerProducts: ['KNOWLEDGE'],
      maximumRiskClass: 'MODERATE',
      timeoutMs: 45_000,
      maxAttempts: 1,
      approvalPolicyVersion: 'implementation-admission.v3',
      createdAt: '2026-08-25T02:00:00.000Z'
    });
  });
});
