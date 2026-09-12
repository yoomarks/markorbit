import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { PreparedActionId } from '@markorbit/contracts/product-loop';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ClientNotificationFollowupError,
  type ClientNotificationFollowupService
} from './client-notification-followup.js';
import { PreparedActionJourneyError } from './prepared-action.js';

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
  if (!principal.permissions.includes('matter:manage'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'matter:manage permission is required.');
  return principal;
}

function noBodyOrQuery(request: JsonRequest): void {
  if (request.body !== undefined || Object.keys(request.query).length > 0)
    throw new HttpError(400, 'INVALID_REQUEST', 'Follow-up accepts no request body or query.');
}
function mapError(error: unknown): never {
  if (error instanceof ClientNotificationFollowupError)
    throw new HttpError(error.status, error.code, error.message);
  if (error instanceof PreparedActionJourneyError)
    throw new HttpError(error.status, error.code, error.message);
  throw error;
}

export function createClientNotificationFollowupRoutes(options: {
  internalServiceSecret: string;
  service: Pick<ClientNotificationFollowupService, 'reconcile'>;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/prepared-actions/:preparedActionId/client-notification-followup',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        noBodyOrQuery(request);
        try {
          return json(
            200,
            await options.service.reconcile(
              principal.workspaceId,
              request.params.preparedActionId! as PreparedActionId,
              principal
            )
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
