import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  csrfToken,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
} from '../src/auth.js';
import { createGatewayNotificationAutomationRoutesV1 } from '../src/notification-automation-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000001370';
const userId = '018f0000-0000-7000-8000-000000001371';
const membershipId = '018f0000-0000-7000-8000-000000001372';
const sessionId = '018f0000-0000-7000-8000-000000001373';
const notificationRuleId = 'channel-notification-rule_gateway-test';
const csrfSecret = 'gateway-notification-csrf-secret-0123456789';
const authenticatedAt = '2026-09-20T00:00:00.000Z';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  workspaceId,
  membershipId,
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'workspace:manage'],
  sessionCreatedAt: authenticatedAt,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

function receipt(input: GovernedHumanActionReceiptMaterializationV1): GovernedHumanActionReceiptV1 {
  const receiptId = '018f0000-0000-7000-8000-000000001374';
  return {
    ...input,
    schemaVersion: 1,
    receiptId,
    receiptVersion: 1,
    authorityReference: `core-governed-human-action-receipt:${receiptId}:v1`,
    authorityVersion: 1,
    affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${receiptId}:v1`,
    source: 'CORE',
    actorKind: 'HUMAN_USER',
    workspaceVersion: 1,
    userVersion: 1,
    membershipVersion: 1,
    createdAt: authenticatedAt
  };
}

function authentication(
  materialize: (
    input: GovernedHumanActionReceiptMaterializationV1
  ) => Promise<GovernedHumanActionReceiptV1>
): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not expected')),
    resolve: () => Promise.reject(new Error('not expected')),
    resolveWorkspace: vi.fn(() => Promise.resolve(principal)),
    materializeGovernedHumanActionReceipt: materialize,
    revoke: () => Promise.resolve()
  };
}

function request(body: Record<string, unknown>): JsonRequest {
  return {
    method: 'POST',
    path: `/api/lite/notification-automation-rules/${notificationRuleId}/activate`,
    params: { notificationRuleId },
    query: {},
    body,
    headers: {
      cookie: 'mo_session=gateway-notification-session',
      origin: 'https://app.example',
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
      'idempotency-key': 'notification-activate-1370',
      'x-correlation-id': 'correlation-1370'
    }
  };
}

describe('Gateway Notification Automation activation boundary', () => {
  it('materializes Core human authority then forwards only the generated evidence reference to Lite', async () => {
    const materialize = vi.fn((input: GovernedHumanActionReceiptMaterializationV1) =>
      Promise.resolve(receipt(input))
    );
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ACTIVE' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const [route] = createGatewayNotificationAutomationRoutesV1({
      liteUrl: 'http://lite.test',
      authenticationClient: authentication(materialize),
      internalServiceSecret: 'internal-secret',
      csrfSecret,
      allowedOrigins: ['https://app.example'],
      fetchImpl
    });

    await route!.handle(request({ expectedVersion: 1 }));
    expect(materialize).toHaveBeenCalledTimes(1);
    expect(materialize.mock.calls[0]![0]).toMatchObject({
      kind: 'NOTIFICATION_AUTOMATION_ACTIVATE',
      workspaceId,
      userId,
      membershipId,
      mutationRoute: `/api/lite/notification-automation-rules/${notificationRuleId}/activate`,
      idempotencyKey: 'notification-activate-1370'
    });
    expect(materialize.mock.calls[0]![0].reviewedActionDigest).toMatch(/^[0-9a-f]{64}$/);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      `http://lite.test/internal/notification-automation-rules/${notificationRuleId}/activate`
    );
    expect(init).toBeDefined();
    expect(typeof init!.body).toBe('string');
    const forwarded = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(forwarded).toEqual({
      expectedVersion: 1,
      governanceEvidenceRef: receipt(materialize.mock.calls[0]![0]).authorityReference
    });
    expect(forwarded).not.toHaveProperty('humanReceipt');
    expect(forwarded).not.toHaveProperty('activationEvidence');
    expect(init!.headers).toMatchObject({
      'x-markorbit-internal-authorization': 'internal-secret',
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'notification-activate-1370'
    });
  });

  it('rejects browser-supplied governance authority before calling Core or Lite', async () => {
    const materialize = vi.fn((input: GovernedHumanActionReceiptMaterializationV1) =>
      Promise.resolve(receipt(input))
    );
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.reject(new Error('Lite must not be called'));
    });
    const [route] = createGatewayNotificationAutomationRoutesV1({
      liteUrl: 'http://lite.test',
      authenticationClient: authentication(materialize),
      internalServiceSecret: 'internal-secret',
      csrfSecret,
      allowedOrigins: ['https://app.example'],
      fetchImpl
    });

    await expect(
      route!.handle(
        request({
          expectedVersion: 1,
          governanceEvidenceRef: 'browser-self-asserted'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(materialize).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
