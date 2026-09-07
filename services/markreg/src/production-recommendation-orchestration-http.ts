import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductionRecommendationOrchestrationError,
  type OrchestrateProductionRecommendationCommandV1,
  type ProductionRecommendationOrchestrationServiceV1
} from './production-recommendation-orchestration.js';

export interface ProductionRecommendationOrchestrationHttpOptionsV1 {
  readonly internalServiceSecret: string;
  readonly service: Pick<ProductionRecommendationOrchestrationServiceV1, 'create'>;
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

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  return request.body && typeof request.body === 'object' && !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : {};
}
function commandFor(request: JsonRequest): OrchestrateProductionRecommendationCommandV1 {
  const body = bodyRecord(request);
  for (const field of [
    'actor',
    'actorId',
    'userId',
    'workspaceId',
    'membershipId',
    'capabilityId',
    'capabilityVersion',
    'inputSchemaId',
    'outputSchemaId',
    'riskClass',
    'callerProduct',
    'producerReference',
    'methodId',
    'implementationProfileId'
  ]) {
    if (Object.hasOwn(body, field)) {
      throw new HttpError(
        400,
        'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
        `${field} is trusted owner context and must not be supplied by this command.`
      );
    }
  }
  const idempotencyKey = request.headers['idempotency-key'] ?? '';
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== idempotencyKey) {
    throw new HttpError(
      400,
      'INVALID_RECOMMENDATION_ORCHESTRATION_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  }
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    schemaVersion: body.schemaVersion as 1,
    intakeId: text(body.intakeId) as OrchestrateProductionRecommendationCommandV1['intakeId'],
    expectedIntakeVersion: Number(body.expectedIntakeVersion),
    expectedIntakeFingerprintSha256: text(body.expectedIntakeFingerprintSha256),
    idempotencyKey,
    correlationId: text(
      body.correlationId
    ) as OrchestrateProductionRecommendationCommandV1['correlationId']
  };
}

function translate(error: unknown): never {
  if (error instanceof ProductionRecommendationOrchestrationError) {
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  }
  throw error;
}
export function createProductionRecommendationOrchestrationRoutesV1(
  options: ProductionRecommendationOrchestrationHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-recommendation-orchestrations',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            recommendation: await options.service.create(principal, commandFor(request))
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
