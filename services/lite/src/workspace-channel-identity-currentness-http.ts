import { timingSafeEqual } from 'node:crypto';
import type { ChannelFeatureKeyV1 } from '@markorbit/contracts/channel-platform';
import type { WorkspaceChannelIdentityBindingId } from '@markorbit/contracts/channel-identity-binding';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { WorkspaceChannelIdentityCurrentnessResolverV1 } from './workspace-channel-identity-currentness.js';

function trusted(configured: string, supplied: string | undefined) {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createWorkspaceChannelIdentityCurrentnessRoutesV1(options: {
  internalServiceSecret: string;
  resolver: Pick<WorkspaceChannelIdentityCurrentnessResolverV1, 'resolve'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/channel-identity/currentness',
      async handle(request: JsonRequest) {
        if (
          !trusted(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'UNTRUSTED_INTERNAL_CALLER',
            'Trusted internal authorization is required.'
          );
        if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
        const value = request.body as Record<string, unknown>;
        if (typeof value.workspaceId !== 'string' || !value.workspaceId.trim())
          throw new HttpError(400, 'INVALID_REQUEST', 'workspaceId is required.');
        try {
          return json(
            200,
            await options.resolver.resolve({
              workspaceId: value.workspaceId,
              featureKey: value.featureKey as ChannelFeatureKeyV1,
              binding: value.binding as {
                id: WorkspaceChannelIdentityBindingId;
                version: number;
                fingerprintSha256: string;
              },
              ...(value.oauthRequirements === undefined
                ? {}
                : {
                    oauthRequirements: value.oauthRequirements as {
                      expectedProvider: string;
                      requiredScopes: string[];
                    }
                  })
            })
          );
        } catch (error) {
          if (error instanceof TypeError)
            throw new HttpError(400, 'INVALID_REQUEST', error.message);
          throw error;
        }
      }
    }
  ];
}
