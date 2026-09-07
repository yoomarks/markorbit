import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductionServicePricingSourceError,
  type ProductionServicePricingSourceService,
  type ReadProductionServicePricingSourceV1
} from './production-service-pricing-source.js';

export interface ProductionServicePricingSourceHttpOptions {
  readonly internalServiceSecret: string;
  readonly service: Pick<ProductionServicePricingSourceService, 'read'>;
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
  if (error instanceof ProductionServicePricingSourceError) {
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  }
  throw error;
}

function readRequest(request: JsonRequest): ReadProductionServicePricingSourceV1 {
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
    'productId',
    'productVersion',
    'priceId',
    'priceVersion',
    'amount',
    'currency',
    'channel',
    'relationshipModel',
    'asOf'
  ]) {
    if (Object.hasOwn(body, field)) {
      throw new HttpError(
        400,
        'INVALID_SERVICE_PRICING_SOURCE_REQUEST',
        `${field} is trusted owner context and must not be supplied by this request.`
      );
    }
  }
  return {
    schemaVersion: body.schemaVersion as 1,
    intakeId:
      typeof body.intakeId === 'string'
        ? (body.intakeId as ReadProductionServicePricingSourceV1['intakeId'])
        : ('' as ReadProductionServicePricingSourceV1['intakeId']),
    expectedIntakeVersion: Number(body.expectedIntakeVersion),
    expectedIntakeFingerprintSha256:
      typeof body.expectedIntakeFingerprintSha256 === 'string'
        ? body.expectedIntakeFingerprintSha256
        : ''
  };
}

export function createProductionServicePricingSourceRoutes(
  options: ProductionServicePricingSourceHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-service-pricing-source/read',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            pricingSource: await options.service.read(principal, readRequest(request))
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
