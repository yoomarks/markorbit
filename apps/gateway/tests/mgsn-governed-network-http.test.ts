import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createGateway,
  csrfToken,
  GovernedHumanActionReceiptClientError,
  GOVERNED_HUMAN_ACTION_HEADER_NAME,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
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
let captured: Array<{
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}> = [];
let receipts = new Map<string, GovernedHumanActionReceiptV1>();

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

function receiptReplayKey(input: GovernedHumanActionReceiptMaterializationV1) {
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

async function startGateway(
  value = principal(),
  mgsnUrl = downstreamUrl,
  authenticationClient: CoreAuthenticationClient = authenticationFor(value)
) {
  const gateway = createGateway({
    port: 0,
    mgsnUrl,
    authenticationClient,
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

async function responseCode(response: Response): Promise<string | undefined> {
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const code = (payload as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}

beforeEach(async () => {
  captured = [];
  receipts = new Map();
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
    expect(String(envelope.authorityReference)).toMatch(/^core-governed-human-action-receipt:/u);
    expect(String(envelope.affirmativeHumanActionEvidenceReference)).toMatch(
      /^core-governed-human-action-evidence:/u
    );
    expect(receipts).toHaveLength(1);
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

  it('fails 409 before forwarding when an Idempotency-Key is replayed with different action evidence', async () => {
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

  it('does not treat generic execution:manage as governed human authority', async () => {
    await active.pop()!.stop();
    await startGateway(principal(['execution:read', 'execution:manage']));
    const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: headers('execution-only-key'),
      body: JSON.stringify({ action: 'must-fail' })
    });
    expect(response.status).toBe(403);
    expect(await responseCode(response)).toBe('PERMISSION_DENIED');
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
    expect(await responseCode(response)).toBe('INVALID_WORKSPACE_CONTEXT');
    expect(captured).toHaveLength(0);
  });

  it('rejects a browser-supplied internal human-action envelope', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/selections`, {
      method: 'POST',
      headers: {
        ...headers('spoofed-human-action-key'),
        [GOVERNED_HUMAN_ACTION_HEADER_NAME]: Buffer.from(
          JSON.stringify({ kind: 'PROVIDER_SELECTION' })
        ).toString('base64url')
      },
      body: JSON.stringify({ action: 'spoof' })
    });
    expect(response.status).toBe(400);
    expect(await responseCode(response)).toBe('BROWSER_GOVERNED_AUTHORITY_FORBIDDEN');
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
    expect(await responseCode(response)).toBe('GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE');
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
    expect(await responseCode(noIdempotency)).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(captured).toHaveLength(0);
  });

  it('routes Allocation only to the governed allocation endpoint without human-action substitution', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/allocations`, {
      method: 'POST',
      headers: headers('allocation-key'),
      body: JSON.stringify({
        selection: { providerSelectionId: 'provider-selection_test', version: 1, scopeVersion: 1 }
      })
    });
    expect(response.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.path).toBe('/v1/governed-network/allocations');
    expect(captured[0]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME]).toBeUndefined();
  });
});
