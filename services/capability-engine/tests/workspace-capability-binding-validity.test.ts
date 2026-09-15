import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  workspaceCapabilityBindingAuthorityV1,
  workspaceCapabilityBindingFingerprintSha256V1,
  workspaceCapabilityBindingIdV1,
  type WorkspaceCapabilityBindingIdentityV1,
  type WorkspaceCapabilityBindingV1
} from '@markorbit/contracts/workspace-capability-binding';
import { StaticWorkspaceCapabilityBindingPolicyV1 } from '../src/workspace-capability-binding-policy.js';
import {
  InMemoryWorkspaceCapabilityBindingRevocationRepositoryV1,
  workspaceCapabilityBindingRevocationAuthorityV1,
  workspaceCapabilityBindingRevocationIdV1
} from '../src/workspace-capability-binding-revocation-store.js';
import { InMemoryWorkspaceCapabilityBindingRepositoryV1 } from '../src/workspace-capability-binding-store.js';
import { workspaceKnowledgeEvidenceCurrentnessSnapshotSha256V1 } from '../src/workspace-capability-binding-currentness.js';
import { InMemoryWorkspaceCapabilityBindingValidityRepositoryV1 } from '../src/workspace-capability-binding-validity-store.js';
import {
  WorkspaceCapabilityBindingValidityServiceError,
  WorkspaceCapabilityBindingValidityServiceV1
} from '../src/workspace-capability-binding-validity.js';
import { workspaceCapabilityBindingSourceProjectionSha256V1 } from '../src/workspace-capability-binding.js';
import { workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1 } from '../src/workspace-trademark-issue-intelligence-readiness.js';
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const INTELLIGENCE_ID = `brain-intelligence_${'a'.repeat(64)}` as const;
const EVIDENCE_ID = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;
const PRIMITIVE_ID = `brain-intelligence-primitive_${'c'.repeat(64)}` as const;

function ready() {
  const intelligence = {
    intelligenceId: INTELLIGENCE_ID,
    workspaceId: WORKSPACE,
    task: 'TRADEMARK_ISSUE_EXTRACTION' as const,
    status: 'INTERPRETED' as const,
    evidenceRefs: [EVIDENCE_ID],
    primitiveRefs: [PRIMITIVE_ID],
    interpreter: {
      profileId: 'workspace-trademark-issue-interpreter',
      version: '1.0.0',
      policyProfileId: 'brain-policy-profile-v1'
    },
    generatedAt: '2026-09-15T00:01:00.000Z'
  };
  return {
    schemaVersion: 1 as const,
    status: 'READY_FOR_CAPABILITY_BINDING' as const,
    ready: true,
    reference: { workspaceId: WORKSPACE, intelligenceId: INTELLIGENCE_ID },
    reason: 'Ready.',
    intelligence,
    freshness: { status: 'NOT_EVALUATED' as const, plannedStage: 'WIF-08' as const },
    retryable: false,
    authority: workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
  };
}

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_test-trademark-issue-routing',
  version: 3,
  capabilityId: 'test.trademark-issue-analysis',
  capabilityVersion: '1.0.0',
  title: 'Test trademark issue analysis',
  description: 'Test-only accepted Canon projection for WIF-08 revalidation.',
  lineage: { capabilityId: 'test.trademark-issue-analysis' },
  canonReference: {
    canonId: 'test-wif08-canon',
    canonVersion: '1',
    sourceFingerprintSha256: 'd'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-09-15T00:00:00.000Z'
};

const supersedingDefinition: RuntimeCapabilityDefinition = {
  ...definition,
  version: 4,
  capabilityVersion: '2.0.0',
  canonReference: {
    canonId: 'test-wif08-canon',
    canonVersion: '2',
    sourceFingerprintSha256: 'e'.repeat(64)
  },
  createdAt: '2026-09-15T01:00:00.000Z'
};

const rule = {
  policyId: 'workspace-capability-binding.v1',
  policyVersion: '1.0.0',
  ruleId: 'test-trademark-issue-analysis',
  reason: 'Test-only governed mapping.',
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  task: 'TRADEMARK_ISSUE_EXTRACTION' as const,
  interpreterProfileId: 'workspace-trademark-issue-interpreter'
};

function bound(): WorkspaceCapabilityBindingV1 {
  const intelligence = ready().intelligence;
  const identity: WorkspaceCapabilityBindingIdentityV1 = {
    schemaVersion: 1,
    workspaceId: WORKSPACE,
    source: {
      intelligenceId: INTELLIGENCE_ID,
      task: intelligence.task,
      projectionSha256: workspaceCapabilityBindingSourceProjectionSha256V1(intelligence),
      generatedAt: intelligence.generatedAt,
      evidenceRefs: [EVIDENCE_ID],
      primitiveRefs: [PRIMITIVE_ID],
      interpreter: structuredClone(intelligence.interpreter)
    },
    runtimeCapability: {
      id: definition.runtimeCapabilityDefinitionId,
      version: definition.version,
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion,
      canonReference: structuredClone(definition.canonReference),
      acceptedCanonProjection: true
    },
    bindingPolicy: {
      policyId: rule.policyId,
      policyVersion: rule.policyVersion,
      ruleId: rule.ruleId,
      reason: rule.reason
    },
    freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
    authority: workspaceCapabilityBindingAuthorityV1
  };
  return {
    ...identity,
    bindingId: workspaceCapabilityBindingIdV1(identity),
    boundAt: '2026-09-15T00:02:00.000Z'
  };
}

type KnowledgeStatus = 'CURRENT' | 'REVOKED' | 'SUPERSEDED' | 'CURRENTNESS_UNAVAILABLE';
async function service(
  options: {
    knowledgeStatus?: KnowledgeStatus;
    policy?: StaticWorkspaceCapabilityBindingPolicyV1;
    exactDefinition?: RuntimeCapabilityDefinition;
    exactMissing?: boolean;
    currentDefinition?: RuntimeCapabilityDefinition;
    revoke?: boolean;
    now?: () => string;
  } = {}
) {
  const binding = bound();
  const bindings = new InMemoryWorkspaceCapabilityBindingRepositoryV1();
  await bindings.record(binding);
  const revocations = new InMemoryWorkspaceCapabilityBindingRevocationRepositoryV1();
  if (options.revoke) {
    const identity = {
      schemaVersion: 1 as const,
      workspaceId: WORKSPACE,
      bindingId: binding.bindingId,
      bindingFingerprintSha256: workspaceCapabilityBindingFingerprintSha256V1(binding),
      reason: 'Explicit test revocation.',
      authority: workspaceCapabilityBindingRevocationAuthorityV1
    };
    await revocations.record({
      ...identity,
      revocationId: workspaceCapabilityBindingRevocationIdV1(identity),
      revokedAt: '2026-09-15T00:03:00.000Z'
    });
  }
  const observations = new InMemoryWorkspaceCapabilityBindingValidityRepositoryV1();
  const knowledgeStatus = options.knowledgeStatus ?? 'CURRENT';
  const instance = new WorkspaceCapabilityBindingValidityServiceV1(
    bindings,
    { evaluate: () => Promise.resolve(ready()) },
    options.policy ?? new StaticWorkspaceCapabilityBindingPolicyV1([rule]),
    {
      findVersion: () =>
        Promise.resolve(options.exactMissing ? undefined : (options.exactDefinition ?? definition)),
      findCurrent: () => Promise.resolve(options.currentDefinition ?? definition)
    },
    {
      evaluate: ({ workspaceId, evidenceRefs }) =>
        Promise.resolve({
          status: knowledgeStatus,
          evidenceRefs,
          ownerSnapshotSha256: workspaceKnowledgeEvidenceCurrentnessSnapshotSha256V1({
            owner: 'KNOWLEDGE',
            status: knowledgeStatus,
            workspaceId,
            evidenceRefs
          }),
          reason: `Knowledge says ${knowledgeStatus}.`
        })
    },
    revocations,
    observations,
    options.now ?? (() => '2026-09-15T00:04:00.000Z')
  );
  return { instance, binding, bindings, revocations, observations };
}

describe('Workspace Capability binding current validity', () => {
  it('is CURRENT only when every modeled owner truth is current', async () => {
    const { instance, binding } = await service();
    const outcome = await instance.evaluate({
      workspaceId: WORKSPACE,
      bindingId: binding.bindingId
    });
    expect(outcome).toMatchObject({
      status: 'CURRENT',
      evaluated: true,
      currentUsable: true,
      retryable: false
    });
    expect(outcome.observation?.reasonCode).toBe('ALL_CURRENT');
    expect(outcome.observation?.authority.capabilityInvocationAuthorized).toBe(false);
  });

  it('fails closed when Knowledge currentness is unavailable', async () => {
    const { instance, binding } = await service({ knowledgeStatus: 'CURRENTNESS_UNAVAILABLE' });
    await expect(
      instance.evaluate({ workspaceId: WORKSPACE, bindingId: binding.bindingId })
    ).resolves.toMatchObject({
      status: 'CURRENTNESS_UNAVAILABLE',
      currentUsable: false,
      observation: { reasonCode: 'KNOWLEDGE_CURRENTNESS_UNAVAILABLE' }
    });
  });
  it.each([
    ['REVOKED', 'KNOWLEDGE_EVIDENCE_REVOKED'],
    ['SUPERSEDED', 'KNOWLEDGE_EVIDENCE_SUPERSEDED']
  ] as const)('blocks when Knowledge evidence is %s', async (knowledgeStatus, reasonCode) => {
    const { instance, binding } = await service({ knowledgeStatus });
    const outcome = await instance.evaluate({
      workspaceId: WORKSPACE,
      bindingId: binding.bindingId
    });
    expect(outcome).toMatchObject({
      status: 'BLOCKED_BY_EVIDENCE_CURRENTNESS',
      currentUsable: false,
      observation: { reasonCode }
    });
  });

  it('marks a removed binding policy mapping as no longer current', async () => {
    const { instance, binding } = await service({
      policy: new StaticWorkspaceCapabilityBindingPolicyV1([])
    });
    await expect(
      instance.evaluate({ workspaceId: WORKSPACE, bindingId: binding.bindingId })
    ).resolves.toMatchObject({
      status: 'BINDING_POLICY_NO_LONGER_MATCHES',
      currentUsable: false,
      observation: { reasonCode: 'POLICY_NO_LONGER_MATCHES' }
    });
  });
  it('marks a newer Runtime Capability version as superseding the historical target', async () => {
    const { instance, binding } = await service({ currentDefinition: supersedingDefinition });
    await expect(
      instance.evaluate({ workspaceId: WORKSPACE, bindingId: binding.bindingId })
    ).resolves.toMatchObject({
      status: 'TARGET_CAPABILITY_SUPERSEDED',
      currentUsable: false,
      observation: { reasonCode: 'RUNTIME_CAPABILITY_SUPERSEDED' }
    });
  });

  it('fails closed when the exact bound Runtime Capability version is missing', async () => {
    const { instance, binding } = await service({ exactMissing: true });
    await expect(
      instance.evaluate({ workspaceId: WORKSPACE, bindingId: binding.bindingId })
    ).resolves.toMatchObject({
      status: 'TARGET_CAPABILITY_MISSING',
      currentUsable: false,
      observation: { reasonCode: 'RUNTIME_CAPABILITY_MISSING' }
    });
  });

  it('honors an explicit durable binding revocation before other currentness checks', async () => {
    const { instance, binding } = await service({
      revoke: true,
      knowledgeStatus: 'CURRENTNESS_UNAVAILABLE'
    });
    await expect(
      instance.evaluate({ workspaceId: WORKSPACE, bindingId: binding.bindingId })
    ).resolves.toMatchObject({
      status: 'REVOKED',
      currentUsable: false,
      observation: { reasonCode: 'BINDING_REVOKED', basis: { revocation: { status: 'REVOKED' } } }
    });
  });

  it('keeps exact Workspace validity reads isolated without existence disclosure', async () => {
    const { instance, binding } = await service();
    await expect(
      instance.evaluate({ workspaceId: OTHER_WORKSPACE, bindingId: binding.bindingId })
    ).resolves.toMatchObject({ status: 'NOT_FOUND', evaluated: false, currentUsable: false });
  });

  it('replays the same semantic validity observation without changing first evaluatedAt', async () => {
    let now = '2026-09-15T00:04:00.000Z';
    const { instance, binding } = await service({ now: () => now });
    const first = await instance.evaluate({ workspaceId: WORKSPACE, bindingId: binding.bindingId });
    now = '2026-09-15T00:05:00.000Z';
    const second = await instance.evaluate({
      workspaceId: WORKSPACE,
      bindingId: binding.bindingId
    });
    expect(second).toMatchObject({ status: 'CURRENT', replayed: true });
    expect(second.observation?.observationId).toBe(first.observation?.observationId);
    expect(second.observation?.evaluatedAt).toBe(first.observation?.evaluatedAt);
  });

  it('rejects caller-expanded commands before owner reads', async () => {
    const { instance, binding } = await service();
    await expect(
      instance.evaluate({
        workspaceId: WORKSPACE,
        bindingId: binding.bindingId,
        freshness: 'CURRENT'
      } as never)
    ).rejects.toBeInstanceOf(WorkspaceCapabilityBindingValidityServiceError);
  });
});
