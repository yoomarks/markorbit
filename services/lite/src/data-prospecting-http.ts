import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { OpportunityCandidateId } from '@markorbit/contracts/product-loop';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { DataProspectingError, type DataProspectingService } from './data-prospecting.js';

type Body = Record<string, unknown>;
function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured),
    right = Buffer.from(supplied);
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
  if (
    request.headers['x-markorbit-workspace-id']?.toLowerCase() !==
    principal.workspaceId.toLowerCase()
  )
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  return principal;
}
function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}
function exactBody(body: Body, allowed: readonly string[]): void {
  const authority = [
    'workspaceId',
    'actorId',
    'userId',
    'principalId',
    'decidedByPrincipalId',
    'confirmedByPrincipalId'
  ].find((field) => body[field] !== undefined);
  if (authority)
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Actor identity comes from the authenticated Principal.'
    );
  if (Object.keys(body).some((field) => !allowed.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}
function keyOf(request: JsonRequest): string {
  const value = request.headers['idempotency-key'];
  if (!value?.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value.trim();
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}
function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be positive.`);
  return Number(value);
}
function mapError(error: unknown): never {
  if (error instanceof DataProspectingError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createDataProspectingRoutes(options: {
  internalServiceSecret: string;
  service: Pick<DataProspectingService, 'admit' | 'sendOutreach'>;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/data-prospecting/candidates',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret),
          body = bodyOf(request);
        exactBody(body, ['applicant', 'trademark', 'signal', 'decision']);
        try {
          return json(
            201,
            await options.service.admit({
              principal,
              applicant: object(body.applicant, 'applicant') as never,
              trademark: object(body.trademark, 'trademark') as never,
              signal: text(body.signal, 'signal') as 'UNREGISTERED_TRADEMARK_APPLICATION',
              decision: text(body.decision, 'decision') as 'OPEN_FOR_HUMAN_QUALIFICATION',
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/data-prospecting/candidates/:opportunityCandidateId/outreach',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret),
          body = bodyOf(request);
        exactBody(body, [
          'candidate',
          'qualificationDecision',
          'endpointFingerprintSha256',
          'policyRef',
          'reviewedSendFingerprintSha256',
          'confirmation',
          'message'
        ]);
        const candidate = object(body.candidate, 'candidate');
        const qualification = object(body.qualificationDecision, 'qualificationDecision');
        try {
          return json(
            200,
            await options.service.sendOutreach({
              principal,
              candidate: {
                id: request.params.opportunityCandidateId! as OpportunityCandidateId,
                version: positive(candidate.version, 'candidate.version'),
                fingerprintSha256: text(candidate.fingerprintSha256, 'candidate.fingerprintSha256')
              },
              qualificationDecision: {
                id: text(qualification.id, 'qualificationDecision.id'),
                version: positive(qualification.version, 'qualificationDecision.version')
              },
              endpointFingerprintSha256: text(
                body.endpointFingerprintSha256,
                'endpointFingerprintSha256'
              ),
              policyRef: object(body.policyRef, 'policyRef') as never,
              reviewedSendFingerprintSha256: text(
                body.reviewedSendFingerprintSha256,
                'reviewedSendFingerprintSha256'
              ),
              confirmation: object(body.confirmation, 'confirmation') as never,
              message: object(body.message, 'message') as never,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
