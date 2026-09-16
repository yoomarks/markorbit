import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  ProtectionMonitoringCandidateIdV1,
  ProtectionMonitoringDispositionV1
} from '@markorbit/contracts/protection-monitoring';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import type { WorkspaceWatchTargetId } from '@markorbit/contracts/workspace-watch';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProtectionMonitoringError,
  type ProtectionMonitoringService
} from './protection-monitoring.js';

type Body = Record<string, unknown>;
function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
  const supplied = request.headers['x-markorbit-internal-authorization'];
  const left = Buffer.from(secret),
    right = Buffer.from(supplied ?? '');
  if (left.length < 32 || left.length !== right.length || !timingSafeEqual(left, right))
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
  const body = request.body as Body;
  if (
    ['workspaceId', 'actorId', 'userId', 'principalId', 'decidedByPrincipalId'].some(
      (field) => body[field] !== undefined
    )
  )
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Workspace and actor identity come from the authenticated Principal.'
    );
  return body;
}
function only(body: Body, fields: readonly string[]): void {
  if (Object.keys(body).some((field) => !fields.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
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
function version(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be positive.`);
  return Number(value);
}
function key(request: JsonRequest): string {
  return text(request.headers['idempotency-key'], 'Idempotency-Key');
}
function map(error: unknown): never {
  if (error instanceof ProtectionMonitoringError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createProtectionMonitoringRoutes(options: {
  internalServiceSecret: string;
  service: Pick<ProtectionMonitoringService, 'admit' | 'decide' | 'prepareActionCandidate'>;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/protection-monitoring/candidates',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret),
          body = bodyOf(request);
        only(body, ['asset', 'watchTarget', 'applicant', 'trademark']);
        const asset = object(body.asset, 'asset'),
          watch = object(body.watchTarget, 'watchTarget');
        try {
          return json(
            201,
            await options.service.admit({
              principal,
              asset: {
                id: text(asset.id, 'asset.id') as TrademarkAssetId,
                version: version(asset.version, 'asset.version')
              },
              watchTarget: {
                id: text(watch.id, 'watchTarget.id') as WorkspaceWatchTargetId,
                version: version(watch.version, 'watchTarget.version')
              },
              applicant: object(body.applicant, 'applicant') as never,
              trademark: object(body.trademark, 'trademark') as never,
              idempotencyKey: key(request)
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/protection-monitoring/candidates/:candidateId/decision',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret),
          body = bodyOf(request);
        only(body, ['version', 'expectedCandidateFingerprintSha256', 'disposition', 'rationale']);
        try {
          return json(
            200,
            await options.service.decide({
              principal,
              candidate: {
                id: request.params.candidateId! as ProtectionMonitoringCandidateIdV1,
                version: version(body.version, 'version') as 1
              },
              expectedCandidateFingerprintSha256: text(
                body.expectedCandidateFingerprintSha256,
                'expectedCandidateFingerprintSha256'
              ),
              disposition: text(
                body.disposition,
                'disposition'
              ) as ProtectionMonitoringDispositionV1,
              rationale: text(body.rationale, 'rationale'),
              idempotencyKey: key(request)
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/protection-monitoring/candidates/:candidateId/action-candidate',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret),
          body = bodyOf(request);
        only(body, []);
        try {
          return json(
            200,
            await options.service.prepareActionCandidate(
              principal,
              request.params.candidateId! as ProtectionMonitoringCandidateIdV1,
              key(request)
            )
          );
        } catch (error) {
          return map(error);
        }
      }
    }
  ];
}
