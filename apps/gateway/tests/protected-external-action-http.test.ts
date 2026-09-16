import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  csrfToken,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
} from '../src/auth.js';
import { createGatewayProtectedExternalActionRoutes } from '../src/protected-external-action-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000001176';
const userId = '018f0000-0000-7000-8000-000000001177';
const sessionId = '018f0000-0000-7000-8000-000000001178';
const csrfSecret = 'gateway-protected-action-csrf-secret';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  workspaceId,
  userId,
  membershipId: '018f0000-0000-7000-8000-000000001179',
  sessionId,
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:manage', 'execution:manage'],
  sessionCreatedAt: '2026-09-17T00:00:00.000Z',
  sessionExpiresAt: '2027-09-17T00:00:00.000Z'
};

function receipt(input: GovernedHumanActionReceiptMaterializationV1): GovernedHumanActionReceiptV1 {
  const receiptId = '018f0000-0000-7000-8000-000000001180';
  return {
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
    createdAt: '2026-09-17T00:00:00.000Z'
  };
}

const authenticationClient: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () => Promise.reject(new Error('not used')),
  resolveWorkspace: () => Promise.resolve(principal),
  materializeGovernedHumanActionReceipt: (input) => Promise.resolve(receipt(input)),
  revoke: () => Promise.resolve()
};

function request(body: Record<string, unknown>): JsonRequest {
  return {
    method: 'POST',
    path: '/api/execution/protected-external-actions/trading-listing-publish/authorizations',
    params: {},
    query: {},
    body,
    headers: {
      cookie: 'mo_session=token-1176',
      origin: 'https://app.example',
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
      'idempotency-key': 'authorize-1176'
    }
  };
}

const publicIntent = {
  listingDraft: { id: 'trading-listing-draft_1176', version: 3 },
  listingReview: { id: 'trading-listing-review_1176', version: 2 },
  listingAssets: [{ id: 'listing-asset_1176', version: 4 }],
  marketplaceTargetBinding: { id: 'trading-marketplace-target-binding_1176', version: 5 }
};

describe('Gateway Trading publish protected action boundary', () => {
  it('injects trusted Workspace, deterministic fingerprint, full Core receipt, and Principal', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ authorizationStatus: 'AUTHORIZED' }), { status: 201 })
      )
    );
    const [route] = createGatewayProtectedExternalActionRoutes({
      executionUrl: 'http://execution.test',
      authenticationClient,
      internalServiceSecret: 'internal-service-secret-1176-0123456789',
      csrfSecret,
      allowedOrigins: ['https://app.example'],
      fetchImpl
    });
    await expect(route!.handle(request(publicIntent))).resolves.toMatchObject({ status: 201 });
    const init = fetchImpl.mock.calls[0]![1]!;
    if (typeof init.body !== 'string') throw new TypeError('Expected a JSON string request body.');
    const forwarded = JSON.parse(init.body) as {
      intent: Record<string, unknown>;
      humanReceipt: Record<string, unknown>;
    };
    expect(forwarded.intent.workspaceId).toBe(workspaceId);
    expect(forwarded.intent.actionKind).toBe('TRADING_LISTING_PUBLISH');
    expect(forwarded.intent.effectFingerprintSha256).toEqual(expect.any(String));
    expect(String(forwarded.intent.effectFingerprintSha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(forwarded.humanReceipt).toMatchObject({
      receiptId: '018f0000-0000-7000-8000-000000001180',
      kind: 'TRADING_LISTING_PUBLISH',
      workspaceId,
      actorKind: 'HUMAN_USER'
    });
    expect(new Headers(init.headers).get('x-markorbit-principal')).toBeTruthy();
  });

  it('rejects browser-supplied authority or receipt fields', async () => {
    const [route] = createGatewayProtectedExternalActionRoutes({
      executionUrl: 'http://execution.test',
      authenticationClient,
      internalServiceSecret: 'internal-service-secret-1176-0123456789',
      csrfSecret,
      allowedOrigins: ['https://app.example']
    });
    await expect(
      route!.handle(request({ ...publicIntent, humanReceipt: { receiptId: 'browser' } }))
    ).rejects.toMatchObject({ status: 400, code: 'BROWSER_AUTHORITY_FORBIDDEN' });
  });
});
