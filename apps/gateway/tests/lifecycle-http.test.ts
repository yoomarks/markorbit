import { afterEach, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  type AuthenticatedUserPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createServiceRuntime, json, type ServiceRuntime } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayLifecycleRoutes } from '../src/lifecycle-http.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const secret = 'm5-wp06-internal-service-secret-32-bytes-minimum';
const csrfSecret = 'm5-wp06-csrf-secret';
const origin = 'https://markreg.test';
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function workspacePrincipal(token: string): WorkspacePrincipal {
  const permissions =
    token === 'customer'
      ? (['matter:read'] as const)
      : token === 'operations-read'
        ? (['matter:read', 'review:read'] as const)
        : token === 'operations'
          ? (['matter:read', 'review:read', 'review:perform'] as const)
          : (['matter:read', 'matter:manage'] as const);
  return {
    kind: 'WORKSPACE',
    sessionId: `session_${token}`,
    userId: `user_${token}`,
    workspaceId,
    membershipId: `membership_${token}`,
    role: token === 'operations' ? 'REVIEWER' : 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-08-11T00:00:00.000Z'
  };
}

const authenticationClient = {
  async resolveWorkspace(token: string, requestedWorkspaceId: string) {
    if (token === 'expired') throw new AuthenticationError('INVALID_SESSION', 'Session expired.');
    if (requestedWorkspaceId !== workspaceId)
      throw new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership required.');
    return workspacePrincipal(token);
  },
  async resolve(token: string): Promise<AuthenticatedUserPrincipal> {
    if (token === 'expired') throw new AuthenticationError('INVALID_SESSION', 'Session expired.');
    const principal = workspacePrincipal(token);
    return {
      kind: 'USER',
      sessionId: principal.sessionId,
      userId: principal.userId,
      sessionExpiresAt: principal.sessionExpiresAt
    };
  },
  async issue() {
    throw new Error('not used');
  },
  async revoke() {}
} as CoreAuthenticationClient;

async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

async function stack() {
  const markReg = createServiceRuntime(
    { name: 'markreg-wp06-gateway-test', port: 0, version: '1' },
    {
      routes: [
        {
          method: 'GET',
          path: '/v1/formal-matters/:formalMatterId/lifecycle',
          handle: () =>
            json(200, {
              lifecycle: {
                lifecycleViewId: 'lifecycle-view_wp06',
                state: 'CUSTOMER_ACTION_NEEDED',
                customerSafeLabel: 'Action required',
                officialStatusVerified: false
              },
              timeline: [],
              recommendedAction: null,
              noAction: true
            })
        },
        {
          method: 'GET',
          path: '/v1/operations/formal-matters/:formalMatterId/lifecycle-provenance',
          handle: () =>
            json(200, {
              currentView: { lifecycleViewId: 'lifecycle-view_wp06' },
              events: [
                {
                  lifecycleEventId: 'lifecycle-event_wp06',
                  source: {
                    reviewedSourceAdmission: {
                      id: 'reviewed-source-admission_wp06',
                      version: 1
                    }
                  }
                }
              ],
              recommendedAction: null
            })
        },
        {
          method: 'POST',
          path: '/v1/recommended-actions/:recommendedActionId/transition',
          handle: () =>
            json(409, {
              code: 'VERSION_CONFLICT',
              message: 'Recommended Action version changed before transition.'
            })
        }
      ]
    }
  );
  const execution = createServiceRuntime(
    { name: 'execution-wp06-gateway-test', port: 0, version: '1' },
    {
      routes: [
        {
          method: 'GET',
          path: '/internal/reviewed-source-admissions/:reviewedSourceAdmissionId/provenance',
          handle: () =>
            json(200, {
              admission: {
                reviewedSourceAdmissionId: 'reviewed-source-admission_wp06'
              },
              reviewDecision: {
                evidenceReviewDecisionId: 'evidence-review-decision_wp06',
                rationale: 'Reviewed by operations.'
              },
              correctionRequest: null,
              handoff: { status: 'DELIVERED', attemptCount: 2 }
            })
        }
      ]
    }
  );
  const [markRegUrl, executionUrl] = await Promise.all([start(markReg), start(execution)]);
  const gateway = createServiceRuntime(
    { name: 'gateway-wp06-test', port: 0, version: '1' },
    {
      routes: createGatewayLifecycleRoutes({
        markRegUrl,
        executionUrl,
        authenticationClient,
        internalServiceSecret: secret,
        csrfSecret,
        allowedOrigins: [origin]
      })
    }
  );
  return start(gateway);
}

function browserHeaders(token: string) {
  return {
    cookie: `mo_session=${token}`,
    'x-markorbit-workspace-id': workspaceId
  };
}

describe('M5-WP-06 Gateway lifecycle boundary', () => {
  it('keeps customer reads separate from Operations provenance permission', async () => {
    const base = await stack();
    const customer = await fetch(
      `${base}/api/markreg/formal-matters/formal-matter_wp06/lifecycle`,
      {
        headers: browserHeaders('customer')
      }
    );
    expect(customer.status).toBe(200);
    expect(await customer.json()).toMatchObject({ noAction: true });

    const denied = await fetch(
      `${base}/api/operations/formal-matters/formal-matter_wp06/lifecycle-provenance`,
      { headers: browserHeaders('customer') }
    );
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

    const readOnlyOperations = await fetch(
      `${base}/api/operations/formal-matters/formal-matter_wp06/lifecycle-provenance`,
      { headers: browserHeaders('operations-read') }
    );
    expect(readOnlyOperations.status).toBe(403);
  });

  it('composes governed MarkReg projection with Execution review and retry provenance', async () => {
    const base = await stack();
    const response = await fetch(
      `${base}/api/operations/formal-matters/formal-matter_wp06/lifecycle-provenance`,
      { headers: browserHeaders('operations') }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      currentView: { lifecycleViewId: 'lifecycle-view_wp06' },
      reviewSources: [
        {
          reviewDecision: { evidenceReviewDecisionId: 'evidence-review-decision_wp06' },
          handoff: { status: 'DELIVERED', attemptCount: 2 }
        }
      ]
    });
  });

  it('rejects an expired Session before Recommended Action acknowledgement', async () => {
    const base = await stack();
    const response = await fetch(
      `${base}/api/markreg/recommended-actions/recommended-action_wp06/acknowledge`,
      {
        method: 'POST',
        headers: {
          ...browserHeaders('expired'),
          origin,
          'content-type': 'application/json',
          'idempotency-key': 'wp06-expired',
          'x-markorbit-csrf-token': 'invalid'
        },
        body: JSON.stringify({ expectedVersion: 3 })
      }
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'INVALID_SESSION' });
  });

  it('enforces Origin and CSRF and preserves stale version rejection', async () => {
    const base = await stack();
    const missingOrigin = await fetch(
      `${base}/api/markreg/recommended-actions/recommended-action_wp06/acknowledge`,
      {
        method: 'POST',
        headers: {
          ...browserHeaders('manager'),
          'content-type': 'application/json',
          'idempotency-key': 'wp06-origin',
          'x-markorbit-csrf-token': csrfToken('session_manager', csrfSecret)
        },
        body: JSON.stringify({ expectedVersion: 3 })
      }
    );
    expect(missingOrigin.status).toBe(403);
    expect(await missingOrigin.json()).toMatchObject({ code: 'UNTRUSTED_ORIGIN' });

    const stale = await fetch(
      `${base}/api/markreg/recommended-actions/recommended-action_wp06/acknowledge`,
      {
        method: 'POST',
        headers: {
          ...browserHeaders('manager'),
          origin,
          'content-type': 'application/json',
          'idempotency-key': 'wp06-stale',
          'x-markorbit-csrf-token': csrfToken('session_manager', csrfSecret)
        },
        body: JSON.stringify({ expectedVersion: 3 })
      }
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
