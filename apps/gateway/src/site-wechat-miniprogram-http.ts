import {
  parseWechatMiniProgramEntryV1,
  wechatMiniProgramAuthorityConsequencesV1,
  type WechatMiniProgramSiteProjectionV1
} from '@markorbit/contracts/site-wechat-miniprogram';
import type { ResolvedSiteRuntimeV1 } from '@markorbit/contracts/site';
import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';

export interface GatewayWechatMiniProgramOptionsV1 {
  siteUrl?: string;
  siteHostname?: string;
  internalServiceSecret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function configured(options: GatewayWechatMiniProgramOptionsV1) {
  const secret = options.internalServiceSecret?.trim();
  const siteHostname = options.siteHostname?.trim();
  if (!secret || !siteHostname || siteHostname.includes(',')) {
    throw new HttpError(
      503,
      'WECHAT_MINIPROGRAM_ADAPTER_UNAVAILABLE',
      'WeChat Mini Program Site adapter is not configured.',
      true
    );
  }
  return {
    siteUrl: (options.siteUrl ?? 'http://127.0.0.1:4109').replace(/\/$/u, ''),
    siteHostname,
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 3_000
  };
}

function assertResolvedSite(value: unknown): asserts value is ResolvedSiteRuntimeV1 {
  const resolved = value as Partial<ResolvedSiteRuntimeV1> | undefined;
  if (
    resolved?.schemaVersion !== 1 ||
    resolved.publicSite?.schemaVersion !== 1 ||
    resolved.requestContext?.schemaVersion !== 1 ||
    resolved.publicSite.siteId !== resolved.requestContext.siteId ||
    resolved.publicSite.siteVersion !== resolved.requestContext.siteVersion ||
    resolved.publicSite.configurationVersion !== resolved.requestContext.configurationVersion ||
    resolved.publicSite.hostname !== resolved.requestContext.normalizedHostname
  ) {
    throw new HttpError(
      503,
      'SITE_RUNTIME_INVALID_RESPONSE',
      'Site runtime response is invalid.',
      true
    );
  }
}

function handoffUrl(
  site: ResolvedSiteRuntimeV1['publicSite'],
  entry: ReturnType<typeof parseWechatMiniProgramEntryV1>,
  productId: string
): string {
  const url = new URL(`https://${site.hostname}/`);
  url.searchParams.set('utm_source', 'wechat-mini-program');
  if (entry.campaign) url.searchParams.set('utm_campaign', entry.campaign);
  url.searchParams.set('utm_content', entry.content ?? productId);
  if (entry.referral) url.searchParams.set('mo_referral', entry.referral);
  return url.toString();
}

export function createGatewayWechatMiniProgramRoutesV1(
  options: GatewayWechatMiniProgramOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/wechat-mini-program/site',
      async handle(request) {
        let entry;
        try {
          entry = parseWechatMiniProgramEntryV1({ schemaVersion: 1, ...request.query });
        } catch (error) {
          throw new HttpError(
            400,
            'INVALID_WECHAT_MINIPROGRAM_ENTRY',
            error instanceof Error ? error.message : 'Mini Program entry is invalid.'
          );
        }
        const target = configured(options);
        try {
          const response = await target.fetchImpl(
            `${target.siteUrl}/internal/site-runtime/resolve`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-markorbit-internal-authorization': target.secret
              },
              body: JSON.stringify({
                hostname: target.siteHostname,
                observedAt: new Date().toISOString()
              }),
              signal: AbortSignal.timeout(target.timeoutMs)
            }
          );
          const body: unknown = await response.json();
          if (!response.ok) {
            return json(response.status, body);
          }
          assertResolvedSite(body);
          const projection: WechatMiniProgramSiteProjectionV1 = {
            schemaVersion: 1,
            platform: 'WECHAT_MINIPROGRAM',
            site: body.publicSite,
            serviceHandoffs: body.publicSite.services
              .filter((service) => service.visibility === 'PUBLIC')
              .map((service) => ({
                productRef: service.productRef,
                url: handoffUrl(body.publicSite, entry, service.productRef.productId)
              })),
            authorityConsequences: wechatMiniProgramAuthorityConsequencesV1
          };
          return json(200, projection);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(
            503,
            'SITE_RUNTIME_UNAVAILABLE',
            'Site runtime is unavailable.',
            true
          );
        }
      }
    }
  ];
}
