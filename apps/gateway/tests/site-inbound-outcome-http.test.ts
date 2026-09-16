import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewaySiteInboundOutcomeRoutesV1 } from '../src/site-inbound-outcome-http.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const csrfSecret = 'site-outcome-csrf-secret';
const internalSecret = 'site-outcome-internal-secret-32-bytes';
const origin = 'https://markreg.example';
const at = '2026-09-17T01:00:00.000Z';
const sha = (value: string) => value.repeat(64);
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-site-outcome',
  userId: 'user-site-outcome',
  workspaceId,
  membershipId: 'membership-site-outcome',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:manage', 'workspace:read', 'matter:read'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const authenticationClient: CoreAuthenticationClient = {
  issue: vi.fn() as never,
  resolve: vi.fn() as never,
  revoke: vi.fn() as never,
  resolveWorkspace: vi.fn(() => Promise.resolve(principal))
};

function request(body: unknown): JsonRequest {
  return {
    method: 'POST',
    path: '/api/site/markreg/formal-matters/formal-matter_1/attribution',
    params: { formalMatterId: 'formal-matter_1' },
    query: {},
    body,
    headers: {
      cookie: 'mo_session=site-outcome',
      origin,
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
      'x-correlation-id': 'correlation_site_outcome',
      'idempotency-key': 'site-outcome-1'
    }
  };
}

const acquisition = {
  schemaVersion: 1,
  attributionState: 'ATTRIBUTED',
  landingPath: '/services/us-trademark',
  source: 'ai-answer',
  observedAt: at,
  fingerprintSha256: sha('b'),
  authorityConsequences: {
    customerIdentityEstablished: false,
    customerRelationshipCreated: false,
    contactPermissionGranted: false,
    conversionCreated: false,
    paymentCreated: false,
    causalReturnOnInvestmentClaimed: false
  }
};
const intake = {
  intakeId: 'production-intake_1',
  workspaceId,
  version: 1,
  fingerprintSha256: sha('a'),
  updatedAt: at,
  siteSource: {
    siteId: 'site_reference',
    configurationVersion: 3,
    fingerprintSha256: sha('c'),
    observedAt: at,
    acquisition
  }
};
const quote = {
  quoteId: 'quote_1',
  workspaceId,
  version: 2,
  fingerprintSha256: sha('d'),
  createdAt: at,
  intake: {
    id: intake.intakeId,
    version: intake.version,
    fingerprintSha256: intake.fingerprintSha256
  }
};
const matter = {
  formalMatterId: 'formal-matter_1',
  workspaceId,
  version: 1,
  sourceQuoteId: quote.quoteId,
  sourceQuoteVersion: String(quote.version),
  snapshotSha256: sha('e'),
  updatedAt: at
};
const order = {
  orderId: 'order_1',
  version: 6,
  updatedAt: at,
  source: {
    quoteId: quote.quoteId,
    quoteVersion: String(quote.version),
    customerConfirmationId: 'confirmation_1',
    customerConfirmationVersion: 1,
    snapshotSha256: sha('f')
  },
  matter: { formalMatterId: matter.formalMatterId, formalMatterVersion: matter.version }
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  );
}

function targetOf(value: string | URL | Request): string {
  return typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;
}

describe('Gateway Site inbound downstream attribution', () => {
  it('re-reads the complete MarkReg lineage before recording the Matter outcome', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const target = targetOf(url);
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-principal')).toBe(
        encodeInternalWorkspacePrincipal(principal)
      );
      if (target.endsWith(`/production-intakes/${intake.intakeId}`)) return json({ intake });
      if (target.endsWith(`/production-quotes/${quote.quoteId}`)) return json({ quote });
      if (target.endsWith(`/formal-matters/${matter.formalMatterId}`))
        return json({ formalMatter: matter });
      if (target.endsWith(`/orders/${order.orderId}`)) return json(order);
      expect(target).toBe('http://lite.test/v1/business-attribution-links');
      if (typeof init?.body !== 'string') throw new Error('Lite request body must be JSON.');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body).toMatchObject({
        motionKind: 'SITE_INBOUND',
        attributionState: 'ATTRIBUTED',
        downstreamRef: { owner: 'MARKREG', kind: 'FORMAL_MATTER', id: matter.formalMatterId }
      });
      expect(body.touchpointRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'PRODUCTION_INTAKE' }),
          expect.objectContaining({ kind: 'PRODUCTION_QUOTE' }),
          expect.objectContaining({ kind: 'ORDER' }),
          expect.objectContaining({ kind: 'CUSTOMER_CONFIRMATION' })
        ])
      );
      return json({ businessAttributionLinkId: 'business-attribution_outcome' }, 201);
    });
    const route = createGatewaySiteInboundOutcomeRoutesV1({
      markRegUrl: 'http://markreg.test',
      liteUrl: 'http://lite.test',
      authenticationClient,
      internalServiceSecret: internalSecret,
      csrfSecret,
      allowedOrigins: [origin],
      fetchImpl
    })[0]!;
    await expect(
      route.handle(
        request({ intakeId: intake.intakeId, quoteId: quote.quoteId, orderId: order.orderId })
      )
    ).resolves.toMatchObject({ status: 201 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('rejects a named Matter when its owner Quote lineage does not match', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      const target = targetOf(url);
      if (target.includes('/production-intakes/')) return json({ intake });
      if (target.includes('/production-quotes/')) return json({ quote });
      if (target.includes('/formal-matters/'))
        return json({ formalMatter: { ...matter, sourceQuoteId: 'quote_other' } });
      if (target.includes('/orders/')) return json(order);
      throw new Error('Lite must not be called for mismatched lineage.');
    });
    const route = createGatewaySiteInboundOutcomeRoutesV1({
      markRegUrl: 'http://markreg.test',
      liteUrl: 'http://lite.test',
      authenticationClient,
      internalServiceSecret: internalSecret,
      csrfSecret,
      allowedOrigins: [origin],
      fetchImpl
    })[0]!;
    await expect(
      route.handle(
        request({ intakeId: intake.intakeId, quoteId: quote.quoteId, orderId: order.orderId })
      )
    ).rejects.toMatchObject({ status: 409, code: 'ATTRIBUTION_LINEAGE_MISMATCH' });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
