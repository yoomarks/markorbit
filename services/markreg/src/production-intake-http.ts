import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { parseCreateProductionIntakeCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductionIntakeError,
  type PostgresProductionIntakeService
} from './production-intake.js';

export interface ProductionIntakeHttpOptions {
  internalServiceSecret: string;
  service: Pick<PostgresProductionIntakeService, 'create' | 'get'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  return principal;
}

function translate(error: unknown): never {
  if (error instanceof ProductionIntakeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createProductionIntakeRoutes(
  options: ProductionIntakeHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-intakes',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        const body = request.body as Record<string, unknown>;
        const idempotencyKey = request.headers['idempotency-key'] ?? '';
        if (
          body?.idempotencyKey !== undefined &&
          body.idempotencyKey !== idempotencyKey
        )
          throw new HttpError(
            400,
            'INVALID_PRODUCTION_INTAKE_REQUEST',
            'Request idempotencyKey must match Idempotency-Key header.'
          );
        let command;
        try {
          command = parseCreateProductionIntakeCommandV1({
            ...(body ?? {}),
            idempotencyKey
          });
        } catch (error) {
          throw new HttpError(
            400,
            'INVALID_PRODUCTION_INTAKE_REQUEST',
            error instanceof Error ? error.message : 'Production Intake request is invalid.'
          );
        }
        try {
          return json(200, {
            intake: await options.service.create(
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
      path: '/internal/v1/production-intakes/:intakeId',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            intake: await options.service.get(principal, request.params.intakeId!)
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
