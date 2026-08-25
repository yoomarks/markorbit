import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  InMemoryManagedAiExactOutputStoreV1,
  ManagedAiExactOutputStoreError,
  type ManagedAiExactOutputStoreV1
} from '../src/managed-ai-exact-output.js';
import { createManagedAiExecutionRoutesV1 } from '../src/managed-ai-http.js';

const secret = 'managed-ai-exact-output-secret-32-bytes';
const idempotencyKey = 'knowledge_assignment_exact_output:attempt:1';
const correlationId = 'knowledge_assignment_exact_output';
const bytes = Buffer.from('# Grounded result\n\nExact provider bytes.\n', 'utf8');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const executionId = `maiexec_${createHash('sha256')
  .update(idempotencyKey)
  .digest('hex')
  .slice(0, 32)}`;
const durableRef = `managed-ai-output:v1:${executionId}`;

const input = {
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput: { prompt: 'Ground this source.' },
  requestedOutput: { schemaId: 'knowledge.ai-distilled-markdown.v1', format: 'MARKDOWN' },
  requirements: {
    capabilities: ['text-generation'],
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: { policyId: 'knowledge.ai-distillation', policyVersion: '1' },
  evidence: { exactOutput: 'REQUIRED', providerRequestId: 'REQUIRED_WHEN_AVAILABLE' }
};

const completedOutcome: ManagedAiExecutionOutcomeV1 = {
  schemaVersion: 1,
  capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
  capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  status: 'COMPLETED',
  deliveryState: 'PROVIDER_COMPLETED',
  retryDisposition: 'RETRY_FORBIDDEN',
  provenance: {
    implementationProfileId: 'knowledge-deepseek-source-acquisition',
    implementationProfileVersion: 1,
    implementationKey: 'ai:deepseek:chat-completions:v1',
    provider: 'DEEPSEEK',
    model: 'deepseek-v4-flash',
    promptPolicyId: 'knowledge.ai-distillation',
    promptPolicyVersion: '1',
    outputSchemaId: 'knowledge.ai-distilled-markdown.v1',
    inputSha256: 'a'.repeat(64),
    providerRequestId: 'provider-request-1',
    startedAt: '2026-08-25T00:00:00.000Z',
    completedAt: '2026-08-25T00:00:01.000Z'
  },
  exactOutput: {
    kind: 'INLINE_BASE64',
    mediaType: 'text/markdown; charset=utf-8',
    sha256,
    sizeBytes: bytes.byteLength,
    dataBase64: bytes.toString('base64')
  },
  structuredOutput: '# Grounded result\n\nExact provider bytes.\n',
  authority: managedAiNoAuthorityConsequences
};

function executionRequest() {
  return {
    method: 'POST' as const,
    path: '/internal/v1/managed-ai-executions',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'idempotency-key': idempotencyKey,
      'x-correlation-id': correlationId
    },
    body: input
  };
}

function resolutionRequest(ref = durableRef, authorization = secret) {
  return {
    method: 'POST' as const,
    path: '/internal/v1/managed-ai-exact-output-resolutions',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body: { ref }
  };
}

describe('Managed AI durable exact output', () => {
  it('commits exact bytes before claim completion, replays the durable ref, and resolves bytes internally', async () => {
    const store = new InMemoryManagedAiExactOutputStoreV1();
    const execute = vi.fn(() => Promise.resolve(completedOutcome));
    const routes = createManagedAiExecutionRoutesV1({
      internalServiceSecret: secret,
      executor: { execute },
      exactOutputStore: store,
      now: () => '2026-08-25T00:00:02.000Z',
      ownerTokenFactory: () => 'exact-output-owner'
    });
    const execution = routes[0]!;
    const resolver = routes[1]!;

    const first = await execution.handle(executionRequest());
    const replay = await execution.handle(executionRequest());

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      status: 'COMPLETED',
      exactOutput: {
        kind: 'DURABLE_REF',
        mediaType: 'text/markdown; charset=utf-8',
        sha256,
        sizeBytes: bytes.byteLength,
        ref: durableRef
      }
    });
    expect(replay).toEqual(first);
    expect(execute).toHaveBeenCalledTimes(1);

    await expect(resolver.handle(resolutionRequest())).resolves.toEqual({
      status: 200,
      body: {
        kind: 'INLINE_BASE64',
        mediaType: 'text/markdown; charset=utf-8',
        sha256,
        sizeBytes: bytes.byteLength,
        dataBase64: bytes.toString('base64')
      }
    });
  });

  it('rejects exact bytes whose governed hash or size metadata is false', async () => {
    const store = new InMemoryManagedAiExactOutputStoreV1();
    await expect(
      store.persist({
        executionId,
        now: '2026-08-25T00:00:00.000Z',
        output: {
          kind: 'INLINE_BASE64',
          mediaType: 'text/plain',
          sha256: '0'.repeat(64),
          sizeBytes: bytes.byteLength,
          dataBase64: bytes.toString('base64')
        }
      })
    ).rejects.toBeInstanceOf(ManagedAiExactOutputStoreError);
  });

  it('quarantines replay when exact-output persistence fails after provider dispatch', async () => {
    const persist = vi.fn(() => Promise.reject(new Error('exact output database unavailable')));
    const store: ManagedAiExactOutputStoreV1 = {
      persist,
      resolve: vi.fn(() => Promise.reject(new Error('not used')))
    };
    const execute = vi.fn(() => Promise.resolve(completedOutcome));
    const execution = createManagedAiExecutionRoutesV1({
      internalServiceSecret: secret,
      executor: { execute },
      exactOutputStore: store,
      now: () => '2026-08-25T00:00:02.000Z',
      ownerTokenFactory: () => 'exact-output-failure-owner'
    })[0]!;

    await expect(execution.handle(executionRequest())).rejects.toMatchObject({
      status: 503,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    await expect(execution.handle(executionRequest())).rejects.toMatchObject({
      status: 409,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('quarantines a completed outcome that omits contractually required exact provider output', async () => {
    const store = new InMemoryManagedAiExactOutputStoreV1();
    const outcomeWithoutExactOutput = structuredClone(completedOutcome);
    delete outcomeWithoutExactOutput.exactOutput;
    const execute = vi.fn(() => Promise.resolve(outcomeWithoutExactOutput));
    const execution = createManagedAiExecutionRoutesV1({
      internalServiceSecret: secret,
      executor: { execute },
      exactOutputStore: store,
      now: () => '2026-08-25T00:00:02.000Z',
      ownerTokenFactory: () => 'missing-exact-output-owner'
    })[0]!;

    await expect(execution.handle(executionRequest())).rejects.toMatchObject({
      status: 503,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    await expect(execution.handle(executionRequest())).rejects.toMatchObject({
      status: 409,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('requires internal authorization on exact-output resolution', async () => {
    const store = new InMemoryManagedAiExactOutputStoreV1();
    const routes = createManagedAiExecutionRoutesV1({
      internalServiceSecret: secret,
      executor: { execute: () => Promise.resolve(completedOutcome) },
      exactOutputStore: store
    });

    await expect(
      routes[1]!.handle(resolutionRequest(durableRef, 'wrong-secret-with-more-than-32-bytes'))
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
  });
});
