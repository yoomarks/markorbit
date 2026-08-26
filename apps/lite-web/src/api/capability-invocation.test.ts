import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CapabilityInvocationHttpError,
  createCapabilityInvocationClient,
  type CapabilityInvocationCommand
} from './capability.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function parsedBody(init: RequestInit | undefined): Record<string, unknown> {
  expect(typeof init?.body).toBe('string');
  if (typeof init?.body !== 'string') throw new Error('Expected JSON request body.');
  return JSON.parse(init.body) as Record<string, unknown>;
}

function command(): CapabilityInvocationCommand {
  return {
    schemaVersion: 2,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    purpose: 'Prepare one non-authoritative workspace brief.',
    input: { topic: 'trademark monitoring' },
    inputSchemaId: 'managed-ai-input.v1',
    outputSchemaId: 'managed-ai-output.v1',
    riskClass: 'MODERATE',
    idempotencyKey: 'lite-capability-test-1',
    correlationId: 'correlation_lite_capability_test'
  };
}

function sessionResponse(): Response {
  return new Response(JSON.stringify({ csrfToken: 'csrf_test' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function governedResponse(replayed = false): Response {
  return new Response(
    JSON.stringify({
      request: { capabilityRequestId: 'capreq_test' },
      eligibility: { eligible: true },
      composition: { mode: 'SINGLE_IMPLEMENTATION' },
      binding: { implementationBindingId: 'implementation-binding_test' },
      invocation: { capabilityInvocationId: 'capability-invocation_test' },
      outcome: { capabilityOutcomeId: 'capability-outcome_test', status: 'SUCCEEDED' },
      returnValue: { capabilityReturnId: 'capability-return_test', status: 'COMPLETED' },
      receipt: { sessionReceiptId: 'session-receipt_test' },
      replayed
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Lite governed Capability invocation client', () => {
  it('sends only the schema-independent command with trusted workspace, CSRF, idempotency and correlation headers', async () => {
    let invocationUrl = '';
    let invocationInit: RequestInit | undefined;
    let calls = 0;
    const fetchMock: typeof fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) return Promise.resolve(sessionResponse());
      invocationUrl = requestUrl(input);
      invocationInit = init;
      return Promise.resolve(governedResponse());
    });
    vi.stubGlobal('fetch', fetchMock);

    const supplied = {
      ...command(),
      caller: { workspaceId: 'spoofed' },
      provider: 'caller-provider',
      model: 'caller-model',
      credentialRef: 'caller-secret',
      implementationProfileId: 'implementation-profile_spoofed'
    } as CapabilityInvocationCommand;
    await createCapabilityInvocationClient(workspaceId).invoke(supplied);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(invocationUrl).toContain('/api/lite/capability-requests');
    expect(invocationInit?.method).toBe('POST');
    expect(invocationInit?.credentials).toBe('include');
    const headers = new Headers(invocationInit?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf_test');
    expect(headers.get('idempotency-key')).toBe(supplied.idempotencyKey);
    expect(headers.get('x-correlation-id')).toBe(supplied.correlationId);
    expect(parsedBody(invocationInit)).toEqual(command());
  });

  it('preserves governed replay metadata returned by the runtime', async () => {
    let calls = 0;
    const fetchMock: typeof fetch = vi.fn(() => {
      calls += 1;
      return Promise.resolve(calls === 1 ? sessionResponse() : governedResponse(true));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCapabilityInvocationClient(workspaceId).invoke(command());

    expect(result.replayed).toBe(true);
    expect(result.request.capabilityRequestId).toBe('capreq_test');
    expect(result.binding.implementationBindingId).toBe('implementation-binding_test');
    expect(result.receipt.sessionReceiptId).toBe('session-receipt_test');
  });

  it('preserves typed downstream rejection status, code and details', async () => {
    let calls = 0;
    const fetchMock: typeof fetch = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve(sessionResponse());
      return Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'NO_APPROVED_IMPLEMENTATION',
            message: 'No approved implementation profile is available.',
            details: { capabilityId: 'managed-ai-execution' }
          }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await createCapabilityInvocationClient(workspaceId).invoke(command());
      throw new Error('Expected governed invocation rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(CapabilityInvocationHttpError);
      expect(error).toMatchObject({
        status: 409,
        code: 'NO_APPROVED_IMPLEMENTATION',
        details: { capabilityId: 'managed-ai-execution' }
      });
    }
  });

  it('maps invocation transport failure without leaking authority fields', async () => {
    let calls = 0;
    const fetchMock: typeof fetch = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve(sessionResponse());
      return Promise.reject(new Error('connection reset'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCapabilityInvocationClient(workspaceId).invoke(command())
    ).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE',
      details: { cause: 'connection reset' }
    });
  });
});
