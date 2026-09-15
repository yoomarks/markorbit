import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  DataEngineApplicantCandidateReferenceV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import type { WorkspaceDirectoryEntryId } from '@markorbit/contracts/workspace-directory';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  DiscoveredTrademarkAdmissionError,
  type DiscoveredTrademarkAdmissionService
} from './discovered-trademark-admission.js';

type Body = Record<string, unknown>;

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
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
  const body = request.body as Body;
  const allowed = ['directory', 'applicant', 'trademark', 'decision'];
  if (Object.keys(body).some((field) => !allowed.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
  return body;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a non-empty string.`);
  return value.trim();
}

function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function mapError(error: unknown): never {
  if (error instanceof DiscoveredTrademarkAdmissionError)
    throw new HttpError(error.status, error.code, error.message);
  if (error instanceof TypeError) throw new HttpError(400, 'INVALID_REQUEST', error.message);
  throw error;
}

export function createDiscoveredTrademarkAdmissionRoutes(options: {
  internalServiceSecret: string;
  service: Pick<DiscoveredTrademarkAdmissionService, 'admit'>;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/trademark-assets/admit-discovered',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const directory = object(body.directory, 'directory');
        if (body.decision !== 'MANAGED')
          throw new HttpError(400, 'INVALID_REQUEST', 'decision must be MANAGED.');
        try {
          return json(
            201,
            await options.service.admit({
              principal,
              directory: {
                workspaceDirectoryEntryId: text(
                  directory.workspaceDirectoryEntryId,
                  'directory.workspaceDirectoryEntryId'
                ) as WorkspaceDirectoryEntryId,
                version: positive(directory.version, 'directory.version')
              },
              applicant: object(
                body.applicant,
                'applicant'
              ) as unknown as DataEngineApplicantCandidateReferenceV1,
              trademark: object(
                body.trademark,
                'trademark'
              ) as unknown as DataEngineDiscoveredTrademarkCandidateV1,
              decision: text(body.decision, 'decision') as 'MANAGED',
              idempotencyKey: text(request.headers['idempotency-key'], 'Idempotency-Key')
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
