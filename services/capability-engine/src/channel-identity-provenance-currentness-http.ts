import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { ChannelIdentityProvenanceCurrentnessServiceV1 } from './channel-identity-provenance-currentness.js';

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

export function createChannelIdentityProvenanceCurrentnessRoutesV1(options: {
  internalServiceSecret: string;
  currentness: Pick<ChannelIdentityProvenanceCurrentnessServiceV1, 'assess'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/channel-identity/provenance/currentness',
      async handle(request) {
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
        const value = body(request);
        const implementationProfileVersion = Number(value.implementationProfileVersion);
        if (!Number.isSafeInteger(implementationProfileVersion) || implementationProfileVersion < 1)
          throw new HttpError(400, 'INVALID_REQUEST', 'implementationProfileVersion is invalid.');
        return json(
          200,
          await options.currentness.assess({
            capabilityId: text(value.capabilityId, 'capabilityId'),
            capabilityVersion: text(value.capabilityVersion, 'capabilityVersion'),
            implementationProfileId: text(value.implementationProfileId, 'implementationProfileId'),
            implementationProfileVersion
          })
        );
      }
    }
  ];
}
