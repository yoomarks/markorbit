import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  EducationCommunityCohortIdV1,
  EducationCommunityJourneyIdV1
} from '@markorbit/contracts/education-community';
import type { LiteWorkItemId } from '@markorbit/contracts/lite-work-item';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { EducationCommunityError, type EducationCommunityService } from './education-community.js';

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
  if (!principal.permissions.includes('workspace:manage'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:manage permission is required.');
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
  const result = value as Body;
  exact(result, fields, field);
  return result;
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
function key(request: JsonRequest): string {
  const value = request.headers['idempotency-key']?.trim();
  if (!value) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value;
}
function map(error: unknown): never {
  if (error instanceof EducationCommunityError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}
function source(value: unknown) {
  const input = object(value, 'source', [
    'owner',
    'kind',
    'id',
    'version',
    'fingerprintSha256',
    'observedAt'
  ]);
  const sourceVersion =
    typeof input.version === 'string'
      ? text(input.version, 'source.version')
      : positive(input.version, 'source.version');
  return {
    owner: text(input.owner, 'source.owner'),
    kind: text(input.kind, 'source.kind'),
    id: text(input.id, 'source.id'),
    version: sourceVersion,
    fingerprintSha256: text(input.fingerprintSha256, 'source.fingerprintSha256'),
    observedAt: text(input.observedAt, 'source.observedAt')
  };
}
function action(value: unknown) {
  const input = object(value, 'workItem', ['id', 'version', 'fingerprintSha256']);
  return {
    id: text(input.id, 'workItem.id') as LiteWorkItemId,
    version: positive(input.version, 'workItem.version'),
    fingerprintSha256: text(input.fingerprintSha256, 'workItem.fingerprintSha256')
  };
}

export function createEducationCommunityRoutes(options: {
  internalServiceSecret: string;
  service: EducationCommunityService;
}): readonly JsonRoute[] {
  const command = (request: JsonRequest) => {
    const principal = principalOf(request, options.internalServiceSecret);
    return {
      workspaceId: principal.workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: key(request)
    };
  };
  return [
    {
      method: 'POST',
      path: '/v1/education-community/cohorts',
      handle: async (request) => {
        const context = command(request),
          body = bodyOf(request);
        exact(body, ['name', 'source']);
        try {
          return json(
            201,
            await options.service.createCohort({
              ...context,
              name: text(body.name, 'name'),
              source: source(body.source)
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/education-community/participants',
      handle: async (request) => {
        const context = command(request),
          body = bodyOf(request);
        exact(body, ['cohortId', 'participantRef', 'endpointFingerprintSha256']);
        try {
          return json(
            201,
            await options.service.register({
              ...context,
              cohortId: text(body.cohortId, 'cohortId') as EducationCommunityCohortIdV1,
              participantRef: text(body.participantRef, 'participantRef'),
              endpointFingerprintSha256: text(
                body.endpointFingerprintSha256,
                'endpointFingerprintSha256'
              )
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/education-community/journeys/:journeyId/invitation',
      handle: async (request) => {
        const context = command(request),
          body = bodyOf(request);
        exact(body, [
          'expectedVersion',
          'invitationClaimToken',
          'policyRef',
          'reviewedSendFingerprintSha256'
        ]);
        const policy = object(body.policyRef, 'policyRef', ['policyId', 'version']);
        try {
          return json(
            200,
            await options.service.prepareInvitation({
              ...context,
              journeyId: request.params.journeyId! as EducationCommunityJourneyIdV1,
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              invitationClaimToken: text(body.invitationClaimToken, 'invitationClaimToken'),
              policyRef: {
                policyId: text(policy.policyId, 'policyRef.policyId'),
                version: positive(policy.version, 'policyRef.version')
              },
              reviewedSendFingerprintSha256: text(
                body.reviewedSendFingerprintSha256,
                'reviewedSendFingerprintSha256'
              )
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/education-community/activations',
      handle: async (request) => {
        const context = command(request),
          body = bodyOf(request);
        exact(body, ['invitationClaimToken']);
        try {
          return json(
            200,
            await options.service.activate({
              ...context,
              invitationClaimToken: text(body.invitationClaimToken, 'invitationClaimToken')
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/education-community/journeys/:journeyId/first-value',
      handle: async (request) => {
        const context = command(request),
          body = bodyOf(request);
        exact(body, ['expectedVersion', 'workItem']);
        try {
          return json(
            200,
            await options.service.recordFirstValue({
              ...context,
              journeyId: request.params.journeyId! as EducationCommunityJourneyIdV1,
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              workItem: action(body.workItem)
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/education-community/journeys/:journeyId/retained-use',
      handle: async (request) => {
        const context = command(request),
          body = bodyOf(request);
        exact(body, ['expectedVersion', 'workItem']);
        try {
          return json(
            200,
            await options.service.recordRetainedUse({
              ...context,
              journeyId: request.params.journeyId! as EducationCommunityJourneyIdV1,
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              workItem: action(body.workItem)
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    }
  ];
}
