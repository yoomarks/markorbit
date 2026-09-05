import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ExaminationStageReadError,
  type ExaminationStageReadService
} from './examination-stage-read.js';

export interface MarkRegExaminationStageReadRouteOptions {
  internalServiceSecret: string;
  service: ExaminationStageReadService;
}

function trusted(configured: string, supplied: string | undefined) {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );

  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }

  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  if (!principal.permissions.includes('matter:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'matter:read permission is required.');
  return principal;
}

function mapError(error: unknown): never {
  if (error instanceof ExaminationStageReadError)
    throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
  throw error;
}

export function createMarkRegExaminationStageReadRoutes(
  options: MarkRegExaminationStageReadRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/v1/formal-matters/:formalMatterId/examination',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const formalMatterId = request.params.formalMatterId! as FormalMatterId;
        try {
          const examination = await options.service.get(principal.workspaceId, formalMatterId);
          return json(200, { examination });
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
