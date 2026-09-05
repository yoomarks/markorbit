from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f'missing patch marker: {label}')
    target.write_text(text.replace(old, new, 1))


# Preserve Core's real session creation timestamp as optional principal metadata so existing
# principal fixtures remain source-compatible while production governed ingress can fail closed
# when the timestamp is absent.
replace_once(
    'packages/contracts/src/auth.ts',
    """export interface AuthenticatedUserPrincipal {\n  kind: 'AUTHENTICATED_USER';\n  sessionId: string;\n  userId: string;\n  sessionExpiresAt: string;\n}\nexport interface WorkspacePrincipal {\n  kind: 'WORKSPACE';\n  sessionId: string;\n  userId: string;\n  workspaceId: string;\n  membershipId: string;\n  role: Role;\n  permissions: readonly Permission[];\n  sessionExpiresAt: string;\n}\n""",
    """export interface AuthenticatedUserPrincipal {\n  kind: 'AUTHENTICATED_USER';\n  sessionId: string;\n  userId: string;\n  sessionCreatedAt?: string;\n  sessionExpiresAt: string;\n}\nexport interface WorkspacePrincipal {\n  kind: 'WORKSPACE';\n  sessionId: string;\n  userId: string;\n  workspaceId: string;\n  membershipId: string;\n  role: Role;\n  permissions: readonly Permission[];\n  sessionCreatedAt?: string;\n  sessionExpiresAt: string;\n}\n""",
    'principal sessionCreatedAt contract'
)
replace_once(
    'packages/contracts/src/auth.ts',
    """    [p.sessionId, p.userId, p.workspaceId, p.membershipId, p.sessionExpiresAt].some(\n      (x) => typeof x !== 'string' || x.length === 0\n    )\n""",
    """    [p.sessionId, p.userId, p.workspaceId, p.membershipId, p.sessionExpiresAt].some(\n      (x) => typeof x !== 'string' || x.length === 0\n    ) ||\n    (p.sessionCreatedAt !== undefined &&\n      (typeof p.sessionCreatedAt !== 'string' || !Number.isFinite(Date.parse(p.sessionCreatedAt))))\n""",
    'principal sessionCreatedAt parser'
)

replace_once(
    'services/core/src/auth.ts',
    """      kind: 'AUTHENTICATED_USER',\n      sessionId: row.sessionId,\n      userId: row.userId,\n      sessionExpiresAt: row.expiresAt\n""",
    """      kind: 'AUTHENTICATED_USER',\n      sessionId: row.sessionId,\n      userId: row.userId,\n      sessionCreatedAt: row.createdAt,\n      sessionExpiresAt: row.expiresAt\n""",
    'resolved session creation timestamp'
)
replace_once(
    'services/core/src/auth.ts',
    """      permissions: Object.freeze(permissions),\n      sessionExpiresAt: principal.sessionExpiresAt\n""",
    """      permissions: Object.freeze(permissions),\n      sessionCreatedAt: principal.sessionCreatedAt,\n      sessionExpiresAt: principal.sessionExpiresAt\n""",
    'workspace principal creation timestamp'
)

path = Path('apps/gateway/src/mgsn-http.ts')
text = path.read_text()
text = "import { createHash } from 'node:crypto';\n" + text
text = text.replace(
    "export const PROVIDER_WORKSPACE_HEADER_NAME = 'x-markorbit-provider-workspace-id';\n",
    """export const PROVIDER_WORKSPACE_HEADER_NAME = 'x-markorbit-provider-workspace-id';\nexport const GOVERNED_HUMAN_ACTION_HEADER_NAME =\n  'x-markorbit-governed-network-human-action' as const;\n""",
    1
)
text = text.replace(
    """type RouteMethod = 'GET' | 'POST';\ntype RouteDefinition = readonly [RouteMethod, string];\ntype NetworkParticipationOwnerAuthority = 'read' | 'manage';\n""",
    """type RouteMethod = 'GET' | 'POST';\ntype RouteDefinition = readonly [RouteMethod, string];\ntype NetworkParticipationOwnerAuthority = 'read' | 'manage';\ntype GovernedHumanActionKind = 'PROVIDER_SELECTION' | 'CONTROLLED_HANDOFF';\ntype GovernedPermission = 'workspace:read' | 'workspace:manage';\ninterface GovernedRouteDefinition {\n  method: 'POST';\n  path: string;\n  permission: GovernedPermission;\n  idempotency: boolean;\n  humanAction?: GovernedHumanActionKind;\n}\n""",
    1
)
marker = """const networkParticipationRoutes: readonly RouteDefinition[] = [\n"""
governed = """const governedRoutes: readonly GovernedRouteDefinition[] = [\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/discovery/evaluate',\n    permission: 'workspace:read',\n    idempotency: false\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/selections',\n    permission: 'workspace:manage',\n    idempotency: true,\n    humanAction: 'PROVIDER_SELECTION'\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/selections/:providerSelectionId/revoke',\n    permission: 'workspace:manage',\n    idempotency: true,\n    humanAction: 'PROVIDER_SELECTION'\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/selections/:providerSelectionId/validate-current',\n    permission: 'workspace:read',\n    idempotency: false\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/handoffs',\n    permission: 'workspace:manage',\n    idempotency: true,\n    humanAction: 'CONTROLLED_HANDOFF'\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/handoffs/:controlledHandoffId/revoke',\n    permission: 'workspace:manage',\n    idempotency: true,\n    humanAction: 'CONTROLLED_HANDOFF'\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/handoffs/:controlledHandoffId/validate-current',\n    permission: 'workspace:read',\n    idempotency: false\n  },\n  {\n    method: 'POST',\n    path: '/api/mgsn/governed-network/allocations',\n    permission: 'workspace:manage',\n    idempotency: true\n  }\n];\n\n"""
if marker not in text:
    raise SystemExit('missing governed route insertion marker')
text = text.replace(marker, governed + marker, 1)

helper_marker = """function requireNetworkParticipationPermission(\n"""
helpers = """function requireGovernedPermission(principal: WorkspacePrincipal, permission: GovernedPermission) {\n  if (!principal.permissions.includes(permission))\n    throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);\n}\n\nfunction stableSerialize(value: unknown): string {\n  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;\n  if (value && typeof value === 'object') {\n    const entries = Object.entries(value as Record<string, unknown>)\n      .filter(([, item]) => item !== undefined)\n      .sort(([left], [right]) => left.localeCompare(right));\n    return `{${entries\n      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)\n      .join(',')}}`;\n  }\n  return JSON.stringify(value);\n}\n\nfunction fingerprint(value: unknown): string {\n  return createHash('sha256').update(stableSerialize(value)).digest('hex');\n}\n\nfunction requireGovernedIdempotency(request: JsonRequest): string {\n  const key = request.headers['idempotency-key']?.trim();\n  if (!key)\n    throw new HttpError(\n      400,\n      'IDEMPOTENCY_KEY_REQUIRED',\n      'Idempotency-Key is required for governed-network mutations.'\n    );\n  return key;\n}\n\nfunction forbidBrowserGovernedAuthority(request: JsonRequest): void {\n  if (request.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME])\n    throw new HttpError(\n      400,\n      'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN',\n      'Browser-supplied governed-network authority is not accepted.'\n    );\n}\n\nfunction governedHumanActionEnvelope(\n  request: JsonRequest,\n  principal: WorkspacePrincipal,\n  kind: GovernedHumanActionKind\n): string {\n  const authenticatedAt = principal.sessionCreatedAt;\n  if (!authenticatedAt || !Number.isFinite(Date.parse(authenticatedAt)))\n    throw new HttpError(\n      503,\n      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',\n      'Core session authentication time is unavailable for governed human action.',\n      true\n    );\n  const idempotencyKey = requireGovernedIdempotency(request);\n  const principalReference = `core-workspace-principal:${fingerprint({\n    kind: principal.kind,\n    workspaceId: principal.workspaceId.toLowerCase(),\n    userId: principal.userId,\n    membershipId: principal.membershipId,\n    role: principal.role,\n    permissions: [...principal.permissions].sort(),\n    sessionCreatedAt: authenticatedAt,\n    sessionExpiresAt: principal.sessionExpiresAt\n  })}`;\n  const actionFingerprint = fingerprint({\n    kind,\n    principalReference,\n    method: request.method,\n    path: request.path,\n    idempotencyKey,\n    body: request.body ?? {}\n  });\n  return Buffer.from(\n    JSON.stringify({\n      schemaVersion: 1,\n      kind,\n      actorKind: 'HUMAN_USER',\n      workspaceId: principal.workspaceId,\n      userId: principal.userId,\n      membershipId: principal.membershipId,\n      principalReference,\n      authorityReference: `gateway-governed-action:${kind.toLowerCase()}:${actionFingerprint}`,\n      authorityVersion: 1,\n      authenticatedAt,\n      affirmativeHumanActionEvidenceReference: `gateway-human-action:${kind.toLowerCase()}:${actionFingerprint}`,\n      payloadIdentityAuthoritative: false\n    }),\n    'utf8'\n  ).toString('base64url');\n}\n\n"""
if helper_marker not in text:
    raise SystemExit('missing helper insertion marker')
text = text.replace(helper_marker, helpers + helper_marker, 1)

resolve_marker = """  const forward = async (\n"""
resolve_governed = """  const resolveGovernedPrincipal = async (request: JsonRequest) => {\n    const workspaceId = request.headers['x-markorbit-workspace-id'];\n    if (!workspaceId)\n      throw new HttpError(\n        400,\n        'INVALID_WORKSPACE_CONTEXT',\n        'Trusted Workspace header is required for governed-network operations.'\n      );\n    try {\n      return await authentication().resolveWorkspace(\n        requestToken(request),\n        workspaceId,\n        correlation(request)\n      );\n    } catch (error) {\n      return mapAuthentication(error);\n    }\n  };\n"""
if resolve_marker not in text:
    raise SystemExit('missing governed resolver marker')
text = text.replace(resolve_marker, resolve_governed + resolve_marker, 1)

text = text.replace(
    """    provider: boolean,\n    networkParticipationOwnerAuthority?: NetworkParticipationOwnerAuthority\n  ) => {\n""",
    """    provider: boolean,\n    networkParticipationOwnerAuthority?: NetworkParticipationOwnerAuthority,\n    governedHumanAction?: string\n  ) => {\n""",
    1
)
text = text.replace(
    """            ...(networkParticipationOwnerAuthority\n              ? {\n                  'x-markorbit-network-participation-owner-authority':\n                    networkParticipationOwnerAuthority\n                }\n              : {}),\n""",
    """            ...(networkParticipationOwnerAuthority\n              ? {\n                  'x-markorbit-network-participation-owner-authority':\n                    networkParticipationOwnerAuthority\n                }\n              : {}),\n            ...(governedHumanAction\n              ? { [GOVERNED_HUMAN_ACTION_HEADER_NAME]: governedHumanAction }\n              : {}),\n""",
    1
)

handle_marker = """  const handleNetworkParticipation = async (request: JsonRequest) => {\n"""
handle_governed = """  const handleGoverned = async (request: JsonRequest, route: GovernedRouteDefinition) => {\n    try {\n      const principal = await resolveGovernedPrincipal(request);\n      requireGovernedPermission(principal, route.permission);\n      requireTrustedOrigin(request.headers.origin, options.allowedOrigins);\n      validateCsrf(\n        principal.sessionId,\n        options.csrfSecret,\n        request.headers['x-markorbit-csrf-token']\n      );\n      forbidBrowserGovernedAuthority(request);\n      if (route.idempotency) requireGovernedIdempotency(request);\n      const humanAction = route.humanAction\n        ? governedHumanActionEnvelope(request, principal, route.humanAction)\n        : undefined;\n      return forward(request, principal, false, undefined, humanAction);\n    } catch (error) {\n      return mapAuthentication(error);\n    }\n  };\n"""
if handle_marker not in text:
    raise SystemExit('missing governed handler marker')
text = text.replace(handle_marker, handle_governed + handle_marker, 1)

return_marker = """  return [\n    ...networkParticipationRoutes.map(([method, path]): JsonRoute => ({\n"""
return_replacement = """  return [\n    ...governedRoutes.map((route): JsonRoute => ({\n      method: route.method,\n      path: route.path,\n      handle: (request) => handleGoverned(request, route)\n    })),\n    ...networkParticipationRoutes.map(([method, path]): JsonRoute => ({\n"""
if return_marker not in text:
    raise SystemExit('missing governed route return marker')
text = text.replace(return_marker, return_replacement, 1)
path.write_text(text)

# Focused Gateway boundary proof. A deliberately dumb downstream captures the exact transport;
# MGSN owner semantics remain covered in services/mgsn tests.
Path('apps/gateway/tests/mgsn-governed-network-http.test.ts').write_text(r'''import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createGateway,
  csrfToken,
  GOVERNED_HUMAN_ACTION_HEADER_NAME,
  type CoreAuthenticationClient
} from '../src/index.js';

const secret = 'governed-workplace-internal-secret-123456789';
const csrfSecret = 'governed-workplace-csrf-secret';
const origin = 'https://workplace.markorbit.test';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const sessionCreatedAt = '2026-09-05T08:00:00.000Z';
const sessionExpiresAt = '2026-09-05T20:00:00.000Z';
const active: ServiceRuntime[] = [];
let downstream: Server | undefined;
let base = '';
let downstreamUrl = '';
let captured: Array<{ path: string; headers: Record<string, string | string[] | undefined>; body: unknown }> = [];

function principal(
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'workspace:manage'],
  includeCreatedAt = true
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session-governed-user',
    userId: 'user_governed',
    workspaceId,
    membershipId: 'membership-governed',
    role: 'WORKSPACE_ADMIN',
    permissions,
    ...(includeCreatedAt ? { sessionCreatedAt } : {}),
    sessionExpiresAt
  };
}

function authenticationFor(value: WorkspacePrincipal): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not used')),
    resolve: () =>
      Promise.resolve({
        kind: 'AUTHENTICATED_USER',
        sessionId: value.sessionId,
        userId: value.userId,
        ...(value.sessionCreatedAt ? { sessionCreatedAt: value.sessionCreatedAt } : {}),
        sessionExpiresAt: value.sessionExpiresAt
      }),
    resolveWorkspace: (_token, requestedWorkspaceId) => {
      if (requestedWorkspaceId !== workspaceId)
        return Promise.reject(new Error('unexpected workspace in test'));
      return Promise.resolve(value);
    },
    revoke: () => Promise.resolve()
  };
}

async function startDownstream() {
  downstream = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      captured.push({
        path: request.url ?? '',
        headers: request.headers,
        body: raw ? JSON.parse(raw) : null
      });
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => downstream!.listen(0, '127.0.0.1', resolve));
  const address = downstream.address();
  if (!address || typeof address === 'string') throw new Error('downstream did not bind');
  downstreamUrl = `http://127.0.0.1:${address.port}`;
}

async function startGateway(value = principal(), mgsnUrl = downstreamUrl) {
  const gateway = createGateway({
    port: 0,
    mgsnUrl,
    authenticationClient: authenticationFor(value),
    internalServiceSecret: secret,
    csrfSecret,
    allowedOrigins: [origin]
  });
  active.push(gateway);
  await gateway.start();
  base = `http://127.0.0.1:${gateway.listeningPort}`;
}

function headers(key = 'governed-action-key') {
  const p = principal();
  return {
    cookie: 'mo_session=opaque',
    'x-markorbit-workspace-id': workspaceId,
    origin,
    'x-markorbit-csrf-token': csrfToken(p.sessionId, csrfSecret),
    'idempotency-key': key,
    'content-type': 'application/json'
  };
}

function decodeHumanAction(value: string | string[] | undefined) {
  if (typeof value !== 'string') throw new Error('human action header missing');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
}

beforeEach(async () => {
  captured = [];
  await startDownstream();
  await startGateway();
});

afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
  if (downstream)
    await new Promise<void>((resolve, reject) =>
      downstream!.close((error) => (error ? reject(error) : resolve()))
    );
  downstream = undefined;
});

describe('Workplace governed-network Gateway transport', () => {
  it('forwards Discovery only with the trusted Workspace Principal', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/discovery/evaluate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ schemaVersion: 1, purpose: 'PROVIDER_DISCOVERY' })
    });
    expect(response.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.path).toBe('/v1/governed-network/discovery/evaluate');
    expect(captured[0]!.headers['x-markorbit-principal']).toBeTypeOf('string');
    expect(captured[0]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME]).toBeUndefined();
  });

  it('builds stable server-side Selection human-action evidence for exact replay', async () => {
    const body = { schemaVersion: 1, acknowledgement: { affirmativeHumanAction: true } };
    for (let index = 0; index < 2; index++) {
      const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
        method: 'POST',
        headers: headers('selection-replay-key'),
        body: JSON.stringify(body)
      });
      expect(response.status).toBe(200);
    }
    const first = captured[0]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME];
    const second = captured[1]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME];
    expect(first).toBe(second);
    const envelope = decodeHumanAction(first);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      kind: 'PROVIDER_SELECTION',
      actorKind: 'HUMAN_USER',
      workspaceId,
      userId: 'user_governed',
      membershipId: 'membership-governed',
      authorityVersion: 1,
      authenticatedAt: sessionCreatedAt,
      payloadIdentityAuthoritative: false
    });
    expect(String(envelope.principalReference)).not.toContain('session-governed-user');
  });

  it('keeps Selection and Handoff authority domains distinct', async () => {
    const selection = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('same-browser-key'),
      body: JSON.stringify({ action: 'selection' })
    });
    const handoff = await fetch(`${base}/api/mgsn/governed-network/handoffs`, {
      method: 'POST',
      headers: headers('same-browser-key'),
      body: JSON.stringify({ action: 'handoff' })
    });
    expect(selection.status).toBe(200);
    expect(handoff.status).toBe(200);
    const selectionEnvelope = decodeHumanAction(
      captured[0]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME]
    );
    const handoffEnvelope = decodeHumanAction(
      captured[1]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME]
    );
    expect(selectionEnvelope.kind).toBe('PROVIDER_SELECTION');
    expect(handoffEnvelope.kind).toBe('CONTROLLED_HANDOFF');
    expect(selectionEnvelope.authorityReference).not.toBe(handoffEnvelope.authorityReference);
    expect(selectionEnvelope.affirmativeHumanActionEvidenceReference).not.toBe(
      handoffEnvelope.affirmativeHumanActionEvidenceReference
    );
  });

  it('does not treat generic execution:manage as governed human authority', async () => {
    await active.pop()!.stop();
    await startGateway(principal(['execution:read', 'execution:manage']));
    const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('execution-only-key'),
      body: JSON.stringify({ action: 'must-fail' })
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PERMISSION_DENIED');
    expect(captured).toHaveLength(0);
  });

  it('requires trusted Workspace header and never falls back to body identity', async () => {
    const requestHeaders = headers();
    delete (requestHeaders as Record<string, string>)['x-markorbit-workspace-id'];
    const response = await fetch(`${base}/api/mgsn/governed-network/discovery/evaluate`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ workspaceId, purpose: 'PROVIDER_DISCOVERY' })
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_WORKSPACE_CONTEXT');
    expect(captured).toHaveLength(0);
  });

  it('rejects a browser-supplied internal human-action envelope', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: {
        ...headers('spoofed-human-action-key'),
        [GOVERNED_HUMAN_ACTION_HEADER_NAME]: Buffer.from(JSON.stringify({ kind: 'PROVIDER_SELECTION' })).toString(
          'base64url'
        )
      },
      body: JSON.stringify({ action: 'spoof' })
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('BROWSER_GOVERNED_AUTHORITY_FORBIDDEN');
    expect(captured).toHaveLength(0);
  });

  it('fails closed when Core omits the real session authentication timestamp', async () => {
    await active.pop()!.stop();
    const withoutCreatedAt = principal(['workspace:read', 'workspace:manage'], false);
    await startGateway(withoutCreatedAt);
    const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('missing-auth-time-key'),
      body: JSON.stringify({ action: 'selection' })
    });
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE');
    expect(captured).toHaveLength(0);
  });

  it('requires trusted Origin, CSRF and idempotency for governed mutations', async () => {
    const noCsrf = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: {
        cookie: 'mo_session=opaque',
        'x-markorbit-workspace-id': workspaceId,
        origin,
        'idempotency-key': 'no-csrf',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ action: 'selection' })
    });
    expect(noCsrf.status).toBe(403);

    const noIdempotencyHeaders = headers();
    delete (noIdempotencyHeaders as Record<string, string>)['idempotency-key'];
    const noIdempotency = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: noIdempotencyHeaders,
      body: JSON.stringify({ action: 'selection' })
    });
    expect(noIdempotency.status).toBe(400);
    expect((await noIdempotency.json()).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(captured).toHaveLength(0);
  });

  it('routes Allocation only to the governed allocation endpoint without human-action substitution', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/allocations`, {
      method: 'POST',
      headers: headers('allocation-key'),
      body: JSON.stringify({ selection: { providerSelectionId: 'provider-selection_test', version: 1, scopeVersion: 1 } })
    });
    expect(response.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.path).toBe('/v1/governed-network/allocations');
    expect(captured[0]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME]).toBeUndefined();
  });
});
''')
