import { IdentityError } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { AccountOnboardingService } from './account-onboarding.js';
import { validateInternalServiceSecret } from './auth.js';

export interface CoreAccountOnboardingRouteOptions {
  onboarding: AccountOnboardingService;
  internalServiceSecret: string;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return value as Record<string, unknown>;
}

function identityError(error: unknown): never {
  if (!(error instanceof IdentityError)) throw error;
  const status =
    error.code === 'DUPLICATE_WORKSPACE_SLUG'
      ? 409
      : error.code === 'USER_NOT_FOUND'
        ? 404
        : ['USER_DISABLED', 'WORKSPACE_ARCHIVED', 'MEMBERSHIP_SUSPENDED'].includes(error.code)
          ? 403
          : error.code === 'PERSISTENCE_UNAVAILABLE'
            ? 503
            : 400;
  throw new HttpError(status, error.code, error.message, status === 503);
}

function internal(
  options: CoreAccountOnboardingRouteOptions,
  handle: (request: JsonRequest) => Promise<ReturnType<typeof json>>
): JsonRoute['handle'] {
  return async (request) => {
    if (
      !validateInternalServiceSecret(
        options.internalServiceSecret,
        request.headers['x-markorbit-internal-authorization']
      )
    )
      throw new HttpError(
        401,
        'INTERNAL_SERVICE_UNAUTHORIZED',
        'Internal service identity is invalid.'
      );
    try {
      return await handle(request);
    } catch (error) {
      return identityError(error);
    }
  };
}

export function createCoreAccountOnboardingRoutes(
  options: CoreAccountOnboardingRouteOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/onboarding/users/:userId/workspaces',
      handle: internal(options, async (request) =>
        json(200, {
          workspaces: await options.onboarding.listWorkspaces(request.params.userId!)
        })
      )
    },
    {
      method: 'POST',
      path: '/internal/onboarding/workspaces',
      handle: internal(options, async (request) => {
        const value = record(request.body);
        if (
          typeof value.userId !== 'string' ||
          typeof value.name !== 'string' ||
          (value.slug !== undefined && typeof value.slug !== 'string')
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'Workspace onboarding data is invalid.');
        const workspace = await options.onboarding.createWorkspace(value.userId, {
          name: value.name,
          ...(typeof value.slug === 'string' && value.slug.trim() ? { slug: value.slug } : {})
        });
        return json(201, workspace);
      })
    }
  ];
}
