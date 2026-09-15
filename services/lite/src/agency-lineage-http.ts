import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal } from '@markorbit/contracts';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { AgencyLineageError, type AgencyLineageProjectionService } from './agency-lineage.js';

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principal(request: JsonRequest, secret: string) {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let value;
  try {
    value = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  if (
    request.headers['x-markorbit-workspace-id']?.toLowerCase() !== value.workspaceId.toLowerCase()
  )
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Agency lineage was not found.');
  if (!value.permissions.includes('workspace:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  return value;
}

export function createAgencyLineageRoutes(options: {
  internalServiceSecret: string;
  service: Pick<AgencyLineageProjectionService, 'project'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/agency/trademark-assets/:trademarkAssetId/lineage',
      async handle(request) {
        const actor = principal(request, options.internalServiceSecret);
        const id = request.params.trademarkAssetId;
        if (!id?.startsWith('trademark-asset_'))
          throw new HttpError(400, 'INVALID_REQUEST', 'trademarkAssetId is invalid.');
        try {
          return json(200, {
            lineage: await options.service.project(actor.workspaceId, id as TrademarkAssetId)
          });
        } catch (error) {
          if (error instanceof AgencyLineageError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    }
  ];
}
