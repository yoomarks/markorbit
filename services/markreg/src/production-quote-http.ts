import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { CreateProductionQuoteCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { ProductionQuoteError, type PostgresProductionQuoteServiceV1 } from './production-quote.js';

export interface ProductionQuoteHttpOptionsV1 {
  readonly internalServiceSecret: string;
  readonly service: Pick<PostgresProductionQuoteServiceV1, 'create' | 'get'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32) {
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization'])) {
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  }
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase()) {
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  }
  return principal;
}

function translate(error: unknown): never {
  if (error instanceof ProductionQuoteError) {
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  }
  throw error;
}
function commandFor(request: JsonRequest): CreateProductionQuoteCommandV1 {
  const body =
    request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  for (const field of [
    'actor',
    'actorId',
    'userId',
    'workspaceId',
    'membershipId',
    'amount',
    'currency',
    'lines',
    'pricingSource',
    'officialFee',
    'serviceFee',
    'status',
    'validUntil',
    'admissionClass',
    'fingerprintSha256',
    'supersedesQuoteId'
  ]) {
    if (Object.hasOwn(body, field)) {
      throw new HttpError(
        400,
        'INVALID_PRODUCTION_QUOTE_REQUEST',
        `${field} is owner-derived Quote authority and must not be supplied by this command.`
      );
    }
  }
  const idempotencyKey = request.headers['idempotency-key'] ?? '';
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== idempotencyKey) {
    throw new HttpError(
      400,
      'INVALID_PRODUCTION_QUOTE_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  }
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    schemaVersion: body.schemaVersion as 1,
    intakeId: text(body.intakeId) as CreateProductionQuoteCommandV1['intakeId'],
    expectedIntakeVersion: Number(body.expectedIntakeVersion),
    recommendationId: text(
      body.recommendationId
    ) as CreateProductionQuoteCommandV1['recommendationId'],
    expectedRecommendationVersion: Number(body.expectedRecommendationVersion),
    selectionId: text(body.selectionId) as CreateProductionQuoteCommandV1['selectionId'],
    expectedSelectionVersion: Number(body.expectedSelectionVersion),
    idempotencyKey,
    correlationId: text(body.correlationId) as CreateProductionQuoteCommandV1['correlationId']
  };
}

export function createProductionQuoteRoutesV1(
  options: ProductionQuoteHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-quotes',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            quote: await options.service.create(
              principal,
              commandFor(request),
              request.headers['x-correlation-id']
            )
          });
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/production-quotes/:quoteId',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            quote: await options.service.get(principal, request.params.quoteId!)
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
