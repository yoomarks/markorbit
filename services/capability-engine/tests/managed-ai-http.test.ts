import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import type { ManagedAiExecutionClaimStoreV1 } from '../src/managed-ai-execution-claim.js';
import {
  createManagedAiExecutionRoutesV1,
  type ManagedAiExecutionAuthorityV1
} from '../src/managed-ai-http.js';

const secret = 'managed-ai-internal-route-secret-32-bytes';
const correlationId = 'knowledge_assignment_1';
const idempotencyKey = 'knowledge_assignment_1:deepseek:attempt:1';

const input = (prompt = 'Summarize the grounded source pack.') => ({
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput: {
    schemaVersion: 1,
    kind: 'TEXT_GENERATION',
    prompt,
    systemInstruction: 'Return Markdown only.',
    outputFormat: 'MARKDOWN'
  },
  requestedOutput: {
    schemaId: 'knowledge.ai-distilled-markdown.v1',
    format: 'MARKDOWN'
  },
  requirements: {
    capabilities: ['text-generation'],
    maxLatencyMs: 45_000,
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: {
    policyId: 'knowledge.ai-distillation',
    policyVersion: '1'
  },
  evidence: {
    exactOutput: 'REQUIRED',
    providerRequestId: 'REQUIRED_WHEN_AVAILABLE'
  }
});

const blockedOutcome: ManagedAiExecutionOutcomeV1 = {
  schemaVersion: 1,
  capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
  capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  status: 'BLOCKED',
  deliveryState: 'NOT_DELIVERED',
  retryDisposition: 'RETRY_FORBIDDEN',
  error: {
    code: 'POLICY_BLOCKED',
    message: 'No trusted implementation profile matched.'
  },
  authority: managedAiNoAuthorityConsequences
};

function request(body: unknown = input(), headers: Record<string, string> = {}) {
  return {
    method: 'POST' as const,
    path: '/internal/v1/managed-ai-executions',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'idempotency-key': idempotencyKey,
      'x-correlation-id': correlationId,
      ...headers
    },
    body
  };
}

function route(
  executor: ManagedAiExecutionAuthorityV1,
  claimStore?: ManagedAiExecutionClaimStoreV1
) {
  return createManagedAiExecutionRoutesV1({
    internalServiceSecret: secret,
    executor,
    ...(claimStore === undefined ? {} : { claimStore }),
    now: () => '2026-08-25T00:00:00.000Z',
    ownerTokenFactory: () => 'unit-test-runtime-owner',
    claimLeaseMs: 60_000
  })[0]!;
}

describe('Capability Engine internal Managed AI execution route', () => {
  it('executes once and replays the governed outcome for the same idempotent request', async () => {
    const execute = vi.fn((...args: Parameters<ManagedAiExecutionAuthorityV1['execute']>) => {
      void args;
      return Promise.resolve(blockedOutcome);
    });
    const target = route({ execute });

    const first = await target.handle(request());
    const replay = await target.handle(request());

    expect(first).toEqual({ status: 200, body: blockedOutcome });
    expect(replay).toEqual(first);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toEqual(input());
    expect(execute.mock.calls[0]?.[1]).toEqual({
      executionId: `maiexec_${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32)}`,
      correlationId
    });
  });

  it('rejects untrusted internal callers before claim or executor access', async () => {
    const execute = vi.fn(() => Promise.resolve(blockedOutcome));
    const target = route({ execute });

    await expect(
      target.handle(
        request(input(), {
          'x-markorbit-internal-authorization': 'wrong-secret-value-with-at-least-32-bytes'
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('requires idempotency and correlation headers', async () => {
    const execute = vi.fn(() => Promise.resolve(blockedOutcome));
    const target = route({ execute });
    const noIdempotency = request(input(), { 'idempotency-key': '' });
    const noCorrelation = request(input(), { 'x-correlation-id': '' });

    await expect(target.handle(noIdempotency)).rejects.toMatchObject({
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
    await expect(target.handle(noCorrelation)).rejects.toMatchObject({
      status: 400,
      code: 'CORRELATION_ID_REQUIRED'
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects idempotency reuse with a different body or correlation id', async () => {
    const execute = vi.fn(() => Promise.resolve(blockedOutcome));
    const target = route({ execute });
    await target.handle(request());

    await expect(target.handle(request(input('Different prompt.')))).rejects.toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT'
    });
    await expect(
      target.handle(request(input(), { 'x-correlation-id': 'different_correlation' }))
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent identical requests while execution is in flight', async () => {
    let release: ((value: ManagedAiExecutionOutcomeV1) => void) | undefined;
    const pending = new Promise<ManagedAiExecutionOutcomeV1>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn(() => pending);
    const target = route({ execute });

    const first = target.handle(request());
    const second = target.handle(request());
    await Promise.resolve();
    expect(execute).toHaveBeenCalledTimes(1);
    release!(blockedOutcome);

    await expect(first).resolves.toEqual({ status: 200, body: blockedOutcome });
    await expect(second).resolves.toEqual({ status: 200, body: blockedOutcome });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fails invalid Managed AI input before executor access', async () => {
    const execute = vi.fn(() => Promise.resolve(blockedOutcome));
    const target = route({ execute });

    await expect(
      target.handle(request({ ...input(), provider: 'DEEPSEEK' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_MANAGED_AI_REQUEST' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails closed when an executor attempts authority escalation and quarantines replay', async () => {
    const invalidOutcome = {
      ...blockedOutcome,
      authority: {
        ...managedAiNoAuthorityConsequences,
        knowledgeApproved: true
      }
    };
    const execute = vi.fn(() => Promise.resolve(invalidOutcome));
    const target = route({ execute });

    await expect(target.handle(request())).rejects.toMatchObject({
      status: 502,
      code: 'MANAGED_AI_EXECUTOR_INVALID_RESULT'
    });
    await expect(target.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('blocks automatic replay after an executor exception once dispatch is possible', async () => {
    const execute = vi.fn(() => Promise.reject(new Error('boom')));
    const target = route({ execute });

    await expect(target.handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    await expect(target.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('never enters executor access when the durable dispatch transition cannot be recorded', async () => {
    const claim = vi.fn(() => Promise.resolve({ kind: 'ACQUIRED' as const }));
    const markDispatching = vi.fn(() => Promise.reject(new Error('database unavailable')));
    const complete = vi.fn(() => Promise.resolve());
    const markReconciliationRequired = vi.fn(() => Promise.resolve());
    const claimStore: ManagedAiExecutionClaimStoreV1 = {
      claim,
      markDispatching,
      complete,
      markReconciliationRequired
    };
    const execute = vi.fn(() => Promise.resolve(blockedOutcome));
    const target = route({ execute }, claimStore);

    await expect(target.handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'MANAGED_AI_CLAIM_STORE_UNAVAILABLE',
      retryable: true
    });
    expect(claim).toHaveBeenCalledTimes(1);
    expect(markDispatching).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });
});
