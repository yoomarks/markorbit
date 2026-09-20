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

function exactObject(value: unknown, fields: readonly string[], name: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${name} must be an object.`);
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !fields.includes(key)))
    throw new HttpError(400, 'INVALID_REQUEST', `${name} contains unsupported fields.`);
  return item;
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
        const allowed = new Set([
          'workspaceId',
          'featureKey',
          'binding',
          'oauthRequirements',
          'externalCredentialRequirements'
        ]);
        if (Object.keys(value).some((key) => !allowed.has(key)))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request contains unsupported fields.');
        if (typeof value.workspaceId !== 'string' || !value.workspaceId.trim())
          throw new HttpError(400, 'INVALID_REQUEST', 'workspaceId is required.');
        const binding = exactObject(
          value.binding,
          ['id', 'version', 'fingerprintSha256'],
          'binding'
        );
        if (
          typeof binding.id !== 'string' ||
          !Number.isSafeInteger(binding.version) ||
          Number(binding.version) < 1 ||
          typeof binding.fingerprintSha256 !== 'string' ||
          !/^[a-f0-9]{64}$/u.test(binding.fingerprintSha256)
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'binding is invalid.');
        const oauthRequirements =
          value.oauthRequirements === undefined
            ? undefined
            : exactObject(
                value.oauthRequirements,
                ['expectedProvider', 'requiredScopes'],
                'oauthRequirements'
              );
        if (
          oauthRequirements &&
          (typeof oauthRequirements.expectedProvider !== 'string' ||
            !oauthRequirements.expectedProvider.trim() ||
            !Array.isArray(oauthRequirements.requiredScopes) ||
            oauthRequirements.requiredScopes.some(
              (scope) => typeof scope !== 'string' || !scope.trim()
            ))
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'oauthRequirements is invalid.');
        const externalCredentialRequirements =
          value.externalCredentialRequirements === undefined
            ? undefined
            : exactObject(
                value.externalCredentialRequirements,
                ['expectedProvider', 'expectedSecretKind'],
                'externalCredentialRequirements'
              );
        if (
          externalCredentialRequirements &&
          (typeof externalCredentialRequirements.expectedProvider !== 'string' ||
            !externalCredentialRequirements.expectedProvider.trim() ||
            !['API_KEY', 'STATIC_BEARER', 'BASIC'].includes(
              String(externalCredentialRequirements.expectedSecretKind)
            ))
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'externalCredentialRequirements is invalid.');
        try {
          return json(
            200,
            await options.resolver.resolve({
              workspaceId: value.workspaceId,
              featureKey: value.featureKey as ChannelFeatureKeyV1,
              binding: binding as {
                id: WorkspaceChannelIdentityBindingId;
                version: number;
                fingerprintSha256: string;
              },
              ...(oauthRequirements === undefined
                ? {}
                : {
                    oauthRequirements: oauthRequirements as {
                      expectedProvider: string;
                      requiredScopes: string[];
                    }
                  }),
              ...(externalCredentialRequirements === undefined
                ? {}
                : {
                    externalCredentialRequirements: externalCredentialRequirements as {
                      expectedProvider: string;
                      expectedSecretKind: 'API_KEY' | 'STATIC_BEARER' | 'BASIC';
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
