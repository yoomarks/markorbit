import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { ExternalCredentialCurrentnessServiceV1 } from './external-credential-currentness.js';

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

export function createExternalCredentialCurrentnessRoutesV1(options: {
  internalServiceSecret: string;
  currentness: Pick<ExternalCredentialCurrentnessServiceV1, 'assess'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/external-credentials/currentness',
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
        const allowed = new Set([
          'credential',
          'expectedWorkspaceId',
          'expectedProvider',
          'expectedExternalAccountRef',
          'expectedSecretKind',
          'requiredCapabilityId'
        ]);
        if (Object.keys(value).some((key) => !allowed.has(key)))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request contains unsupported fields.');
        try {
          return json(
            200,
            await options.currentness.assess({
              credential: value.credential as never,
              expectedWorkspaceId: text(value.expectedWorkspaceId, 'expectedWorkspaceId'),
              expectedProvider: text(value.expectedProvider, 'expectedProvider'),
              expectedExternalAccountRef: text(
                value.expectedExternalAccountRef,
                'expectedExternalAccountRef'
              ),
              expectedSecretKind: text(value.expectedSecretKind, 'expectedSecretKind') as never,
              requiredCapabilityId: text(value.requiredCapabilityId, 'requiredCapabilityId')
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
