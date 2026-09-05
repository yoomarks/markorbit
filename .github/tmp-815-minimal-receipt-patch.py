from pathlib import Path

p = Path('apps/gateway/src/mgsn-http.ts')
s = p.read_text()
s = s.replace(
"""import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';""",
"""import {
  GovernedHumanActionReceiptClientError,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1
} from './auth.js';"""
)
marker = "function requirePermission(principal: WorkspacePrincipal, mutation: boolean) {"
insert = """function mapGovernedReceipt(error: unknown): never {
  if (!(error instanceof GovernedHumanActionReceiptClientError)) throw error;
  throw new HttpError(error.status, error.code, error.message, error.status === 503);
}

"""
if insert not in s:
    s = s.replace(marker, insert + marker)
old = """function governedHumanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  kind: GovernedHumanActionKind
): string {
  const authenticatedAt = principal.sessionCreatedAt;
  if (!authenticatedAt || !Number.isFinite(Date.parse(authenticatedAt)))
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core session authentication time is unavailable for governed human action.',
      true
    );
  const idempotencyKey = requireGovernedIdempotency(request);
  const principalReference = `core-workspace-principal:${fingerprint({
    kind: principal.kind,
    workspaceId: principal.workspaceId.toLowerCase(),
    userId: principal.userId,
    membershipId: principal.membershipId,
    role: principal.role,
    permissions: [...principal.permissions].sort(),
    sessionCreatedAt: authenticatedAt,
    sessionExpiresAt: principal.sessionExpiresAt
  })}`;
  const actionFingerprint = fingerprint({
    kind,
    principalReference,
    method: request.method,
    path: request.path,
    idempotencyKey,
    body: request.body ?? {}
  });
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      kind,
      actorKind: 'HUMAN_USER',
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      principalReference,
      authorityReference: `gateway-governed-action:${kind.toLowerCase()}:${actionFingerprint}`,
      authorityVersion: 1,
      authenticatedAt,
      affirmativeHumanActionEvidenceReference: `gateway-human-action:${kind.toLowerCase()}:${actionFingerprint}`,
      payloadIdentityAuthoritative: false
    }),
    'utf8'
  ).toString('base64url');
}"""
new = """async function governedHumanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  kind: GovernedHumanActionKind,
  authentication: CoreAuthenticationClient,
  correlationId?: string
): Promise<string> {
  const authenticatedAt = principal.sessionCreatedAt;
  if (!authenticatedAt || !Number.isFinite(Date.parse(authenticatedAt)))
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core session authentication time is unavailable for governed human action.',
      true
    );
  const materialize = authentication.materializeGovernedHumanActionReceipt;
  if (!materialize)
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core governed human-action receipt authority is unavailable.',
      true
    );
  const idempotencyKey = requireGovernedIdempotency(request);
  const principalReference = `core-workspace-principal:${fingerprint({
    kind: principal.kind,
    workspaceId: principal.workspaceId.toLowerCase(),
    userId: principal.userId,
    membershipId: principal.membershipId,
    role: principal.role,
    permissions: [...principal.permissions].sort(),
    sessionCreatedAt: authenticatedAt,
    sessionExpiresAt: principal.sessionExpiresAt
  })}`;
  const reviewedActionDigest = fingerprint({
    kind,
    principalReference,
    method: request.method,
    path: request.path,
    body: request.body ?? {}
  });
  const materialization: GovernedHumanActionReceiptMaterializationV1 = {
    workspaceId: principal.workspaceId,
    userId: principal.userId,
    membershipId: principal.membershipId,
    principalReference,
    kind,
    mutationRoute: request.path,
    reviewedActionDigest,
    idempotencyKey,
    authenticatedAt
  };
  let receipt;
  try {
    receipt = await materialize.call(authentication, materialization, correlationId);
  } catch (error) {
    return mapGovernedReceipt(error);
  }
  if (
    receipt.schemaVersion !== 1 ||
    receipt.source !== 'CORE' ||
    receipt.actorKind !== 'HUMAN_USER' ||
    receipt.kind !== materialization.kind ||
    receipt.workspaceId !== materialization.workspaceId ||
    receipt.userId !== materialization.userId ||
    receipt.membershipId !== materialization.membershipId ||
    receipt.principalReference !== materialization.principalReference ||
    receipt.mutationRoute !== materialization.mutationRoute ||
    receipt.reviewedActionDigest !== materialization.reviewedActionDigest ||
    receipt.idempotencyKey !== materialization.idempotencyKey ||
    receipt.authenticatedAt !== materialization.authenticatedAt ||
    receipt.authorityVersion !== 1 ||
    !receipt.authorityReference.startsWith('core-governed-human-action-receipt:') ||
    !receipt.affirmativeHumanActionEvidenceReference.startsWith('core-governed-human-action-evidence:')
  )
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core governed human-action receipt did not match the trusted action context.',
      true
    );
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      kind,
      actorKind: receipt.actorKind,
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      principalReference,
      authorityReference: receipt.authorityReference,
      authorityVersion: receipt.authorityVersion,
      authenticatedAt,
      affirmativeHumanActionEvidenceReference: receipt.affirmativeHumanActionEvidenceReference,
      payloadIdentityAuthoritative: false
    }),
    'utf8'
  ).toString('base64url');
}"""
if old not in s:
    raise SystemExit('old governedHumanActionEnvelope block not found')
s = s.replace(old, new)
old_call = """      const humanAction = route.humanAction
        ? governedHumanActionEnvelope(request, principal, route.humanAction)
        : undefined;"""
new_call = """      const humanAction = route.humanAction
        ? await governedHumanActionEnvelope(
            request,
            principal,
            route.humanAction,
            authentication(),
            correlation(request)
          )
        : undefined;"""
if old_call not in s:
    raise SystemExit('old human action call not found')
s = s.replace(old_call, new_call)
p.write_text(s)

p = Path('apps/gateway/tests/mgsn-governed-network-http.test.ts')
s = p.read_text()
s = s.replace(
"""  GOVERNED_HUMAN_ACTION_HEADER_NAME,
  type CoreAuthenticationClient
} from '../src/index.js';""",
"""  GovernedHumanActionReceiptClientError,
  GOVERNED_HUMAN_ACTION_HEADER_NAME,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
} from '../src/index.js';"""
)
s = s.replace(
"""let captured: Array<{
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}> = [];""",
"""let captured: Array<{
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}> = [];
let receipts = new Map<string, GovernedHumanActionReceiptV1>();"""
)
old_auth = """function authenticationFor(value: WorkspacePrincipal): CoreAuthenticationClient {
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
}"""
new_auth = """function receiptReplayKey(input: GovernedHumanActionReceiptMaterializationV1) {
  return [input.kind, input.workspaceId, input.userId, input.membershipId, input.idempotencyKey].join(':');
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
    materializeGovernedHumanActionReceipt: (input) => {
      const key = receiptReplayKey(input);
      const existing = receipts.get(key);
      if (existing) {
        const exact = Object.entries(input).every(
          ([field, expected]) => existing[field as keyof GovernedHumanActionReceiptV1] === expected
        );
        if (!exact)
          return Promise.reject(
            new GovernedHumanActionReceiptClientError(409, 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT', 'replay conflict')
          );
        return Promise.resolve(existing);
      }
      const receiptId = `01900000-0000-7000-8000-${String(receipts.size + 1).padStart(12, '0')}`;
      const receipt: GovernedHumanActionReceiptV1 = {
        ...input,
        schemaVersion: 1,
        receiptId,
        receiptVersion: 1,
        authorityReference: `core-governed-human-action-receipt:${receiptId}`,
        authorityVersion: 1,
        affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${receiptId}`,
        source: 'CORE',
        actorKind: 'HUMAN_USER',
        workspaceVersion: 1,
        userVersion: 1,
        membershipVersion: 1,
        createdAt: '2026-09-05T08:00:01.000Z'
      };
      receipts.set(key, receipt);
      return Promise.resolve(receipt);
    },
    revoke: () => Promise.resolve()
  };
}"""
if old_auth not in s:
    raise SystemExit('old authenticationFor helper not found')
s = s.replace(old_auth, new_auth)
s = s.replace("  captured = [];\n  await startDownstream();", "  captured = [];\n  receipts = new Map();\n  await startDownstream();")
s = s.replace(
"""async function startGateway(value = principal(), mgsnUrl = downstreamUrl) {
  const gateway = createGateway({
    port: 0,
    mgsnUrl,
    authenticationClient: authenticationFor(value),""",
"""async function startGateway(
  value = principal(),
  mgsnUrl = downstreamUrl,
  authenticationClient: CoreAuthenticationClient = authenticationFor(value)
) {
  const gateway = createGateway({
    port: 0,
    mgsnUrl,
    authenticationClient,"""
)
s = s.replace(
"""    expect(String(envelope.principalReference)).not.toContain('session-governed-user');
  });""",
"""    expect(String(envelope.principalReference)).not.toContain('session-governed-user');
    expect(String(envelope.authorityReference)).toMatch(/^core-governed-human-action-receipt:/u);
    expect(String(envelope.affirmativeHumanActionEvidenceReference)).toMatch(
      /^core-governed-human-action-evidence:/u
    );
    expect(receipts).toHaveLength(1);
  });""",
1
)
anchor = "  it('does not treat generic execution:manage as governed human authority', async () => {"
extra = """  it('fails 409 before forwarding when an Idempotency-Key is replayed with different action evidence', async () => {
    const first = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('conflicting-selection-key'),
      body: JSON.stringify({ candidate: 'one' })
    });
    expect(first.status).toBe(200);
    const conflict = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('conflicting-selection-key'),
      body: JSON.stringify({ candidate: 'two' })
    });
    expect(conflict.status).toBe(409);
    expect(await responseCode(conflict)).toBe('GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT');
    expect(captured).toHaveLength(1);
  });

  it('fails closed before MGSN forwarding when Core receipt authority is unavailable', async () => {
    await active.pop()!.stop();
    const p = principal();
    const client = authenticationFor(p);
    client.materializeGovernedHumanActionReceipt = () =>
      Promise.reject(
        new GovernedHumanActionReceiptClientError(
          503,
          'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE',
          'unavailable'
        )
      );
    await startGateway(p, downstreamUrl, client);
    const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('receipt-outage-key'),
      body: JSON.stringify({ action: 'selection' })
    });
    expect(response.status).toBe(503);
    expect(await responseCode(response)).toBe('GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE');
    expect(captured).toHaveLength(0);
  });

"""
if extra not in s:
    s = s.replace(anchor, extra + anchor)
p.write_text(s)
