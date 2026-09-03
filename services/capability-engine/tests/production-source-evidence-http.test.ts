import { describe, expect, it, vi } from 'vitest';

import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';

import { capabilitySourceAdmissionNoAuthorityConsequences } from '../src/current-source-admission.js';
import { createCapabilityProductionSourceEvidenceRoutesV1 } from '../src/production-source-evidence-http.js';

const internalServiceSecret = 'production-source-http-secret-at-least-32-bytes';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_production_source_http',
  userId: 'principal_production_source_http',
  workspaceId: 'workspace_production_source_http',
  membershipId: 'membership_production_source_http',
  role: 'REVIEWER',
  permissions: ['workspace:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const reference = {
  schemaVersion: 1 as const,
  idempotencyKey: 'production-source-http-1',
  requestFingerprintSha256: 'a'.repeat(64),
  capabilityRequestId: 'capreq_production_source_http',
  sessionReceiptId: 'session-receipt_production_source_http'
};

function request(
  body: unknown = reference,
  headers: Record<string, string | undefined> = {}
): JsonRequest {
  return {
    method: 'POST',
    path: '/v1/production-source-evidence/read',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': internalServiceSecret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      'x-markorbit-caller-product': 'MARKREG',
      ...headers
    },
    body
  };
}

function replayFor(workspaceId = principal.workspaceId) {
  return {
    kind: 'REPLAY' as const,
    execution: {
      request: { caller: { workspaceId } }
    } as never
  };
}

describe('trusted Capability production source evidence HTTP boundary', () => {
  it('allows MarkReg to replay one exact producer-issued reference in the same Workspace', async () => {
    const reader = {
      read: vi.fn(() =>
        Promise.resolve({
          schemaVersion: 1 as const,
          status: 'NOT_FOUND' as const,
          reference,
          authority: capabilitySourceAdmissionNoAuthorityConsequences
        })
      )
    };
    const replayStore = { inspect: vi.fn(() => Promise.resolve(replayFor())) };
    const route = createCapabilityProductionSourceEvidenceRoutesV1({
      reader,
      replayStore,
      internalServiceSecret
    })[0]!;

    const response = await route.handle(request());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'NOT_FOUND', reference });
    expect(reader.read).toHaveBeenCalledWith(reference);
  });

  it('privacy-safely hides a durable replay that belongs to another Workspace', async () => {
    const reader = { read: vi.fn() };
    const replayStore = {
      inspect: vi.fn(() => Promise.resolve(replayFor('workspace_other')))
    };
    const route = createCapabilityProductionSourceEvidenceRoutesV1({
      reader: reader as never,
      replayStore,
      internalServiceSecret
    })[0]!;

    await expect(route.handle(request())).rejects.toMatchObject({
      status: 404,
      code: 'PRODUCTION_SOURCE_EVIDENCE_NOT_FOUND'
    });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('rejects untrusted, non-MarkReg and malformed reads before producer materialization', async () => {
    const reader = { read: vi.fn() };
    const replayStore = { inspect: vi.fn(() => Promise.resolve(replayFor())) };
    const route = createCapabilityProductionSourceEvidenceRoutesV1({
      reader: reader as never,
      replayStore,
      internalServiceSecret
    })[0]!;

    await expect(
      route.handle(
        request(reference, {
          'x-markorbit-internal-authorization': 'not-the-trusted-secret'
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
    await expect(
      route.handle(request(reference, { 'x-markorbit-caller-product': 'LITE' }))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    await expect(route.handle(request({ schemaVersion: 1 }))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_PRODUCTION_SOURCE_REFERENCE'
    });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('delegates replay-store outages to the owner read service typed fail-closed result', async () => {
    const reader = {
      read: vi.fn(() =>
        Promise.resolve({
          schemaVersion: 1 as const,
          status: 'UNAVAILABLE' as const,
          reference,
          retryable: true,
          denial: { code: 'PERSISTENCE_UNAVAILABLE', reason: 'forced outage' },
          authority: capabilitySourceAdmissionNoAuthorityConsequences
        })
      )
    };
    const replayStore = {
      inspect: vi.fn(() => Promise.reject(new Error('database unavailable')))
    };
    const route = createCapabilityProductionSourceEvidenceRoutesV1({
      reader,
      replayStore,
      internalServiceSecret
    })[0]!;

    const response = await route.handle(request());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UNAVAILABLE',
      retryable: true,
      denial: { code: 'PERSISTENCE_UNAVAILABLE' }
    });
    expect(reader.read).toHaveBeenCalledTimes(1);
  });
});
