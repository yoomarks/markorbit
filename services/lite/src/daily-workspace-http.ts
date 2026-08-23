import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  DailyWorkspaceSnapshotError,
  type DailyWorkspaceSnapshotService
} from './daily-workspace-snapshot.js';

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
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
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase()) {
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  }
  if (!principal.permissions.includes('workspace:read')) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  }
  return principal;
}

export function createDailyWorkspaceRoutes(options: {
  internalServiceSecret: string;
  service: DailyWorkspaceSnapshotService;
}): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/daily-workspace',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.snapshot(principal.workspaceId, principal.userId));
        } catch (error) {
          if (error instanceof DailyWorkspaceSnapshotError) {
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          }
          throw error;
        }
      }
    }
  ];
}
