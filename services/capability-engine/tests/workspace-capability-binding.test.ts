import { describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { JsonRequest } from '@markorbit/service-kit';
import { workspaceCapabilityBindingAuthorityV1 } from '@markorbit/contracts/workspace-capability-binding';
import { createWorkspaceCapabilityBindingRoutesV1 } from '../src/workspace-capability-binding-http.js';
import {
  StaticWorkspaceCapabilityBindingPolicyV1,
  productionWorkspaceCapabilityBindingPolicyV1
} from '../src/workspace-capability-binding-policy.js';
import { InMemoryWorkspaceCapabilityBindingRepositoryV1 } from '../src/workspace-capability-binding-store.js';
import {
  WorkspaceCapabilityBindingServiceError,
  WorkspaceCapabilityBindingServiceV1
} from '../src/workspace-capability-binding.js';
import { workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1 } from '../src/workspace-trademark-issue-intelligence-readiness.js';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const INTELLIGENCE_ID = `brain-intelligence_${'a'.repeat(64)}` as const;
const EVIDENCE_ID = `brain-knowledge-evidence_${'b'.repeat(64)}`;
const PRIMITIVE_ID = `brain-intelligence-primitive_${'c'.repeat(64)}`;
const COMMAND = { workspaceId: WORKSPACE, intelligenceId: INTELLIGENCE_ID } as const;
const SECRET = 'workspace-capability-binding-secret-32-bytes';

function request(
  path: string,
  body: unknown,
  authorization: string | undefined = SECRET
): JsonRequest {
  return {
    method: 'POST',
    path,
    params: {},
    query: {},
    headers: authorization ? { 'x-markorbit-internal-authorization': authorization } : {},
    body
  };
}

function ready() {
  return {
    schemaVersion: 1 as const,
    status: 'READY_FOR_CAPABILITY_BINDING' as const,
    ready: true,
    reference: COMMAND,
    reason: 'Ready.',
    intelligence: {
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
    },
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
  description: 'Test-only accepted Canon projection for WIF-05 binding.',
  lineage: { capabilityId: 'test.trademark-issue-analysis' },
  canonReference: {
    canonId: 'test-wif05-canon',
    canonVersion: '1',
    sourceFingerprintSha256: 'd'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-09-15T00:00:00.000Z'
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

function service(
  options: {
    readiness?: ReturnType<typeof ready>;
    policy?: StaticWorkspaceCapabilityBindingPolicyV1;
    definitions?: readonly RuntimeCapabilityDefinition[];
    now?: () => string;
  } = {}
) {
  const repository = new InMemoryWorkspaceCapabilityBindingRepositoryV1();
  const readiness = options.readiness ?? ready();
  const instance = new WorkspaceCapabilityBindingServiceV1(
    { evaluate: () => Promise.resolve(readiness) },
    options.policy ?? new StaticWorkspaceCapabilityBindingPolicyV1([rule]),
    {
      listVersions: (capabilityId) =>
        Promise.resolve(
          (options.definitions ?? [definition]).filter(
            (candidate) => candidate.capabilityId === capabilityId
          )
        )
    },
    repository,
    options.now ?? (() => '2026-09-15T00:02:00.000Z')
  );
  return { instance, repository };
}

describe('Workspace Capability binding', () => {
  it('creates one immutable non-executing binding to an exact accepted Canon capability', async () => {
    const { instance } = service();
    const outcome = await instance.bind(COMMAND);

    expect(outcome).toMatchObject({ status: 'BOUND', bound: true, replayed: false });
    expect(outcome.binding).toMatchObject({
      workspaceId: WORKSPACE,
      source: { intelligenceId: INTELLIGENCE_ID },
      runtimeCapability: {
        id: definition.runtimeCapabilityDefinitionId,
        version: definition.version,
        capabilityId: definition.capabilityId,
        acceptedCanonProjection: true
      },
      freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
      authority: workspaceCapabilityBindingAuthorityV1
    });
    expect(outcome.binding?.authority.capabilityInvocationAuthorized).toBe(false);
    expect(outcome.binding?.authority.implementationSelected).toBe(false);
  });
  it('replays the same semantic binding without changing its first boundAt', async () => {
    let current = '2026-09-15T00:02:00.000Z';
    const { instance } = service({ now: () => current });
    const first = await instance.bind(COMMAND);
    current = '2026-09-15T00:05:00.000Z';
    const second = await instance.bind(COMMAND);

    expect(first.binding?.bindingId).toBe(second.binding?.bindingId);
    expect(second).toMatchObject({ status: 'BOUND', replayed: true });
    expect(second.binding?.boundAt).toBe('2026-09-15T00:02:00.000Z');
  });

  it('fails closed with the production empty policy catalog', async () => {
    const { instance } = service({ policy: productionWorkspaceCapabilityBindingPolicyV1 });
    await expect(instance.bind(COMMAND)).resolves.toMatchObject({
      status: 'NO_POLICY_MATCH',
      bound: false,
      retryable: false
    });
  });

  it('rejects caller-expanded commands before readiness or persistence', async () => {
    const evaluate = vi.fn(() => Promise.resolve(ready()));
    const repository = new InMemoryWorkspaceCapabilityBindingRepositoryV1();
    const record = vi.spyOn(repository, 'record');
    const instance = new WorkspaceCapabilityBindingServiceV1(
      { evaluate },
      new StaticWorkspaceCapabilityBindingPolicyV1([rule]),
      { listVersions: () => Promise.resolve([definition]) },
      repository
    );

    await expect(
      instance.bind({ ...COMMAND, capabilityId: definition.capabilityId } as never)
    ).rejects.toBeInstanceOf(WorkspaceCapabilityBindingServiceError);
    expect(evaluate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
  it('does not persist when Brain intelligence is not ready', async () => {
    const repository = new InMemoryWorkspaceCapabilityBindingRepositoryV1();
    const record = vi.spyOn(repository, 'record');
    const blocked = {
      schemaVersion: 1 as const,
      status: 'BLOCKED_BY_INTELLIGENCE_STATUS' as const,
      ready: false,
      reference: COMMAND,
      reason: 'Conflicted intelligence.',
      freshness: { status: 'NOT_EVALUATED' as const, plannedStage: 'WIF-08' as const },
      retryable: false,
      authority: workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
    };
    const instance = new WorkspaceCapabilityBindingServiceV1(
      { evaluate: () => Promise.resolve(blocked) },
      new StaticWorkspaceCapabilityBindingPolicyV1([rule]),
      { listVersions: () => Promise.resolve([definition]) },
      repository
    );

    await expect(instance.bind(COMMAND)).resolves.toMatchObject({
      status: 'NOT_READY',
      bound: false,
      readinessStatus: 'BLOCKED_BY_INTELLIGENCE_STATUS'
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('does not bind when the policy target is absent from the runtime registry', async () => {
    const { instance } = service({ definitions: [] });
    await expect(instance.bind(COMMAND)).resolves.toMatchObject({
      status: 'TARGET_CAPABILITY_NOT_AVAILABLE',
      bound: false
    });
  });

  it('fails closed when the runtime target is not an accepted Canon projection', async () => {
    const corrupted = { ...definition, acceptedCanonProjection: false as true };
    const { instance } = service({ definitions: [corrupted] });
    await expect(instance.bind(COMMAND)).resolves.toMatchObject({
      status: 'BINDING_INTEGRITY_FAILURE',
      bound: false
    });
  });

  it('treats duplicate registry definitions for one Capability version as integrity failure', async () => {
    const duplicate: RuntimeCapabilityDefinition = {
      ...definition,
      runtimeCapabilityDefinitionId: 'runtime-capability_test-trademark-issue-routing-duplicate'
    };
    const { instance } = service({ definitions: [definition, duplicate] });
    await expect(instance.bind(COMMAND)).resolves.toMatchObject({
      status: 'BINDING_INTEGRITY_FAILURE',
      bound: false,
      retryable: false
    });
  });

  it('keeps durable binding reads isolated by exact Workspace', async () => {
    const { instance, repository } = service();
    const created = await instance.bind(COMMAND);
    const bindingId = created.binding!.bindingId;

    await expect(repository.find(WORKSPACE, bindingId)).resolves.toEqual(created.binding);
    await expect(repository.find(OTHER_WORKSPACE, bindingId)).resolves.toBeUndefined();
  });

  it('fails closed when multiple server policy rules match the same intelligence', async () => {
    const ambiguous = new StaticWorkspaceCapabilityBindingPolicyV1([
      rule,
      { ...rule, ruleId: 'test-trademark-issue-analysis-secondary' }
    ]);
    const { instance } = service({ policy: ambiguous });

    await expect(instance.bind(COMMAND)).resolves.toMatchObject({
      status: 'BINDING_POLICY_FAILURE',
      bound: false,
      retryable: false
    });
  });

  it('authenticates binding HTTP before readiness or persistence', async () => {
    const { instance, repository } = service();
    const bind = vi.spyOn(instance, 'bind');
    const routes = createWorkspaceCapabilityBindingRoutesV1({
      internalServiceSecret: SECRET,
      binding: instance,
      repository
    });
    await expect(routes[0]!.handle(request(routes[0]!.path, COMMAND, ''))).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(bind).not.toHaveBeenCalled();
  });

  it('exposes bounded bind and exact Workspace-isolated read routes', async () => {
    const { instance, repository } = service();
    const [bindRoute, readRoute] = createWorkspaceCapabilityBindingRoutesV1({
      internalServiceSecret: SECRET,
      binding: instance,
      repository
    });
    const bound = await bindRoute!.handle(request(bindRoute!.path, COMMAND));
    expect(bound.status).toBe(200);
    expect(bound.body).toMatchObject({ status: 'BOUND', bound: true });
    const bindingId = (bound.body as { binding: { bindingId: string } }).binding.bindingId;
    const exact = await readRoute!.handle(
      request(readRoute!.path, { workspaceId: WORKSPACE, bindingId })
    );
    expect(exact.status).toBe(200);
    const hidden = await readRoute!.handle(
      request(readRoute!.path, { workspaceId: OTHER_WORKSPACE, bindingId })
    );
    expect(hidden.status).toBe(404);
  });

  it('rejects expanded bind commands and read references', async () => {
    const { instance, repository } = service();
    const [bindRoute, readRoute] = createWorkspaceCapabilityBindingRoutesV1({
      internalServiceSecret: SECRET,
      binding: instance,
      repository
    });
    await expect(
      bindRoute!.handle(
        request(bindRoute!.path, { ...COMMAND, capabilityId: definition.capabilityId })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_COMMAND' });
    await expect(
      readRoute!.handle(
        request(readRoute!.path, { workspaceId: WORKSPACE, bindingId: 'bad', extra: true })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_INPUT' });
  });
});
