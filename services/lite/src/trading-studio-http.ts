import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TradingStandardStudioRunId } from '@markorbit/contracts/trading-studio-usage';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  TradingStudioRunPersistenceError,
  type PostgresTradingStudioRunStore
} from './trading-studio-run.js';

export interface TradingStudioReadRouteOptions {
  internalServiceSecret: string;
  runs: Pick<PostgresTradingStudioRunStore, 'getLatest'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
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
  if (!principal.permissions.includes('workspace:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  return principal;
}

export function createTradingStudioReadRoutes(options: TradingStudioReadRouteOptions): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/trading/studio-runs/:studioRunId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.body !== undefined || Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Studio Run read accepts only its path identifier.'
          );
        try {
          const run = await options.runs.getLatest(
            principal.workspaceId,
            request.params.studioRunId! as TradingStandardStudioRunId
          );
          return json(200, { run });
        } catch (error) {
          if (error instanceof TradingStudioRunPersistenceError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    }
  ];
}
