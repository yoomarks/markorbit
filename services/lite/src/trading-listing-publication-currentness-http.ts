import type { TradingListingPublicationIntentV1 } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { TradingListingPublicationCurrentnessResolver } from './trading-listing-publication-currentness.js';

function authenticated(request: JsonRequest, secret: string): string {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId)
    throw new HttpError(400, 'WORKSPACE_REQUIRED', 'Trusted Workspace context is required.');
  return workspaceId;
}

export function createTradingListingPublicationCurrentnessRoutes(options: {
  internalServiceSecret: string;
  resolver: Pick<TradingListingPublicationCurrentnessResolver, 'resolve'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/trading/listing-publication-intents/validate-current',
      handle: async (request) => {
        const workspaceId = authenticated(request, options.internalServiceSecret);
        if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
          throw new HttpError(400, 'INVALID_REQUEST', 'Trading publication intent is required.');
        return json(
          200,
          await options.resolver.resolve(
            workspaceId,
            request.body as TradingListingPublicationIntentV1
          )
        );
      }
    }
  ];
}
