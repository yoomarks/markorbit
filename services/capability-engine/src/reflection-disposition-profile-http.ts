import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type RuntimeCapabilityDefinitionId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ReflectionDispositionProfileError,
  type PostgresReflectionDispositionProfileService
} from './reflection-disposition-profile.js';

export interface ReflectionDispositionProfileRouteOptions {
  internalServiceSecret: string;
  reflections: PostgresReflectionDispositionProfileService;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function subjectPrincipal(request: JsonRequest, secret: string): WorkspacePrincipal {
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
      'A trusted Core Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Private Capability state was not found.');
  if (!principal.permissions.includes('workspace:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  return principal;
}

function idempotencyKey(request: JsonRequest): string {
  const value = request.headers['idempotency-key'];
  if (!value || !value.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value.trim();
}

function positive(value: string | undefined, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return parsed;
}

function mapError(error: unknown): never {
  if (error instanceof ReflectionDispositionProfileError)
    throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
  throw error;
}

export function createReflectionDispositionProfileRoutes(
  options: ReflectionDispositionProfileRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/reflection-candidates/:reflectionCandidateId/disposition',
      handle: async (request) => {
        const principal = subjectPrincipal(request, options.internalServiceSecret);
        try {
          const result = await options.reflections.disposition(
            principal,
            request.params.reflectionCandidateId,
            request.body,
            idempotencyKey(request)
          );
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/capability-profiles/:runtimeCapabilityDefinitionId/:runtimeCapabilityVersion',
      handle: async (request) => {
        const principal = subjectPrincipal(request, options.internalServiceSecret);
        try {
          const profile = await options.reflections.getProfile(
            principal,
            request.params.runtimeCapabilityDefinitionId as RuntimeCapabilityDefinitionId,
            positive(request.params.runtimeCapabilityVersion, 'runtimeCapabilityVersion')
          );
          if (!profile)
            throw new HttpError(
              404,
              'PROFILE_NOT_FOUND',
              'Private Capability Profile was not found.'
            );
          return json(200, profile);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/capability-twin',
      handle: async (request) => {
        const principal = subjectPrincipal(request, options.internalServiceSecret);
        try {
          const twin = await options.reflections.getTwin(principal);
          if (!twin)
            throw new HttpError(404, 'PROFILE_NOT_FOUND', 'Private Capability Twin was not found.');
          return json(200, twin);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapError(error);
        }
      }
    }
  ];
}
