import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import type { JsonRequest } from '@markorbit/service-kit';
import { createCapabilityRuntimeRoutesV2 } from '../src/capability-runtime-http.js';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';
import { createRuntime } from '../src/index.js';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai-execution',
  version: 3,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  title: 'Managed AI Execution',
  description: 'Provider-neutral governed AI execution capability.',
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

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_deterministic-ai-http',
  version: 2,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:http-deterministic-ai',
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  allowedCallerProducts: ['KNOWLEDGE'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 1_000,
  maxAttempts: 1,
  approvalPolicyVersion: 'capability-binding-policy.v1',
  createdAt: '2026-08-25T01:00:00.000Z'
};

const command = () => ({
  schemaVersion: 2 as const,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  caller: {
    workspaceId: 'workspace_test',
    principalId: 'principal_test',
    callerProduct: 'KNOWLEDGE',
    permissionContextRef: 'permission_context_test'
  },
  purpose: 'Acquire one governed AI source result.',
  input: { question: 'What changed?' },
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  riskClass: 'MODERATE' as const,
  idempotencyKey: 'knowledge-ai-source-http-1',
  correlationId: 'correlation_http_test'
});

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_http_test',
    implementationBinding: () => 'implementation-binding_http_test',
    capabilityInvocation: () => 'capability-invocation_http_test',
    capabilityOutcome: () => 'capability-outcome_http_test',
    capabilityReturn: () => 'capability-return_http_test',
    sessionReceipt: () => 'session-receipt_http_test'
  };
}

function governed(options?: {
  definition?: RuntimeCapabilityDefinition;
  selected?: ImplementationProfile;
}) {
  const execute = vi.fn(() =>
    Promise.resolve({
      output: { answer: 'governed answer' },
      evidenceRefs: ['evidence_http_1'],
      usage: { latencyMs: 7 }
    })
  );
  const runtime = new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: vi.fn(() => Promise.resolve(options?.definition ?? definition))
    },
    implementations: {
      select: vi.fn(() =>
        Promise.resolve(
          options?.selected === undefined && options && 'selected' in options
            ? undefined
            : {
                profile: options?.selected ?? profile,
                policyVersion: 'capability-binding-policy.v1'
              }
        )
      )
    },
    inputContracts: { validate: vi.fn(() => true) },
    outputContracts: { validate: vi.fn(() => true) },
    executor: { execute },
    now: () => '2026-08-25T01:01:00.000Z',
    ids: ids()
  });
  return { runtime, execute };
}

function request(
  body: unknown = command(),
  headers: Record<string, string | undefined> = {}
): JsonRequest {
  return {
    method: 'POST',
    path: '/v1/capability-requests',
    params: {},
    query: {},
    headers: {
      'idempotency-key': command().idempotencyKey,
      ...headers
    },
    body
  };
}

const running: Array<ReturnType<typeof createRuntime>> = [];
afterEach(async () => {
  await Promise.all(running.splice(0).map((runtime) => runtime.stop()));
});

describe('MO-CAP-001 WP04 governed Capability request path', () => {
  it('returns a governed V2 execution with exact binding, receipt, evidence and no authority promotion', async () => {
    const { runtime, execute } = governed();
    const route = createCapabilityRuntimeRoutesV2({ runtime })[0]!;

    const first = await route.handle(request());
    const replay = await route.handle(request());

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(first.body).toMatchObject({
      replayed: false,
      binding: {
        runtimeCapability: {
          id: definition.runtimeCapabilityDefinitionId,
          version: definition.version,
          capabilityId: definition.capabilityId,
          capabilityVersion: definition.capabilityVersion
        },
        implementation: {
          id: profile.implementationProfileId,
          version: profile.version,
          implementationKey: profile.implementationKey
        }
      },
      outcome: {
        status: 'SUCCEEDED',
        evidenceRefs: ['evidence_http_1']
      },
      receipt: {
        workspaceId: 'workspace_test',
        principalId: 'principal_test',
        callerProduct: 'KNOWLEDGE',
        implementation: {
          id: profile.implementationProfileId,
          version: profile.version,
          implementationKey: profile.implementationKey
        }
      }
    });
    const body = first.body as {
      outcome: { authority: Record<string, boolean> };
      receipt: { authority: Record<string, boolean> };
    };
    expect(Object.values(body.outcome.authority).every((value) => value === false)).toBe(true);
    expect(Object.values(body.receipt.authority).every((value) => value === false)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the Idempotency-Key header is missing or mismatched', async () => {
    const { runtime, execute } = governed();
    const route = createCapabilityRuntimeRoutesV2({ runtime })[0]!;

    await expect(
      route.handle(request(command(), { 'idempotency-key': undefined }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    await expect(
      route.handle(request(command(), { 'idempotency-key': 'different-key' }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied provider implementation controls before runtime selection', async () => {
    const { runtime, execute } = governed();
    const invoke = vi.spyOn(runtime, 'invoke');
    const route = createCapabilityRuntimeRoutesV2({ runtime })[0]!;

    await expect(
      route.handle(
        request({
          ...command(),
          provider: 'openai',
          model: 'caller-selected-model',
          credential: 'caller-secret'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(invoke).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps missing accepted Capability definition and missing implementation to typed fail-closed HTTP errors', async () => {
    const missingDefinition = governed();
    const noDefinition = new GovernedCapabilityRuntime({
      definitions: { findCurrent: vi.fn(() => Promise.resolve(undefined)) },
      implementations: { select: vi.fn(() => Promise.resolve(undefined)) },
      inputContracts: { validate: vi.fn(() => true) },
      outputContracts: { validate: vi.fn(() => true) },
      executor: { execute: missingDefinition.execute },
      ids: ids()
    });
    const noDefinitionRoute = createCapabilityRuntimeRoutesV2({ runtime: noDefinition })[0]!;
    await expect(noDefinitionRoute.handle(request())).rejects.toMatchObject({
      status: 404,
      code: 'CAPABILITY_NOT_FOUND'
    });

    const noImplementation = new GovernedCapabilityRuntime({
      definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
      implementations: { select: vi.fn(() => Promise.resolve(undefined)) },
      inputContracts: { validate: vi.fn(() => true) },
      outputContracts: { validate: vi.fn(() => true) },
      executor: { execute: missingDefinition.execute },
      ids: ids()
    });
    const noImplementationRoute = createCapabilityRuntimeRoutesV2({
      runtime: noImplementation
    })[0]!;
    await expect(noImplementationRoute.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'NO_APPROVED_IMPLEMENTATION'
    });
    expect(missingDefinition.execute).not.toHaveBeenCalled();
  });

  it('rejects conflicting exact replay before a second implementation execution', async () => {
    const { runtime, execute } = governed();
    const route = createCapabilityRuntimeRoutesV2({ runtime })[0]!;
    await route.handle(request());

    await expect(
      route.handle(
        request({
          ...command(),
          input: { question: 'Different input under the same key.' }
        })
      )
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not expose the historical fixture path in a normal unconfigured runtime', async () => {
    const runtime = createRuntime({ port: 0 });
    running.push(runtime);
    await runtime.start();

    const response = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/v1/capability-requests`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'legacy-key' },
        body: JSON.stringify({ idempotencyKey: 'legacy-key' })
      }
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('exposes the governed request route only when a governed runtime is injected', async () => {
    const { runtime: governedRuntime, execute } = governed();
    const runtime = createRuntime({ port: 0, governedCapabilityRuntime: governedRuntime });
    running.push(runtime);
    await runtime.start();

    const response = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/v1/capability-requests`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': command().idempotencyKey,
          'x-correlation-id': command().correlationId
        },
        body: JSON.stringify(command())
      }
    );
    const body = (await response.json()) as {
      binding: { implementation: { version: number } };
    };

    expect(response.status).toBe(201);
    expect(body.binding.implementation.version).toBe(profile.version);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('preserves typed dependency failures instead of misclassifying them as invalid caller input', async () => {
    const route = createCapabilityRuntimeRoutesV2({
      runtime: {
        invoke: vi.fn(() =>
          Promise.reject(
            Object.assign(new Error('registry unavailable'), {
              status: 503,
              code: 'PERSISTENCE_UNAVAILABLE'
            })
          )
        )
      }
    })[0]!;

    await expect(route.handle(request())).rejects.toEqual(
      expect.objectContaining({
        status: 503,
        code: 'PERSISTENCE_UNAVAILABLE'
      })
    );
  });
});
