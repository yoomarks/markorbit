import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createClientNotificationFollowupRoutes } from '../src/client-notification-followup-http.js';
import { ClientNotificationFollowupError } from '../src/client-notification-followup.js';

const secret = 'client-notification-followup-http-secret-0123456789';
const workspaceId = '48484848-4848-4484-8484-484848484848';
const actionId = 'prepared-action_followup-http';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_followup_http',
  userId: 'user_followup_http',
  workspaceId,
  membershipId: 'membership_followup_http',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-13T12:00:00.000Z'
};

const result = {
  schemaVersion: 1,
  preparedActionId: actionId,
  state: 'COMPLETE',
  send: {
    sendId: 'managed-communication-send_followup-http',
    messageId: 'message_followup-http',
    threadRef: 'thread_followup-http',
    acceptedAt: '2026-09-12T12:00:00.000Z'
  },
  links: [],
  work: { state: 'NOT_APPLICABLE' },
  authority: {
    customerReceived: false,
    customerRead: false,
    customerResponded: false,
    legalNoticeEffective: false,
    customerTruthMutated: false,
    assetTruthMutated: false,
    matterTruthMutated: false,
    officialTruthCreated: false
  }
} as const;

function request(input: Partial<JsonRequest> = {}): JsonRequest {
  return {
    method: 'POST',
    path: `/v1/prepared-actions/${actionId}/client-notification-followup`,
    params: { preparedActionId: actionId },
    query: {},
    body: undefined,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal)
    },
    ...input
  };
}

function setup() {
  const service = {
    reconcile: vi.fn().mockResolvedValue(result)
  };
  const [route] = createClientNotificationFollowupRoutes({
    internalServiceSecret: secret,
    service
  });
  if (!route) throw new Error('Missing client-notification follow-up route.');
  return { route, service };
}

describe('client notification follow-up HTTP boundary', () => {
  it('derives all follow-up material from the trusted Prepared Action', async () => {
    const { route, service } = setup();
    expect(await route.handle(request())).toEqual({ status: 200, body: result });
    expect(service.reconcile).toHaveBeenCalledWith(workspaceId, actionId, principal);
  });

  it.each([
    { body: { sendId: 'spoof' } },
    { body: { target: 'spoof' } },
    { query: { retrySend: 'true' } }
  ])('rejects caller-supplied orchestration material %j', async (extra) => {
    const { route, service } = setup();
    await expect(route.handle(request(extra as Partial<JsonRequest>))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(service.reconcile).not.toHaveBeenCalled();
  });

  it('requires trusted internal authorization and matter:manage', async () => {
    const { route, service } = setup();
    await expect(
      route.handle(
        request({
          headers: { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal) }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });

    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    await expect(
      route.handle(
        request({
          headers: {
            'x-markorbit-internal-authorization': secret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          }
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(service.reconcile).not.toHaveBeenCalled();
  });

  it('maps bounded follow-up errors without inventing success', async () => {
    const { route, service } = setup();
    service.reconcile.mockRejectedValueOnce(
      new ClientNotificationFollowupError('PRECONDITION_FAILED', 'Not completed.', 409)
    );
    await expect(route.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'PRECONDITION_FAILED'
    });
  });
});
