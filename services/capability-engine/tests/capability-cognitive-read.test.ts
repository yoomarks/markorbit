import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import { describe, expect, it, vi } from 'vitest';
import {
  CapabilityCognitiveReadError,
  CapabilityCognitiveReadServiceV1
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
  profiles: readonly ImplementationProfile[] = [profile()]
) {
  return new CapabilityCognitiveReadServiceV1(
    { listCurrent: vi.fn(() => Promise.resolve(capabilities)) },
    { listCurrent: vi.fn(() => Promise.resolve(profiles)) },
    () => '2026-09-04T16:00:00.000Z'
  );
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
      retiredImplementationProfileCount: 1
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
  });

  it('distinguishes a valid empty owner read from unavailable owner truth', async () => {
    await expect(service([], []).read()).resolves.toMatchObject({
      runtimeCapabilities: [],
      implementationProfiles: [],
      summary: {
        runtimeCapabilityCount: 0,
        implementationProfileCount: 0
      }
    });

    const unavailable = new CapabilityCognitiveReadServiceV1(
      {
        listCurrent: vi.fn(() => Promise.reject(new Error('database unavailable')))
      },
      {
        listCurrent: vi.fn(() => Promise.resolve([]))
      }
    );
    await expect(unavailable.read()).rejects.toBeInstanceOf(CapabilityCognitiveReadError);
  });

  it('fails closed when persisted Runtime Capability owner truth is malformed', async () => {
    const malformed = capability({
      lineage: { capabilityId: 'different-capability' }
    });
    await expect(service([malformed], []).read()).rejects.toMatchObject({
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
