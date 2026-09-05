from pathlib import Path
import json
import subprocess


def run(*args: str) -> None:
    subprocess.run(args, check=True)


source = Path('apps/gateway/src/markreg-early-funnel-http.ts')
text = source.read_text()
text = text.replace(
    "'matter:read permission is required for governed Examination reads.'",
    "'matter:read permission is required for governed MarkReg Matter reads.'",
    1,
)

if 'forwardWorkspaceActionRead' not in text:
    marker = "\n  const productionIntakeRoute: JsonRoute = {"
    block = r'''

  const forwardWorkspaceActionRead = async (
    request: JsonRequest,
    principal: WorkspacePrincipal
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${options.markRegUrl}/internal/v1/workspace-actions`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {})
        }
      });
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };
'''
    if marker not in text:
        raise SystemExit('forward insertion marker not found')
    text = text.replace(marker, block + marker, 1)

if "path: '/api/markreg/workspace-actions'" not in text:
    marker = "\n  const quoteRoute: JsonRoute = {"
    block = r'''

  const workspaceActionRoute: JsonRoute = {
    method: 'GET',
    path: '/api/markreg/workspace-actions',
    handle: async (request) => {
      const principal = await authenticateMatterRead(request);
      return forwardWorkspaceActionRead(request, principal);
    }
  };
'''
    if marker not in text:
        raise SystemExit('route insertion marker not found')
    text = text.replace(marker, block + marker, 1)

old = "    formalMatterEvidenceRoute,\n    formalMatterExaminationRoute\n  ];"
new = "    formalMatterEvidenceRoute,\n    formalMatterExaminationRoute,\n    workspaceActionRoute\n  ];"
if old in text:
    text = text.replace(old, new, 1)
elif 'workspaceActionRoute\n  ];' not in text:
    raise SystemExit('route return marker not found')
source.write_text(text)

inventory_path = Path('docs/architecture/GATEWAY_ROUTE_INVENTORY_MARKREG_EARLY_FUNNEL.json')
inventory = json.loads(inventory_path.read_text())
routes = inventory['routes']
route_path = '/api/markreg/workspace-actions'
if not any(route.get('path') == route_path and route.get('method') == 'GET' for route in routes):
    routes.append(
        {
            'method': 'GET',
            'path': route_path,
            'owner': 'markreg',
            'namespaceClass': 'PRIMARY_PRODUCT_API',
            'authenticationMode': 'COOKIE_AUTHENTICATED',
            'environmentScope': 'ALL_ENVIRONMENTS',
            'idempotencyRequirement': 'NOT_APPLICABLE_READ_ONLY',
            'authorityConsequenceResponse': 'NONE_EXTERNAL',
            'httpIntegrationTestFile': 'apps/gateway/tests/workspace-action-gateway.test.ts',
        }
    )
inventory_path.write_text(json.dumps(inventory, indent=2) + '\n')

validator = Path('scripts/validate-gateway-inventory.mjs')
text = validator.read_text()
auth_marker = "    row.path.startsWith('/api/markreg/recommended-actions') ||"
if "row.path.startsWith('/api/markreg/workspace-actions')" not in text:
    if auth_marker not in text:
        raise SystemExit('validator auth marker not found')
    text = text.replace(
        auth_marker,
        auth_marker + "\n    row.path.startsWith('/api/markreg/workspace-actions') ||",
        1,
    )
text = text.replace('assert.equal(source.length, 96);', 'assert.equal(source.length, 97);', 1)
text = text.replace('assert.equal(inventory.length, 96);', 'assert.equal(inventory.length, 97);', 1)
text = text.replace('  90\n);', '  91\n);', 1)
text = text.replace(
    "'Gateway inventory PASS: 96 runtime routes; authenticated Early Funnel, Production Intake, Matter Intelligence, Formal Matter Evidence, Examination, Checkout, Commercial Catalog, Payment, Order, Document Package, Evidence Review and Lifecycle boundaries included; test bootstrap excluded'",
    "'Gateway inventory PASS: 97 runtime routes; authenticated Early Funnel, Production Intake, Matter Intelligence, Formal Matter Evidence, Examination, Workspace Action, Checkout, Commercial Catalog, Payment, Order, Document Package, Evidence Review and Lifecycle boundaries included; test bootstrap excluded'",
    1,
)
validator.write_text(text)

test = Path('apps/gateway/tests/workspace-action-gateway.test.ts')
test.write_text(r'''import { afterEach, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type AuthenticatedUserPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createServiceRuntime, json, type ServiceRuntime } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime as createGateway } from '../src/index.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const secret = 'workspace-action-gateway-internal-secret-32-bytes';
const active: ServiceRuntime[] = [];
const observations: {
  method: string;
  body: unknown;
  headers: Readonly<Record<string, string | undefined>>;
}[] = [];

afterEach(async () => {
  observations.splice(0);
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});

function workspacePrincipal(token: string): WorkspacePrincipal {
  const permissions = token === 'denied' ? (['review:read'] as const) : (['matter:read'] as const);
  return {
    kind: 'WORKSPACE',
    sessionId: `session_${token}`,
    userId: `user_${token}`,
    workspaceId,
    membershipId: `membership_${token}`,
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-09-07T00:00:00.000Z'
  };
}

const authenticationClient = {
  resolveWorkspace(token: string, requestedWorkspaceId: string) {
    if (token === 'expired')
      return Promise.reject(new AuthenticationError('INVALID_SESSION', 'Session expired.'));
    if (requestedWorkspaceId !== workspaceId)
      return Promise.reject(new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership required.'));
    return Promise.resolve(workspacePrincipal(token));
  },
  resolve(token: string): Promise<AuthenticatedUserPrincipal> {
    if (token === 'expired')
      return Promise.reject(new AuthenticationError('INVALID_SESSION', 'Session expired.'));
    const principal = workspacePrincipal(token);
    return Promise.resolve({
      kind: 'AUTHENTICATED_USER',
      sessionId: principal.sessionId,
      userId: principal.userId,
      sessionExpiresAt: principal.sessionExpiresAt
    });
  },
  issue() {
    return Promise.reject(new Error('not used'));
  },
  revoke() {
    return Promise.resolve();
  }
} as CoreAuthenticationClient;

async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

const authorityConsequences = Object.freeze({
  protectedActionAuthorized: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentCreated: false,
  providerContacted: false,
  officeMutationCreated: false,
  officialTruthCreated: false
});

const currentItem = {
  formalMatter: {
    id: 'formal-matter_workspace-action-gateway',
    version: 1,
    trademark: 'ORBIT',
    applicant: 'Orbit Inc.',
    jurisdiction: 'US'
  },
  currentness: 'CURRENT',
  lifecycle: {
    id: 'lifecycle-view_workspace-action-gateway',
    version: 2,
    fingerprintSha256: 'a'.repeat(64),
    state: 'CUSTOMER_ACTION_NEEDED',
    customerSafeLabel: 'Customer action needed',
    customerSafeSummary: 'Reviewed evidence requires customer attention.',
    updatedAt: '2026-09-05T10:00:00.000Z',
    officialStatusVerified: false
  },
  attentionStatus: 'OPEN',
  recommendedAction: {
    id: 'recommended-action_workspace-action-gateway',
    version: 1,
    title: 'Review required action',
    explanation: 'Current governed lifecycle truth requires customer attention.',
    timingBasis: 'No governed due date is present; no deadline is inferred.',
    status: 'OPEN',
    executionAuthorized: false,
    updatedAt: '2026-09-05T10:00:00.000Z'
  },
  examination: {
    status: 'ESTABLISHED',
    workflowState: 'CUSTOMER_ACTION_NEEDED',
    eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
    customerSafeLabel: 'Customer action needed',
    customerSafeSummary: 'Reviewed evidence requires customer attention.',
    deadline: null,
    deadlineStatus: 'UNAVAILABLE',
    officialStatusVerified: false
  },
  lastChangedAt: '2026-09-05T10:00:00.000Z',
  officialStatusVerified: false,
  authorityConsequences
};

function projection(empty = false) {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-09-06T00:00:00.000Z',
    limit: 100,
    truncated: false,
    needsAttention: empty ? [] : [currentItem],
    waitingOrInProgress: [],
    recentlyChanged: empty ? [] : [currentItem],
    officialStatusVerified: false,
    authorityConsequences
  };
}

type OwnerMode = 'CURRENT' | 'EMPTY' | 'NOT_FOUND' | 'UNAVAILABLE';

async function stack(mode: OwnerMode = 'CURRENT', networkAvailable = true) {
  let markRegUrl = 'http://127.0.0.1:1';
  if (networkAvailable) {
    const markReg = createServiceRuntime(
      { name: 'markreg-workspace-action-gateway-test', port: 0, version: '1' },
      {
        routes: [
          {
            method: 'GET',
            path: '/internal/v1/workspace-actions',
            handle: (request) => {
              observations.push({
                method: request.method,
                body: request.body,
                headers: request.headers
              });
              if (mode === 'NOT_FOUND')
                return json(404, {
                  code: 'WORKSPACE_NOT_FOUND',
                  message: 'Workspace-scoped record was not found.'
                });
              if (mode === 'UNAVAILABLE')
                return json(503, {
                  code: 'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
                  message: 'Workspace Action truth is unavailable.',
                  retryable: true
                });
              return json(200, { workspaceActions: projection(mode === 'EMPTY') });
            }
          }
        ]
      }
    );
    markRegUrl = await start(markReg);
  }
  const gateway = createGateway({
    port: 0,
    markRegUrl,
    authenticationClient,
    internalServiceSecret: secret,
    csrfSecret: 'unused-for-get',
    allowedOrigins: []
  });
  return start(gateway);
}

function browserHeaders(token = 'customer', workspace = workspaceId) {
  return {
    cookie: `mo_session=${token}`,
    'x-markorbit-workspace-id': workspace
  };
}

const endpoint = (base: string) => `${base}/api/markreg/workspace-actions`;

describe('authenticated Workspace Action Projection V1 Gateway read', () => {
  it('forwards current and successful empty owner truth without reconstruction', async () => {
    for (const [mode, empty] of [
      ['CURRENT', false],
      ['EMPTY', true]
    ] as const) {
      const base = await stack(mode);
      const response = await fetch(endpoint(base), { headers: browserHeaders() });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ workspaceActions: projection(empty) });
    }
  });

  it('derives internal authority server-side and ignores browser internal/principal spoofing', async () => {
    const base = await stack();
    const trustedPrincipal = workspacePrincipal('customer');
    const response = await fetch(endpoint(base), {
      headers: {
        ...browserHeaders(),
        'x-markorbit-internal-authorization': 'browser-spoofed-secret',
        'x-markorbit-principal': 'browser-spoofed-principal',
        'x-request-id': 'request_workspace-action-gateway'
      }
    });
    expect(response.status).toBe(200);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ method: 'GET', body: undefined });
    expect(observations[0]?.headers['x-markorbit-internal-authorization']).toBe(secret);
    expect(observations[0]?.headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(observations[0]?.headers['x-markorbit-principal']).toBe(
      encodeInternalWorkspacePrincipal(trustedPrincipal)
    );
    expect(observations[0]?.headers['x-request-id']).toBe('request_workspace-action-gateway');
  });

  it('requires authenticated Workspace membership and matter:read before calling MarkReg', async () => {
    const base = await stack();

    const unauthenticated = await fetch(endpoint(base), {
      headers: { 'x-markorbit-workspace-id': workspaceId }
    });
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });

    const denied = await fetch(endpoint(base), { headers: browserHeaders('denied') });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

    const foreignWorkspace = await fetch(endpoint(base), {
      headers: browserHeaders('customer', otherWorkspaceId)
    });
    expect(foreignWorkspace.status).toBe(403);
    expect(await foreignWorkspace.json()).toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });

    expect(observations).toHaveLength(0);
  });

  it('preserves owner 404 and retryable 503 instead of fabricating successful empty truth', async () => {
    for (const [mode, status, code] of [
      ['NOT_FOUND', 404, 'WORKSPACE_NOT_FOUND'],
      ['UNAVAILABLE', 503, 'WORKSPACE_ACTION_TRUTH_UNAVAILABLE']
    ] as const) {
      const base = await stack(mode);
      const response = await fetch(endpoint(base), { headers: browserHeaders() });
      expect(response.status).toBe(status);
      const body: unknown = await response.json();
      expect(body).toMatchObject({ code });
      expect(body).not.toHaveProperty('workspaceActions.needsAttention');
    }
  });

  it('fails closed on owner network failure and exposes no mutation route', async () => {
    const unavailableBase = await stack('CURRENT', false);
    const unavailable = await fetch(endpoint(unavailableBase), { headers: browserHeaders() });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ code: 'DOWNSTREAM_UNAVAILABLE' });

    const base = await stack();
    const mutation = await fetch(endpoint(base), {
      method: 'POST',
      headers: {
        ...browserHeaders(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ workspaceId: otherWorkspaceId })
    });
    expect(mutation.status).toBe(405);
    expect(observations).toHaveLength(0);
  });
});
''')

run('pnpm', 'exec', 'prettier', '--write',
    'apps/gateway/src/markreg-early-funnel-http.ts',
    'apps/gateway/tests/workspace-action-gateway.test.ts',
    'docs/architecture/GATEWAY_ROUTE_INVENTORY_MARKREG_EARLY_FUNNEL.json',
    'scripts/validate-gateway-inventory.mjs')
run('pnpm', '--filter', '@markorbit/gateway', 'lint')
run('pnpm', '--filter', '@markorbit/gateway', 'typecheck')
run('pnpm', '--filter', '@markorbit/gateway', 'test', '--', 'workspace-action-gateway.test.ts')
run('node', 'scripts/validate-gateway-inventory.mjs')
run('git', 'config', 'user.name', 'github-actions[bot]')
run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
run('git', 'add',
    'apps/gateway/src/markreg-early-funnel-http.ts',
    'apps/gateway/tests/workspace-action-gateway.test.ts',
    'docs/architecture/GATEWAY_ROUTE_INVENTORY_MARKREG_EARLY_FUNNEL.json',
    'scripts/validate-gateway-inventory.mjs')
run('git', 'commit', '-m', '[INTEGRATION-P0][GATEWAY] Expose Workspace Action Projection V1')
run('git', 'push', 'origin', 'HEAD:integration/867-workspace-action-gateway')
