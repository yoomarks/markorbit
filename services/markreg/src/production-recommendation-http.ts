import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductionRecommendationError,
  type CreateProductionRecommendationCommandV1,
  type PostgresProductionRecommendationService
} from './production-recommendation.js';

export interface ProductionRecommendationHttpOptions {
  readonly internalServiceSecret: string;
  readonly service: Pick<PostgresProductionRecommendationService, 'create' | 'get'>;
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
  if (error instanceof ProductionRecommendationError) {
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  }
  throw error;
}

function commandFor(request: JsonRequest): CreateProductionRecommendationCommandV1 {
  const textValue = (value: unknown): string => (typeof value === 'string' ? value : '');
  const body =
    request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  for (const field of ['actor', 'actorId', 'userId', 'workspaceId', 'membershipId']) {
    if (Object.hasOwn(body, field)) {
      throw new HttpError(
        400,
        'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
        `${field} is trusted authority context and must not be supplied by this command.`
      );
    }
  }
  const idempotencyKey = request.headers['idempotency-key'] ?? '';
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== idempotencyKey) {
    throw new HttpError(
      400,
      'INVALID_PRODUCTION_RECOMMENDATION_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  }
  const reference =
    body.producerReference &&
    typeof body.producerReference === 'object' &&
    !Array.isArray(body.producerReference)
      ? (body.producerReference as Record<string, unknown>)
      : {};
  return {
    schemaVersion: body.schemaVersion as 1,
    intakeId: textValue(body.intakeId) as CreateProductionRecommendationCommandV1['intakeId'],
    expectedIntakeVersion: Number(body.expectedIntakeVersion),
    producerReference: {
      schemaVersion: reference.schemaVersion as 1,
      idempotencyKey: textValue(reference.idempotencyKey),
      requestFingerprintSha256: textValue(reference.requestFingerprintSha256),
      capabilityRequestId: textValue(reference.capabilityRequestId),
      sessionReceiptId: textValue(reference.sessionReceiptId)
    },
    idempotencyKey,
    correlationId: textValue(
      body.correlationId
    ) as CreateProductionRecommendationCommandV1['correlationId']
  };
}

export function createProductionRecommendationRoutes(
  options: ProductionRecommendationHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-recommendations',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          const command = commandFor(request);
          return json(200, {
            recommendation: await options.service.create(
              principal,
              command,
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
      path: '/internal/v1/production-recommendations/:recommendationId',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            recommendation: await options.service.get(principal, request.params.recommendationId!)
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
