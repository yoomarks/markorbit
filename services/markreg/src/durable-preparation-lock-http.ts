import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  DurablePreparationLockError,
  type PostgresDurablePreparationLockService
} from './durable-preparation-lock.js';

export interface DurablePreparationLockHttpOptions {
  internalServiceSecret: string;
  service: Pick<PostgresDurablePreparationLockService, 'create' | 'get' | 'validateCurrent'>;
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
  if (error instanceof DurablePreparationLockError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createDurablePreparationLockRoutes(
  options: DurablePreparationLockHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/preparation-locks',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        const body = request.body as {
          documentPackageId?: string;
          expectedDocumentPackageVersion?: number;
          expectedCanonicalEvidenceHash?: string;
        };
        try {
          return json(
            200,
            await options.service.create(
              principal,
              {
                documentPackageId: body.documentPackageId ?? '',
                expectedDocumentPackageVersion: body.expectedDocumentPackageVersion ?? Number.NaN,
                expectedCanonicalEvidenceHash: body.expectedCanonicalEvidenceHash ?? '',
                idempotencyKey: request.headers['idempotency-key'] ?? ''
              },
              request.headers['x-correlation-id']
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/preparation-locks/:preparationLockId',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.get(principal, request.params.preparationLockId!));
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/preparation-locks/:preparationLockId/validate-current',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(
            200,
            await options.service.validateCurrent(principal, request.params.preparationLockId!)
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
