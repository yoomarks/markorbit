import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { BusinessAttributionLinkIdV1 } from '@markorbit/contracts/business-attribution';
import type {
  PartnerCommissionEligibilityCandidateIdV1,
  PartnerReferralProgramIdV1
} from '@markorbit/contracts/partner-referral';
import type { WorkspaceDirectoryEntryId } from '@markorbit/contracts/workspace-directory';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { PartnerReferralError, type PartnerReferralService } from './partner-referral.js';

type Body = Record<string, unknown>;

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(
  request: JsonRequest,
  secret: string,
  permission: 'workspace:read' | 'workspace:manage'
): WorkspacePrincipal {
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
  if (!principal.permissions.includes(permission))
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return principal;
}

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function exact(value: Body, fields: readonly string[], field = 'Request body'): void {
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} contains unsupported fields.`);
}

function object(value: unknown, field: string, fields: readonly string[]): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  const parsed = value as Body;
  exact(parsed, fields, field);
  return parsed;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function one(value: unknown, field: string): 1 {
  if (value !== 1) throw new HttpError(400, 'INVALID_REQUEST', `${field} must be 1.`);
  return 1;
}

function idempotencyKey(request: JsonRequest): string {
  const value = request.headers['idempotency-key']?.trim();
  if (!value) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value;
}

function noQuery(request: JsonRequest): void {
  if (Object.keys(request.query).length)
    throw new HttpError(400, 'INVALID_REQUEST', 'Query parameters are not supported.');
}

function map(error: unknown): never {
  if (error instanceof PartnerReferralError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createPartnerReferralRoutes(options: {
  internalServiceSecret: string;
  service: PartnerReferralService;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/partner-referral-programs',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:manage');
        noQuery(request);
        const body = bodyOf(request);
        exact(body, ['referralCode', 'partner']);
        const partner = object(body.partner, 'partner', ['id', 'version', 'fingerprintSha256']);
        try {
          return json(
            201,
            await options.service.createProgram({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: idempotencyKey(request),
              referralCode: text(body.referralCode, 'referralCode'),
              partner: {
                id: text(partner.id, 'partner.id') as WorkspaceDirectoryEntryId,
                version: positive(partner.version, 'partner.version'),
                fingerprintSha256: text(partner.fingerprintSha256, 'partner.fingerprintSha256')
              }
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/partner-commission-eligibility-candidates',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:manage');
        noQuery(request);
        const body = bodyOf(request);
        exact(body, ['program', 'siteInboundAttribution']);
        const program = object(body.program, 'program', ['id', 'version', 'fingerprintSha256']);
        const attribution = object(body.siteInboundAttribution, 'siteInboundAttribution', [
          'id',
          'version',
          'fingerprintSha256'
        ]);
        try {
          return json(
            201,
            await options.service.evaluate({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: idempotencyKey(request),
              program: {
                id: text(program.id, 'program.id') as PartnerReferralProgramIdV1,
                version: one(program.version, 'program.version'),
                fingerprintSha256: text(program.fingerprintSha256, 'program.fingerprintSha256')
              },
              siteInboundAttribution: {
                id: text(
                  attribution.id,
                  'siteInboundAttribution.id'
                ) as BusinessAttributionLinkIdV1,
                version: one(attribution.version, 'siteInboundAttribution.version'),
                fingerprintSha256: text(
                  attribution.fingerprintSha256,
                  'siteInboundAttribution.fingerprintSha256'
                )
              }
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/partner-commission-eligibility-candidates/:candidateId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noQuery(request);
        try {
          const value = await options.service.findCandidate(
            principal.workspaceId,
            request.params.candidateId! as PartnerCommissionEligibilityCandidateIdV1
          );
          if (!value)
            throw new HttpError(
              404,
              'NOT_FOUND',
              'Partner Commission Eligibility Candidate was not found.'
            );
          return json(200, value);
        } catch (error) {
          return map(error);
        }
      }
    }
  ];
}
