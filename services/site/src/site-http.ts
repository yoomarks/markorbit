import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  SiteServiceError,
  type ActivateSiteCommandV1,
  type CreateSiteCommandV1,
  type CreateSiteHostBindingCommandV1,
  type ReviseSiteConfigurationCommandV1,
  type SiteServiceV1,
  type SuspendSiteCommandV1,
  type VerifySiteHostBindingCommandV1
} from './site-service.js';

export interface SiteHttpOptionsV1 {
  service: Pick<
    SiteServiceV1,
    | 'create'
    | 'reviseConfiguration'
    | 'createHostBinding'
    | 'verifyHostBinding'
    | 'activate'
    | 'suspend'
    | 'list'
    | 'currentConfiguration'
    | 'listHostBindings'
    | 'resolve'
  >;
  internalServiceSecret: string;
}

function internal(request: JsonRequest, secret: string): void {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function principal(
  request: JsonRequest,
  options: SiteHttpOptionsV1,
  permission: 'workspace:read' | 'workspace:manage'
): WorkspacePrincipal {
  internal(request, options.internalServiceSecret);
  try {
    const value = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
    const workspaceId = request.params.workspaceId;
    if (!workspaceId || value.workspaceId !== workspaceId)
      throw new HttpError(
        403,
        'WORKSPACE_MISMATCH',
        'Workspace context does not match Principal truth.'
      );
    if (!value.permissions.includes(permission))
      throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
}

function idempotencyKey(request: JsonRequest, value: Record<string, unknown>): string {
  const header = request.headers['idempotency-key'];
  if (!header) throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  if (value.idempotencyKey !== undefined && value.idempotencyKey !== header)
    throw new HttpError(400, 'INVALID_REQUEST', 'Body idempotencyKey must match the header.');
  return header;
}

function translate(error: unknown): never {
  if (!(error instanceof SiteServiceError)) throw error;
  const status =
    error.code === 'INVALID_INPUT'
      ? 400
      : error.code === 'NOT_FOUND' || error.code === 'HOST_NOT_ACTIVE'
        ? 404
        : error.code === 'WORKSPACE_MISMATCH'
          ? 403
          : error.code === 'COMMERCIAL_AUTHORITY_UNAVAILABLE'
            ? 503
            : error.code === 'SITE_NOT_ACTIVE' || error.code === 'COMMERCIAL_ACCESS_DENIED'
              ? 422
              : 409;
  throw new HttpError(status, error.code, error.message, error.retryable);
}

async function run<T>(status: number, work: () => Promise<T>) {
  try {
    return json(status, await work());
  } catch (error) {
    return translate(error);
  }
}

export function createSiteHttpRoutesV1(options: SiteHttpOptionsV1): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/sites',
      async handle(request) {
        const value = body(request);
        const actor = principal(request, options, 'workspace:manage');
        const command = value as unknown as Omit<
          CreateSiteCommandV1,
          'workspaceId' | 'idempotencyKey'
        >;
        return run(201, () =>
          options.service.create({
            ...command,
            workspaceId: actor.workspaceId,
            idempotencyKey: idempotencyKey(request, value)
          })
        );
      }
    },
    {
      method: 'GET',
      path: '/internal/workspaces/:workspaceId/sites',
      async handle(request) {
        const actor = principal(request, options, 'workspace:read');
        return run(200, () => options.service.list(actor.workspaceId));
      }
    },
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/sites/:siteId/configurations',
      async handle(request) {
        const value = body(request);
        const actor = principal(request, options, 'workspace:manage');
        const command = value as unknown as Omit<
          ReviseSiteConfigurationCommandV1,
          'workspaceId' | 'siteId' | 'idempotencyKey'
        >;
        return run(200, () =>
          options.service.reviseConfiguration({
            ...command,
            workspaceId: actor.workspaceId,
            siteId: request.params.siteId!,
            idempotencyKey: idempotencyKey(request, value)
          })
        );
      }
    },
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/sites/:siteId/host-bindings',
      async handle(request) {
        const value = body(request);
        const actor = principal(request, options, 'workspace:manage');
        const command = value as unknown as Omit<
          CreateSiteHostBindingCommandV1,
          'workspaceId' | 'siteId' | 'idempotencyKey'
        >;
        return run(201, () =>
          options.service.createHostBinding({
            ...command,
            workspaceId: actor.workspaceId,
            siteId: request.params.siteId!,
            idempotencyKey: idempotencyKey(request, value)
          })
        );
      }
    },
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/site-host-bindings/:bindingId/verify',
      async handle(request) {
        const value = body(request);
        const actor = principal(request, options, 'workspace:manage');
        const command = value as unknown as Omit<
          VerifySiteHostBindingCommandV1,
          'workspaceId' | 'bindingId' | 'idempotencyKey'
        >;
        return run(200, () =>
          options.service.verifyHostBinding({
            ...command,
            workspaceId: actor.workspaceId,
            bindingId: request.params.bindingId!,
            idempotencyKey: idempotencyKey(request, value)
          })
        );
      }
    },
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/sites/:siteId/activate',
      async handle(request) {
        const value = body(request);
        const actor = principal(request, options, 'workspace:manage');
        const command = value as unknown as Omit<
          ActivateSiteCommandV1,
          'workspaceId' | 'siteId' | 'idempotencyKey'
        >;
        return run(200, () =>
          options.service.activate({
            ...command,
            workspaceId: actor.workspaceId,
            siteId: request.params.siteId!,
            idempotencyKey: idempotencyKey(request, value)
          })
        );
      }
    },
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/sites/:siteId/suspend',
      async handle(request) {
        const value = body(request);
        const actor = principal(request, options, 'workspace:manage');
        const command = value as unknown as Omit<
          SuspendSiteCommandV1,
          'workspaceId' | 'siteId' | 'idempotencyKey'
        >;
        return run(200, () =>
          options.service.suspend({
            ...command,
            workspaceId: actor.workspaceId,
            siteId: request.params.siteId!,
            idempotencyKey: idempotencyKey(request, value)
          })
        );
      }
    },
    {
      method: 'GET',
      path: '/internal/workspaces/:workspaceId/sites/:siteId/configuration',
      async handle(request) {
        const actor = principal(request, options, 'workspace:read');
        return run(200, () =>
          options.service.currentConfiguration(actor.workspaceId, request.params.siteId!)
        );
      }
    },
    {
      method: 'GET',
      path: '/internal/workspaces/:workspaceId/sites/:siteId/host-bindings',
      async handle(request) {
        const actor = principal(request, options, 'workspace:read');
        return run(200, () =>
          options.service.listHostBindings(actor.workspaceId, request.params.siteId!)
        );
      }
    },
    {
      method: 'POST',
      path: '/internal/site-runtime/resolve',
      async handle(request) {
        internal(request, options.internalServiceSecret);
        const value = body(request);
        if (Object.keys(value).some((key) => !['hostname', 'observedAt'].includes(key)))
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Only trusted host resolution input is accepted.'
          );
        if (typeof value.hostname !== 'string')
          throw new HttpError(400, 'INVALID_REQUEST', 'hostname must be a string.');
        if (value.observedAt !== undefined && typeof value.observedAt !== 'string')
          throw new HttpError(400, 'INVALID_REQUEST', 'observedAt must be a string.');
        const hostname = value.hostname;
        const observedAt = value.observedAt;
        return run(200, () => options.service.resolve(hostname, observedAt));
      }
    }
  ];
}
