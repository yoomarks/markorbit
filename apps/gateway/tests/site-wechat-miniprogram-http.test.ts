import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayWechatMiniProgramRoutesV1 } from '../src/site-wechat-miniprogram-http.js';

const siteRuntime = {
  schemaVersion: 1,
  publicSite: {
    schemaVersion: 1,
    siteId: 'site_workspace_a',
    siteVersion: 2,
    configurationVersion: 3,
    hostBindingVersion: 4,
    hostname: 'brand.example.com',
    brand: {
      displayName: 'Workspace A',
      theme: { primaryColor: '#112233', accentColor: '#445566', colorMode: 'LIGHT' }
    },
    localization: {
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      defaultMarket: 'US',
      jurisdictions: ['US']
    },
    services: [
      {
        productRef: { owner: 'MARKREG', productId: 'product_trademark', version: 7 },
        visibility: 'PUBLIC',
        locales: ['en-US'],
        markets: ['US'],
        channel: 'MARKREG_WHITE_LABEL',
        relationshipModel: 'WHITE_LABEL',
        fulfillmentMode: 'MARKREG'
      }
    ],
    contentSlots: [],
    currentness: {
      hostBindingCurrent: true,
      configurationCurrent: true,
      coreSiteInstallationCurrent: true,
      entitlementsCurrent: true,
      observedAt: '2026-09-17T00:00:00.000Z'
    }
  },
  requestContext: {
    schemaVersion: 1,
    siteId: 'site_workspace_a',
    workspaceId: 'workspace-private-a',
    siteVersion: 2,
    configurationVersion: 3,
    hostBindingId: 'site_host_workspace_a',
    hostBindingVersion: 4,
    normalizedHostname: 'brand.example.com',
    defaultLocale: 'en-US',
    observedAt: '2026-09-17T00:00:00.000Z',
    fingerprintSha256: 'a'.repeat(64)
  }
};

function request(query: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path: '/api/wechat-mini-program/site',
    body: undefined,
    params: {},
    query,
    headers: { host: 'attacker.example.com', 'x-forwarded-host': 'attacker.example.com' }
  };
}

describe('WeChat Mini Program Site adapter', () => {
  it('projects the exact server-bound Site and attributable owner handoff', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
      expect(JSON.parse(init.body)).toMatchObject({ hostname: 'brand.example.com' });
      return Promise.resolve(
        new Response(JSON.stringify(siteRuntime), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const route = createGatewayWechatMiniProgramRoutesV1({
      siteHostname: 'brand.example.com',
      internalServiceSecret: 'internal-secret',
      siteUrl: 'http://site.test',
      fetchImpl
    })[0]!;

    const result = await route.handle(
      request({ campaign: 'autumn', content: 'shared-card', referral: 'partner-a' })
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        platform: 'WECHAT_MINIPROGRAM',
        site: {
          siteId: 'site_workspace_a',
          configurationVersion: 3,
          brand: { displayName: 'Workspace A' }
        },
        authorityConsequences: {
          customerRelationshipCreated: false,
          quoteCreated: false,
          orderCreated: false,
          matterCreated: false,
          paymentCreated: false
        }
      }
    });
    expect(result.body).not.toHaveProperty('site.workspaceId');
    expect(result.body).not.toHaveProperty('requestContext');
    const url = new URL(
      (result.body as { serviceHandoffs: [{ url: string }] }).serviceHandoffs[0].url
    );
    expect(url.origin).toBe('https://brand.example.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: 'wechat-mini-program',
      utm_campaign: 'autumn',
      utm_content: 'shared-card',
      mo_referral: 'partner-a'
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each(['siteId', 'workspaceId', 'openid', 'session', 'paymentToken'])(
    'rejects client %s authority before Site resolution',
    async (field) => {
      const fetchImpl = vi.fn();
      const route = createGatewayWechatMiniProgramRoutesV1({
        siteHostname: 'brand.example.com',
        internalServiceSecret: 'internal-secret',
        fetchImpl
      })[0]!;
      await expect(route.handle(request({ [field]: 'spoofed' }))).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_WECHAT_MINIPROGRAM_ENTRY'
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  );

  it('fails closed when the operator Site binding is absent', async () => {
    const route = createGatewayWechatMiniProgramRoutesV1({
      internalServiceSecret: 'internal-secret'
    })[0]!;
    await expect(route.handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'WECHAT_MINIPROGRAM_ADAPTER_UNAVAILABLE'
    });
  });
});
