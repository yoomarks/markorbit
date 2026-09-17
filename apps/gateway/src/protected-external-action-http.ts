import { createHash } from 'node:crypto';
import {
  canonicalTradingListingPublicationIntentPayloadV1,
  encodeInternalWorkspacePrincipal,
  type TradingListingPublicationIntentV1
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from './auth.js';
import { authorizeGovernedWorkspaceMutation } from './governed-action.js';

export interface GatewayProtectedExternalActionRouteOptions {
  executionUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
}

const authorityFields = [
  'workspaceId',
  'actionKind',
  'effectFingerprintSha256',
  'humanReceipt',
  'receipt',
  'actorId',
  'userId',
  'principal',
  'authorizedByUserId',
  'releasedByUserId',
  'authorizationStatus',
  'status'
] as const;

function intentFrom(body: Readonly<Record<string, unknown>>, workspaceId: string) {
  const forbidden = authorityFields.find((field) => Object.hasOwn(body, field));
  if (forbidden)
    throw new HttpError(
      400,
      'BROWSER_AUTHORITY_FORBIDDEN',
      `${forbidden} is trusted server authority and cannot be supplied.`
    );
  const allowed = ['listingDraft', 'listingReview', 'listingAssets', 'marketplaceTargetBinding'];
  if (Object.keys(body).some((field) => !allowed.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Unsupported Trading publication intent field.');
  const unsigned = {
    schemaVersion: 1,
    actionKind: 'TRADING_LISTING_PUBLISH',
    workspaceId,
    listingDraft: body.listingDraft,
    listingReview: body.listingReview,
    listingAssets: body.listingAssets,
    marketplaceTargetBinding: body.marketplaceTargetBinding,
    effectFingerprintSha256: '0'.repeat(64)
  } as TradingListingPublicationIntentV1;
  const canonical = canonicalTradingListingPublicationIntentPayloadV1(unsigned);
  return {
    ...canonical,
    effectFingerprintSha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  } satisfies TradingListingPublicationIntentV1;
}

export function createGatewayProtectedExternalActionRoutes(
  options: GatewayProtectedExternalActionRouteOptions
): readonly JsonRoute[] {
  const authentication = () => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    return options.authenticationClient;
  };
  const secret = () => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'EXECUTION_INTERNAL_AUTHORIZATION_UNAVAILABLE',
        'Execution authorization is unavailable.',
        true
      );
    return options.internalServiceSecret;
  };
  const forward = async (
    request: JsonRequest,
    principal: Parameters<typeof encodeInternalWorkspacePrincipal>[0],
    path: string,
    body: unknown
  ) => {
    try {
      const response = await (options.fetchImpl ?? fetch)(`${options.executionUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': secret(),
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(request.headers['idempotency-key']
            ? { 'idempotency-key': request.headers['idempotency-key'] }
            : {}),
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {})
        },
        body: JSON.stringify(body)
      });
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'EXECUTION_UNAVAILABLE', 'Execution service is unavailable.', true);
    }
  };
  return [
    {
      method: 'POST',
      path: '/api/execution/protected-external-actions/trading-listing-publish/authorizations',
      handle: async (request) => {
        const context = await authorizeGovernedWorkspaceMutation(
          request,
          {
            authenticationClient: authentication(),
            csrfSecret: options.csrfSecret,
            allowedOrigins: options.allowedOrigins
          },
          {
            permission: 'workspace:manage',
            idempotency: 'REQUIRED',
            humanAction: 'TRADING_LISTING_PUBLISH',
            forbiddenBodyFields: authorityFields,
            forbiddenHeaders: ['x-markorbit-principal', 'x-markorbit-governed-human-action-receipt']
          }
        );
        if (!context.humanActionReceipt)
          throw new HttpError(
            503,
            'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
            'Core receipt is unavailable.',
            true
          );
        return forward(
          request,
          context.principal,
          '/v1/protected-external-actions/trading-listing-publish/authorizations',
          {
            intent: intentFrom(context.body, context.principal.workspaceId),
            humanReceipt: context.humanActionReceipt
          }
        );
      }
    },
    {
      method: 'POST',
      path: '/api/execution/protected-external-actions/trading-listing-publish/authorizations/:authorizationId/releases',
      handle: async (request) => {
        const context = await authorizeGovernedWorkspaceMutation(
          request,
          {
            authenticationClient: authentication(),
            csrfSecret: options.csrfSecret,
            allowedOrigins: options.allowedOrigins
          },
          {
            permission: 'workspace:manage',
            idempotency: 'REQUIRED',
            forbiddenBodyFields: authorityFields,
            forbiddenHeaders: ['x-markorbit-principal', 'x-markorbit-governed-human-action-receipt']
          }
        );
        if (
          Object.keys(context.body).some((field) => field !== 'authorizationVersion') ||
          !Number.isSafeInteger(context.body.authorizationVersion)
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'Exact authorizationVersion is required.');
        return forward(
          request,
          context.principal,
          `/v1/protected-external-actions/trading-listing-publish/authorizations/${encodeURIComponent(request.params.authorizationId!)}/releases`,
          { authorizationVersion: context.body.authorizationVersion }
        );
      }
    }
  ];
}
