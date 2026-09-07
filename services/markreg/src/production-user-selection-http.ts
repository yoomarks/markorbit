import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { CreateUserSelectionCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductionUserSelectionError,
  type PostgresProductionUserSelectionService
} from './production-user-selection.js';

export interface ProductionUserSelectionHttpOptions {
  readonly internalServiceSecret: string;
  readonly service: Pick<PostgresProductionUserSelectionService, 'create' | 'get'>;
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
  if (error instanceof ProductionUserSelectionError) {
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  }
  throw error;
}

function commandFor(request: JsonRequest): CreateUserSelectionCommandV1 {
  const body =
    request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  for (const field of ['actor', 'actorId', 'userId', 'workspaceId', 'membershipId']) {
    if (Object.hasOwn(body, field)) {
      throw new HttpError(
        400,
        'INVALID_PRODUCTION_USER_SELECTION_REQUEST',
        `${field} is trusted authority context and must not be supplied by this command.`
      );
    }
  }
  const idempotencyKey = request.headers['idempotency-key'] ?? '';
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== idempotencyKey) {
    throw new HttpError(
      400,
      'INVALID_PRODUCTION_USER_SELECTION_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  }
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    schemaVersion: body.schemaVersion as 1,
    recommendationId: text(
      body.recommendationId
    ) as CreateUserSelectionCommandV1['recommendationId'],
    expectedRecommendationVersion: Number(body.expectedRecommendationVersion),
    selectedOptionCode:
      body.selectedOptionCode as CreateUserSelectionCommandV1['selectedOptionCode'],
    idempotencyKey,
    correlationId: text(body.correlationId) as CreateUserSelectionCommandV1['correlationId']
  };
}

export function createProductionUserSelectionRoutes(
  options: ProductionUserSelectionHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-user-selections',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            selection: await options.service.create(
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
      path: '/internal/v1/production-user-selections/:selectionId',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            selection: await options.service.get(principal, request.params.selectionId!)
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
