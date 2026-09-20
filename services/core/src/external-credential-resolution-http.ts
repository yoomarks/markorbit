import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ExternalCredentialResolutionError,
  type ExternalCredentialResolutionServiceV1
} from './external-credential-resolution.js';

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

export function createExternalCredentialResolutionRoutesV1(
  options: Readonly<{
    internalServiceSecret: string;
    resolver: Pick<ExternalCredentialResolutionServiceV1, 'resolve'>;
  }>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/external-credentials/resolve',
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
          'callerService',
          'credential',
          'expectedWorkspaceId',
          'expectedProvider',
          'expectedExternalAccountRef',
          'expectedSecretKind',
          'requiredCapabilityId',
          'requiredCapabilityVersion',
          'implementationProfileId',
          'implementationProfileVersion',
          'correlationId',
          'approvedUsage'
        ]);
        if (Object.keys(value).some((key) => !allowed.has(key)))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request contains unsupported fields.');
        try {
          return json(
            200,
            await options.resolver.resolve({
              callerService: value.callerService as 'CAPABILITY_ENGINE',
              credential: value.credential as never,
              expectedWorkspaceId: value.expectedWorkspaceId as string,
              expectedProvider: value.expectedProvider as string,
              expectedExternalAccountRef: value.expectedExternalAccountRef as string,
              expectedSecretKind: value.expectedSecretKind as never,
              requiredCapabilityId: value.requiredCapabilityId as string,
              requiredCapabilityVersion: value.requiredCapabilityVersion as string,
              implementationProfileId: value.implementationProfileId as string,
              implementationProfileVersion: value.implementationProfileVersion as number,
              correlationId: value.correlationId as string,
              approvedUsage: value.approvedUsage as 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION'
            })
          );
        } catch (error) {
          if (error instanceof ExternalCredentialResolutionError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw new HttpError(
            503,
            'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE',
            'External credential owner is unavailable.',
            true
          );
        }
      }
    }
  ];
}
